#!/usr/bin/env node
/**
 * Validate OpenClaw Configuration
 * Check configuration against schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load configuration
 */
export function loadConfig() {
  const paths = [
    path.join(__dirname, '..', '..', 'openclaw.json'),
    path.join(process.cwd(), 'openclaw.json'),
    process.env.HOME + '/.openclaw/workspace/openclaw.json'
  ];
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch (e) {
        return { error: `Invalid JSON at ${p}: ${e.message}` };
      }
    }
  }
  return null;
}

/**
 * Validate against basic schema rules
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  
  if (!config) {
    return { valid: false, errors: ['No configuration found'], warnings: [] };
  }
  
  // Check gateway settings
  if (config.gateway) {
    if (config.gateway.port && (config.gateway.port < 1 || config.gateway.port > 65535)) {
      errors.push('gateway.port must be between 1 and 65535');
    }
    if (config.gateway.host && typeof config.gateway.host !== 'string') {
      errors.push('gateway.host must be a string');
    }
  }
  
  // Check models
  if (config.models) {
    if (config.models.default && typeof config.models.default !== 'string') {
      errors.push('models.default must be a string');
    }
    if (config.models.maxTokens && typeof config.models.maxTokens !== 'number') {
      errors.push('models.maxTokens must be a number');
    }
    if (config.models.maxTokens && config.models.maxTokens > 200000) {
      warnings.push('models.maxTokens exceeds recommended 200k limit');
    }
  }
  
  // Check memory settings
  if (config.memory) {
    if (config.memory.contextLimit && typeof config.memory.contextLimit !== 'number') {
      errors.push('memory.contextLimit must be a number');
    }
    if (config.memory.compression !== undefined && typeof config.memory.compression !== 'boolean') {
      errors.push('memory.compression must be a boolean');
    }
  }
  
  // Check channels
  if (config.channels) {
    for (const [channel, settings] of Object.entries(config.channels)) {
      if (settings && typeof settings !== 'object') {
        errors.push(`channels.${channel} must be an object`);
      }
    }
  }
  
  // Recommendations
  if (!config.memory?.contextLimit) {
    warnings.push('Consider setting memory.contextLimit (recommended: 200000)');
  }
  if (!config.models?.default) {
    warnings.push('Consider setting models.default provider');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validated: config
  };
}

/**
 * Main CLI
 */
export function main(args) {
  const config = loadConfig();
  const result = validateConfig(config);
  
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.valid) {
      console.log('✅ Configuration is valid\n');
    } else {
      console.log('❌ Configuration has errors:\n');
      for (const err of result.errors) {
        console.log(`  - ${err}`);
      }
      console.log('');
    }
    
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:\n');
      for (const w of result.warnings) {
        console.log(`  - ${w}`);
      }
    }
    
    if (result.valid && result.warnings.length === 0) {
      console.log('All checks passed!');
    }
  }
  
  process.exit(result.valid ? 0 : 1);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
