#!/usr/bin/env python3
"""
JSON/YAML Schema Validator & Auto-Fixer
Validates, fixes, and reports on JSON/YAML files.
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Error: PyYAML not installed. Install with: pip install pyyaml")
    sys.exit(1)


def load_json(path: Path) -> tuple[dict|list, str|None]:
    """Load JSON file, return data and error message."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f), None
    except json.JSONDecodeError as e:
        return None, f"JSON decode error at line {e.lineno}, column {e.colno}: {e.msg}"
    except Exception as e:
        return None, f"Error reading {path}: {e}"


def load_yaml(path: Path) -> tuple[dict|list, str|None]:
    """Load YAML file, return data and error message."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f), None
    except yaml.YAMLError as e:
        return None, f"YAML error: {e}"
    except Exception as e:
        return None, f"Error reading {path}: {e}"


def save_json(path: Path, data: dict|list) -> bool:
    """Save data as JSON with proper formatting."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving {path}: {e}")
        return False


def save_yaml(path: Path, data: dict|list) -> bool:
    """Save data as YAML with proper formatting."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        return True
    except Exception as e:
        print(f"Error saving {path}: {e}")
        return False


def fix_yaml_auto(data: str) -> tuple[str, bool]:
    """Attempt to auto-fix common YAML errors. Returns (fixed_text, was_fixed)."""
    text = data.strip()
    was_fixed = False
    
    # Fix tab characters (YAML hates tabs)
    if '\t' in text:
        text = text.replace('\t', '  ')
        was_fixed = True
    
    # Fix single quotes to double quotes (YAML prefers double)
    # Only for simple key: 'value' patterns
    import re
    # Match single-quoted values that should be double-quoted
    text = re.sub(r":\s*'([^']*)'", r': "\1"', text)
    
    # Fix trailing commas (YAML doesn't support them)
    text = re.sub(r',\s*(\n|$)', r'\1', text)
    
    # Fix bare keys that should be quoted (if they contain special chars)
    text = re.sub(r'^(\s*)(\w+-\w+):', r'\1"\2":', text, flags=re.MULTILINE)
    
    if text != data.strip():
        was_fixed = True
    
    return text, was_fixed


def fix_json_auto(data: str) -> str:
    """Attempt to auto-fix common JSON errors."""
    # Common fixes
    text = data.strip()

    # Fix trailing commas
    import re
    text = re.sub(r',(\s*[}\]])', r'\1', text)

    # Fix missing quotes on keys
    text = re.sub(r'(\w+):', r'"\1":', text)

    # Fix single quotes to double quotes
    text = re.sub(r"'([^']*)'", r'"\1"', text)

    return text


def validate_file(path: Path, auto_fix: bool = False, output_format: str = "text") -> dict:
    """Validate a single file."""
    result = {
        "path": str(path),
        "valid": False,
        "format": None,
        "errors": [],
        "fixed": False,
        "size_bytes": path.stat().st_size
    }

    suffix = path.suffix.lower()

    # Try JSON
    if suffix in ['.json', '.jsonl']:
        result["format"] = "JSON"
        data, error = load_json(path)
        if error and auto_fix:
            # Try to fix
            with open(path, 'r', encoding='utf-8') as f:
                original = f.read()
            fixed_text = fix_json_auto(original)
            try:
                data = json.loads(fixed_text)
                # Save fixed version
                if save_json(path, data):
                    result["fixed"] = True
                    result["errors"] = []
                    result["valid"] = True
                    return result
            except:
                pass
            result["errors"].append(f"Auto-fix failed: {error}")
        elif error:
            result["errors"].append(error)
        else:
            result["valid"] = True

    # Try YAML
    elif suffix in ['.yaml', '.yml']:
        result["format"] = "YAML"
        data, error = load_yaml(path)
        if error and auto_fix:
            # Try to fix YAML errors
            with open(path, 'r', encoding='utf-8') as f:
                original = f.read()
            fixed_text, was_fixed = fix_yaml_auto(original)
            if was_fixed:
                try:
                    # Validate the fixed text
                    data = yaml.safe_load(fixed_text)
                    # Try to save the fixed version
                    if save_yaml(path, data):
                        result["fixed"] = True
                        result["errors"] = []
                        result["valid"] = True
                        return result
                except yaml.YAMLError:
                    pass
            result["errors"].append(f"YAML auto-fix attempted but failed: {error}")
        elif error:
            result["errors"].append(error)
        else:
            result["valid"] = True

    # Try embedded JSON/YAML in Markdown
    elif suffix in ['.md', '.markdown']:
        result["format"] = "Markdown"
        content = path.read_text(encoding='utf-8')

        # Extract JSON/YAML code blocks
        json_blocks = re.findall(r'```json\s*\n(.*?)\n```', content, re.DOTALL)
        yaml_blocks = re.findall(r'```(?:yaml|yml)\s*\n(.*?)\n```', content, re.DOTALL)

        # Extract YAML frontmatter (--- ... ---)
        frontmatter_blocks = re.findall(r'^---\s*\n(.*?)\n^---', content, re.MULTILINE | re.DOTALL)

        # Tag each block with its type
        all_blocks = [(b, 'json') for b in json_blocks] + \
                     [(b, 'yaml') for b in yaml_blocks] + \
                     [(b, 'yaml') for b in frontmatter_blocks]

        embedded_results = []
        for i, (block, block_type) in enumerate(all_blocks):
            try:
                if block_type == 'json' or block.strip().startswith('{') or block.strip().startswith('['):
                    json.loads(block)
                else:
                    yaml.safe_load(block)
                embedded_results.append((i, True, None))
            except (json.JSONDecodeError, yaml.YAMLError) as e:
                embedded_results.append((i, False, str(e)))

        if embedded_results:
            valid_count = sum(1 for _, v, _ in embedded_results if v)
            if valid_count == len(embedded_results):
                result["valid"] = True
            else:
                for _, valid, err in embedded_results:
                    if not valid:
                        result["errors"].append(f"Embedded block error: {err}")
        else:
            result["errors"].append("No JSON/YAML blocks found in Markdown")

    else:
        result["errors"].append(f"Unsupported file format: {suffix}")
        result["format"] = "unknown"

    return result


def validate_directory(dir_path: Path, pattern: str = "*.{json,yaml,yml,jsonl}", auto_fix: bool = False) -> list[dict]:
    """Validate all matching files in a directory."""
    results = []
    for file_path in dir_path.rglob(pattern):
        result = validate_file(file_path, auto_fix)
        results.append(result)
    return results


def print_results(results: list[dict], format_type: str = "text"):
    """Print validation results."""
    if format_type == "json":
        print(json.dumps(results, indent=2))
        return

    valid_count = sum(1 for r in results if r["valid"])
    invalid_count = len(results) - valid_count
    fixed_count = sum(1 for r in results if r["fixed"])

    print(f"\n{'='*60}")
    print(f"Validation Report")
    print(f"{'='*60}")
    print(f"Total files: {len(results)}")
    print(f"Valid:       {valid_count}")
    print(f"Invalid:     {invalid_count}")
    if fixed_count > 0:
        print(f"Auto-fixed:  {fixed_count}")
    print(f"{'='*60}\n")

    for result in results:
        status = "✅" if result["valid"] else "❌"
        if result["fixed"]:
            status = "🔧"

        print(f"{status} {result['path']}")
        print(f"   Format: {result['format']}")
        print(f"   Size:   {result['size_bytes']} bytes")

        if result["errors"]:
            print(f"   Errors:")
            for err in result["errors"]:
                print(f"      - {err}")

        if result["fixed"]:
            print(f"   [AUTO-FIXED]")

        print()


def main():
    parser = argparse.ArgumentParser(
        description="JSON/YAML Validator & Auto-Fixer"
    )
    parser.add_argument(
        "target",
        help="File or directory to validate"
    )
    parser.add_argument(
        "--fix", "-f",
        action="store_true",
        help="Attempt to auto-fix common errors"
    )
    parser.add_argument(
        "--pattern", "-p",
        default="*.{json,yaml,yml,jsonl}",
        help="File pattern (default: *.{json,yaml,yml,jsonl})"
    )
    parser.add_argument(
        "--output", "-o",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)"
    )
    parser.add_argument(
        "--recursive", "-r",
        action="store_true",
        help="Recursively scan directories"
    )

    args = parser.parse_args()

    target = Path(args.target)

    if not target.exists():
        print(f"Error: {target} does not exist")
        sys.exit(1)

    if target.is_file():
        results = [validate_file(target, args.fix)]
    elif target.is_dir():
        if args.recursive:
            results = validate_directory(target, args.pattern, args.fix)
        else:
            results = validate_directory(target, args.pattern, args.fix)
    else:
        print(f"Error: {target} is not a file or directory")
        sys.exit(1)

    print_results(results, args.output)

    # Exit with error code if any invalid files found
    if any(not r["valid"] and not r["fixed"] for r in results):
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
