#!/usr/bin/env node
/**
 * Edit OpenClaw Configuration
 * Modify configuration values
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Find and load workspace config
 */
export function loadWorkspaceConfig() {
  const paths = [
    path.join(__dirname, '..', '..', 'openclaw.json'),
    path.join(process.cwd(), 'openclaw.json'),
    '/home/ubuntu/.openclaw/workspace/openclaw.json'
  ];
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return { config: JSON.parse(fs.readFileSync(p, 'utf-8')), path: p };
    }
  }
  
  // Create default config location
  return { config: {}, path: '/home/ubuntu/.openclaw/workspace/openclaw.json' };
}

/**
 * Set value by dot notation path
 */
export function setValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  // Try to parse value as JSON (for booleans, numbers, etc.)
  try {
    current[keys[keys.length - 1]] = JSON.parse(value);
  } catch {
    current[keys[keys.length - 1]] = value;
  }
}

/**
 * Main CLI
 */
export function main(args) {
  const keyPath = args[0];
  const value = args[1];
  
  if (!keyPath || !value) {
    console.log(`
Edit OpenClaw Configuration

Usage: node edit.mjs <path> <value>

Examples:
  node edit.mjs models.default "openai/gpt-4"
  node edit.mjs memory.contextLimit 100000
  node edit.mjs memory.compression true

Path uses dot notation:
  models.default
  channels.webchat.enabled
`);
    process.exit(1);
  }
  
  const { config, path: configPath } = loadWorkspaceConfig();
  
  console.log(`Editing: ${keyPath}`);
  console.log(`Old value: ${JSON.stringify(config[keyPath] || 'undefined')}`);
  
  setValue(config, keyPath, value);
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  
  console.log(`✅ Saved to: ${configPath}`);
  console.log(`New value: ${value}`);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
