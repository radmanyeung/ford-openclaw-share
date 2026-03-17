#!/usr/bin/env node
/**
 * Schema Validator - Auto-fix JSON/YAML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

class SchemaValidator {
  constructor(options = {}) {
    this.checkOnly = options.checkOnly || false;
    this.verbose = options.verbose || false;
    this.fixCount = 0;
  }

  log(msg, color = RESET) {
    console.log(`${color}${msg}${RESET}`);
  }

  // Detect file type
  getFileType(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    if (['.json'].includes(ext)) return 'json';
    if (['.yaml', '.yml'].includes(ext)) return 'yaml';
    if (ext === '.md') return 'markdown';
    return 'unknown';
  }

  // Extract JSON from markdown frontmatter
  extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return match[1];
  }

  // Validate JSON
  validateJson(content, filepath) {
    const errors = [];
    const warnings = [];

    try {
      JSON.parse(content);
      return { valid: true, errors: [], warnings: [] };
    } catch (e) {
      const match = e.message.match(/position (\d+)/);
      const pos = match ? parseInt(match[1]) : -1;

      // Common error patterns
      if (e.message.includes('Unexpected token')) {
        const lines = content.substring(0, pos).split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length;

        errors.push({
          line,
          column: col,
          code: 'SYNTAX_ERROR',
          message: e.message,
          suggestion: 'Check for missing quotes, trailing commas, or brackets'
        });
      }

      return { valid: false, errors, warnings };
    }
  }

  // Auto-fix JSON
  fixJson(content) {
    let fixed = content;

    // Remove trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Fix missing quotes on keys (simple pattern)
    fixed = fixed.replace(/(\w+):(\s*[^{[\d])/g, '"$1":$2');

    return fixed;
  }

  // Validate YAML
  validateYaml(content) {
    const errors = [];
    const warnings = [];

    try {
      // Simple YAML validation (check for basic structure)
      const lines = content.split('\n');
      let inList = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for inconsistent indentation
        if (line.match(/^(\s+)- /)) {
          if (!inList) inList = true;
        } else if (line.match(/^\s+[^-\s]/)) {
          if (inList && line.match(/^\s{2}[^ ]/)) {
            warnings.push({
              line: i + 1,
              code: 'INDENT_WARNING',
              message: 'Potential indentation inconsistency'
            });
          }
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    } catch (e) {
      errors.push({
        line: 1,
        code: 'YAML_ERROR',
        message: e.message
      });
      return { valid: false, errors, warnings };
    }
  }

  // Validate markdown with frontmatter
  validateMarkdown(content, filepath) {
    const errors = [];
    const warnings = [];
    const frontmatter = this.extractFrontmatter(content);

    if (!frontmatter) {
      return { valid: true, hasFrontmatter: false };
    }

    // Check if frontmatter is valid
    const fmType = this.getFileType(filepath);
    if (fmType === 'json') {
      const result = this.validateJson(frontmatter, filepath);
      if (!result.valid) {
        result.errors.forEach(e => {
          e.message = `[Frontmatter] ${e.message}`;
        });
      }
      return { ...result, hasFrontmatter: true };
    }

    return { valid: true, hasFrontmatter: true, errors: [], warnings: [] };
  }

  // Validate a single file
  validateFile(filepath) {
    if (!fs.existsSync(filepath)) {
      return { valid: false, error: 'File not found', path: filepath };
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const type = this.getFileType(filepath);
    let result;

    switch (type) {
      case 'json':
        result = this.validateJson(content, filepath);
        break;
      case 'yaml':
        result = this.validateYaml(content, filepath);
        break;
      case 'markdown':
        result = this.validateMarkdown(content, filepath);
        break;
      default:
        return { valid: true, skipped: true, reason: 'Unsupported format' };
    }

    return { ...result, path: filepath, type };
  }

  // Auto-fix a file
  fixFile(filepath) {
    const type = this.getFileType(filepath);

    if (type === 'json') {
      const content = fs.readFileSync(filepath, 'utf8');
      const fixed = this.fixJson(content);
      fs.writeFileSync(filepath, fixed);
      this.fixCount++;
      return true;
    }

    return false;
  }

  // Batch validate directory
  validateDirectory(dirPath, recursive = true) {
    const results = [];

    const scan = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.json', '.yaml', '.yml', '.md'].includes(ext)) {
            results.push(this.validateFile(fullPath));
          }
        }
      }
    };

    scan(dirPath);
    return results;
  }
}

// CLI interface
const args = process.argv.slice(2);
const options = {
  checkOnly: args.includes('--check') || args.includes('--check-only'),
  fix: args.includes('--fix'),
  verbose: args.includes('--verbose'),
  dir: null,
  file: null
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--dir' && args[i + 1]) {
    options.dir = args[++i];
  } else if (!arg.startsWith('--')) {
    options.file = arg;
  }
}

const validator = new SchemaValidator(options);
let exitCode = 0;

if (options.file) {
  // Single file mode
  const result = validator.validateFile(options.file);

  if (result.valid) {
    validator.log(`✓ ${result.path}`, GREEN);
  } else {
    validator.log(`✗ ${result.path}`, RED);
    result.errors?.forEach(e => {
      validator.log(`  Line ${e.line}: ${e.message}`, RED);
    });
    exitCode = 1;
  }

  if (options.fix && !result.valid && result.type === 'json') {
    if (validator.fixFile(options.file)) {
      validator.log(`  Fixed: ${result.path}`, CYAN);
    }
  }
} else if (options.dir) {
  // Directory mode
  const results = validator.validateDirectory(options.dir);

  const invalid = results.filter(r => !r.valid);
  const valid = results.filter(r => r.valid);

  if (options.verbose) {
    valid.forEach(r => validator.log(`✓ ${r.path}`, GREEN));
  }

  invalid.forEach(r => {
    validator.log(`✗ ${r.path}`, RED);
    r.errors?.forEach(e => {
      validator.log(`  Line ${e.line}: ${e.message}`, RED);
    });
  });

  if (invalid.length === 0) {
    validator.log(`All ${valid.length} files valid`, GREEN);
  } else {
    validator.log(`${invalid.length} invalid, ${valid.length} valid`, RED);
    exitCode = 1;
  }

  if (options.fix && invalid.length > 0) {
    validator.log(`\nApplying fixes...`, YELLOW);
    invalid.forEach(r => {
      if (r.type === 'json' && validator.fixFile(r.path)) {
        validator.log(`  Fixed: ${r.path}`, CYAN);
      }
    });
    validator.log(`\n${validator.fixCount} files fixed`, CYAN);
  }
} else {
  console.log('Usage: node validate.mjs <file> [--fix]');
  console.log('       node validate.mjs --dir <path> [--fix]');
  console.log('Options:');
  console.log('  --check, --check-only  Check without fixing');
  console.log('  --fix                  Auto-fix errors');
  console.log('  --verbose              Show valid files');
  process.exit(2);
}

process.exit(exitCode);
