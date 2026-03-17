#!/usr/bin/env node
/**
 * Workflow Template Library - Main Script
 * Deploy, manage, and create workflow templates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(SKILL_DIR, 'templates');
const OUTPUT_DIR = process.env.WORKFLOW_OUTPUT || './workflows';

// Ensure directories
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const cmd = args[0] || 'list';

async function main() {
  switch (cmd) {
    case 'list': await listTemplates(); break;
    case 'preview': await previewTemplate(args[1]); break;
    case 'deploy': await deployTemplate(args[1]); break;
    case 'validate': await validateTemplate(args[1]); break;
    case 'create': await createTemplate(args[1]); break;
    case 'export': await exportTemplate(args[1]); break;
    case 'import': await importTemplate(args[1]); break;
    default: showHelp();
  }
}

/**
 * List all available templates
 */
async function listTemplates() {
  const templates = getTemplateList();
  
  console.log('\n📋 Available Templates:\n');
  
  if (templates.length === 0) {
    console.log('  No templates found. Create one with:');
    console.log('    node templates.mjs create <name>\n');
    return;
  }
  
  templates.forEach(t => {
    const meta = loadTemplateMeta(t);
    const status = meta ? '✅' : '⚠️';
    const desc = meta?.description || 'No description';
    console.log(`  ${status} ${t.padEnd(22)} ${desc}`);
  });
  
  console.log('\nUsage:');
  console.log('  node templates.mjs deploy <template> --name my-project\n');
}

/**
 * Preview template configuration
 */
async function previewTemplate(template) {
  if (!template) {
    console.error('❌ Template name required');
    process.exit(1);
  }
  
  const templatePath = path.join(TEMPLATES_DIR, template);
  
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${template}`);
    console.log('Available:', getTemplateList().join(', '));
    process.exit(1);
  }
  
  const meta = loadTemplateMeta(template);
  const structure = loadStructure(template);
  
  console.log(`\n📋 Template: ${template}`);
  console.log(`   Version: ${meta?.version || '1.0.0'}`);
  console.log(`   Description: ${meta?.description || 'No description'}\n`);
  
  console.log('Variables:');
  (meta?.variables || []).forEach(v => {
    const required = v.required !== false ? ' (required)' : '';
    const secret = v.secret ? ' 🔒' : '';
    const def = v.default ? ` [default: ${v.default}]` : '';
    console.log(`   - ${v.name}${required}${secret}`);
    console.log(`     ${v.prompt}${def}`);
  });
  
  console.log('\nFiles generated:');
  (structure?.files || []).forEach(f => {
    console.log(`   - ${f.path.replace('{{PROJECT_NAME}}', '{PROJECT_NAME}')}`);
  });
  
  console.log('\nDirectories:');
  (structure?.directories || []).forEach(d => {
    console.log(`   - ${d.replace('{{PROJECT_NAME}}', '{PROJECT_NAME}')}`);
  });
  
  console.log('');
}

/**
 * Deploy template to workspace
 */
async function deployTemplate(template) {
  if (!template) {
    console.error('❌ Template name required');
    process.exit(1);
  }
  
  const templatePath = path.join(TEMPLATES_DIR, template);
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${template}`);
    process.exit(1);
  }
  
  // Get deployment name
  let name = extractArg(args, '--name');
  if (!name) {
    name = template + '-' + Date.now().toString(36);
    console.log(`Using auto-generated name: ${name}`);
  }
  
  const force = extractArg(args, '--force');
  const targetDir = path.join(OUTPUT_DIR, name);
  
  if (fs.existsSync(targetDir) && !force) {
    console.error(`❌ Directory exists: ${targetDir}`);
    console.log('Use --force to overwrite');
    process.exit(1);
  }
  
  // Extract config variables
  const configArgs = extractArg(args, '--config') || '';
  const configValues = parseConfigArgs(configArgs);
  
  // Load template
  const meta = loadTemplateMeta(template);
  const structure = loadStructure(template);
  
  // Collect variables
  const variables = { PROJECT_NAME: name, ...collectVariables(meta, configValues) };
  
  console.log(`🚀 Deploying template: ${template} → ${name}`);
  
  // Pre-deploy hook
  if (meta?.hooks?.pre_deploy) {
    await executeHook(meta.hooks.pre_deploy, variables);
  }
  
  // Create directories
  (structure?.directories || []).forEach(dir => {
    const resolved = resolveVariables(dir, variables);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
      console.log(`📁 Created: ${resolved}`);
    }
  });
  
  // Generate files
  (structure?.files || []).forEach(file => {
    const targetPath = resolveVariables(file.path, variables);
    const sourcePath = path.join(templatePath, file.template);
    
    if (fs.existsSync(sourcePath)) {
      let content = fs.readFileSync(sourcePath, 'utf-8');
      content = resolveVariables(content, variables);
      
      fs.writeFileSync(targetPath, content);
      console.log(`📄 Generated: ${targetPath}`);
    }
  });
  
  // Post-deploy hook
  if (meta?.hooks?.post_deploy) {
    await executeHook(meta.hooks.post_deploy, variables);
  }
  
  console.log(`\n✅ Deployed successfully: ${targetDir}`);
  console.log('\nNext steps:');
  console.log(`  cd ${targetDir}`);
  console.log('  # Edit config.yaml as needed');
}

/**
 * Validate template structure
 */
async function validateTemplate(template) {
  if (!template) {
    console.error('❌ Template name required');
    process.exit(1);
  }
  
  const templatePath = path.join(TEMPLATES_DIR, template);
  let errors = [];
  
  // Check required files
  const requiredFiles = ['config.yaml', 'structure.yaml'];
  requiredFiles.forEach(f => {
    if (!fs.existsSync(path.join(templatePath, f))) {
      errors.push(`Missing: ${f}`);
    }
  });
  
  // Check structure.yaml
  const structure = loadStructure(template);
  if (structure) {
    if (!structure.files || structure.files.length === 0) {
      errors.push('No files defined in structure.yaml');
    }
  }
  
  // Check file templates exist
  (structure?.files || []).forEach(f => {
    const sourcePath = path.join(templatePath, f.template);
    if (!fs.existsSync(sourcePath)) {
      errors.push(`Template file not found: ${f.template}`);
    }
  });
  
  if (errors.length === 0) {
    console.log(`✅ Template ${template} is valid`);
  } else {
    console.log(`❌ Template ${template} has errors:`);
    errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
}

/**
 * Create new template
 */
async function createTemplate(name) {
  if (!name) {
    console.error('❌ Template name required');
    process.exit(1);
  }
  
  const templatePath = path.join(TEMPLATES_DIR, name);
  
  if (fs.existsSync(templatePath)) {
    console.error(`❌ Template already exists: ${name}`);
    process.exit(1);
  }
  
  fs.mkdirSync(templatePath, { recursive: true });
  
  // Create template.yaml
  const templateYaml = `name: ${name}
version: 1.0.0
description: My custom workflow template

variables:
  - name: PROJECT_NAME
    prompt: "Enter project name"
    required: true

hooks:
  pre_deploy: |
    echo "Preparing deployment..."
  post_deploy: |
    echo "Deployment complete!"
`;

  // Create structure.yaml
  const structureYaml = `directories:
  - "{{PROJECT_NAME}}"
  - "{{PROJECT_NAME}}/scripts"

files:
  - path: "{{PROJECT_NAME}}/config.yaml"
    template: files/config.yaml
  - path: "{{PROJECT_NAME}}/README.md"
    template: files/README.md
`;

  // Create files directory and templates
  fs.mkdirSync(path.join(templatePath, 'files'), { recursive: true });
  
  fs.writeFileSync(path.join(templatePath, 'template.yaml'), templateYaml);
  fs.writeFileSync(path.join(templatePath, 'structure.yaml'), structureYaml);
  fs.writeFileSync(path.join(templatePath, 'files', 'config.yaml'), '# Configuration\n');
  fs.writeFileSync(path.join(templatePath, 'files', 'README.md'), `# ${name}\n\nDescription here.\n`);
  
  console.log(`✅ Created template: ${name}`);
  console.log(`   Location: ${templatePath}`);
  console.log('\nEdit template.yaml and structure.yaml to customize.');
}

/**
 * Export template as portable package
 */
async function exportTemplate(template) {
  if (!template) {
    console.error('❌ Template name required');
    process.exit(1);
  }
  
  const output = extractArg(args, '--output') || '.';
  const templatePath = path.join(TEMPLATES_DIR, template);
  
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${template}`);
    process.exit(1);
  }
  
  const outputPath = path.join(output, `${template}.zip`);
  
  console.log(`📦 Exporting ${template} → ${outputPath}`);
  
  // Simple tar/zip (expand as needed)
  await new Promise((resolve, reject) => {
    const proc = spawn('zip', ['-r', outputPath, template], { cwd: TEMPLATES_DIR });
    proc.on('close', code => code === 0 ? resolve() : reject());
  });
  
  console.log(`✅ Exported: ${outputPath}`);
}

/**
 * Import external template
 */
async function importTemplate(file) {
  if (!file) {
    console.error('❌ File path required');
    process.exit(1);
  }
  
  if (!fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
  }
  
  console.log(`📥 Importing: ${file}`);
  
  // Simple unzip (expand as needed)
  await new Promise((resolve, reject) => {
    const proc = spawn('unzip', [file, '-d', TEMPLATES_DIR]);
    proc.on('close', code => code === 0 ? resolve() : reject());
  });
  
  console.log(`✅ Imported successfully`);
}

// Helper functions
function showHelp() {
  console.log(`
📋 Workflow Template Library

Usage: node templates.mjs <command> [template] [options]

Commands:
  list              List all available templates
  preview <template> Show template configuration
  deploy <template> Deploy template to workspace
  validate <template> Check template validity
  create <name>     Create new custom template
  export <template> Export template as portable file
  import <file>     Import external template

Options:
  --name NAME       Deployment name
  --config KEY=VAL  Config variables (comma-separated)
  --output DIR      Output directory
  --force           Overwrite existing files
  --output          Export output path

Examples:
  node templates.mjs list
  node templates.mjs deploy research-pipeline --name my-research
  node templates.mjs preview data-pipeline
  node templates.mjs create my-custom-template
  node templates.mjs export research-pipeline --output ./share/
`);
}

function getTemplateList() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(f => !f.startsWith('.') && !f.endsWith('.md'));
}

function loadTemplateMeta(template) {
  const metaPath = path.join(TEMPLATES_DIR, template, 'template.yaml');
  if (!fs.existsSync(metaPath)) return null;
  
  const content = fs.readFileSync(metaPath, 'utf-8');
  return parseYaml(content);
}

function loadStructure(template) {
  const structPath = path.join(TEMPLATES_DIR, template, 'structure.yaml');
  if (!fs.existsSync(structPath)) return null;
  
  const content = fs.readFileSync(structPath, 'utf-8');
  return parseYaml(content);
}

function extractArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

function parseConfigArgs(configStr) {
  if (!configStr) return {};
  return Object.fromEntries(configStr.split(',').map(pair => {
    const [k, v] = pair.split('=');
    return [k.trim(), v.trim()];
  }));
}

function collectVariables(meta, configValues) {
  const vars = {};
  if (meta?.variables) {
    meta.variables.forEach(v => {
      if (configValues[v.name]) {
        vars[v.name] = configValues[v.name];
      } else if (v.default) {
        vars[v.name] = v.default;
      } else if (!v.required) {
        vars[v.name] = '';
      }
    });
  }
  return vars;
}

function resolveVariables(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] || `{{${name}}}`);
}

async function executeHook(hook, variables) {
  // Simple shell execution
  const script = resolveVariables(hook, variables);
  console.log(`🔧 Running hook...`);
  // In production, execute with proper shell
}

function parseYaml(yaml) {
  const result = {};
  yaml.split('\n').forEach(line => {
    const match = line.match(/^(\s*)(\w+):\s*(.*)$/);
    if (match) {
      const indent = match[1].length;
      const key = match[2];
      const value = match[3].trim();
      
      if (indent === 0) {
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else if (value) {
          result[key] = value;
        }
      }
    }
  });
  return result;
}

main().catch(console.error);
