#!/usr/bin/env node
/**
 * View OpenClaw Configuration
 * Display current configuration from all sources
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME || process.env.USERPROFILE;

/**
 * Find openclaw.json in workspace
 */
export function findWorkspaceConfig() {
  const paths = [
    path.join(__dirname, '..', '..', 'openclaw.json'),
    path.join(process.cwd(), 'openclaw.json'),
    '/home/ubuntu/.openclaw/workspace/openclaw.json'
  ];
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  }
  return null;
}

/**
 * Get gateway config path
 */
export function getGatewayConfigPath() {
  return path.join(HOME, '.config', 'openclaw', 'config.json');
}

/**
 * Load gateway config
 */
export function loadGatewayConfig() {
  const configPath = getGatewayConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      return { error: 'Invalid JSON in gateway config' };
    }
  }
  return null;
}

/**
 * Get environment variables relevant to OpenClaw
 */
export function getRelevantEnv() {
  const prefix = 'OPENCLAW_';
  const env = {};
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix)) {
      env[key] = value;
    }
  }
  
  return env;
}

/**
 * Main CLI
 */
export function main(args) {
  const showJson = args.includes('--json');
  const showEnv = args.includes('--env');
  
  const workspaceConfig = findWorkspaceConfig();
  const gatewayConfig = loadGatewayConfig();
  const envVars = getRelevantEnv();
  
  const config = {
    workspace: workspaceConfig,
    gateway: gatewayConfig,
    environment: showEnv ? envVars : Object.keys(envVars),
    sources: {
      workspace: workspaceConfig ? 'found' : 'not found',
      gateway: gatewayConfig ? 'found' : 'not found'
    }
  };
  
  if (showJson) {
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log('📋 OpenClaw Configuration\n');
    console.log('Sources:');
    console.log(`  Workspace: ${config.sources.workspace}`);
    console.log(`  Gateway:   ${config.sources.gateway}`);
    
    if (workspaceConfig) {
      console.log('\n📁 Workspace Config (openclaw.json):');
      console.log(JSON.stringify(workspaceConfig, null, 2));
    }
    
    if (gatewayConfig && !gatewayConfig.error) {
      console.log('\n🔧 Gateway Config:');
      console.log(JSON.stringify(gatewayConfig, null, 2));
    }
    
    if (showEnv && Object.keys(envVars).length > 0) {
      console.log('\n🌍 Environment Variables:');
      for (const [key, value] of Object.entries(envVars)) {
        console.log(`  ${key}=${value}`);
      }
    }
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
