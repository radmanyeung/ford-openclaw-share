#!/usr/bin/env node
/**
 * Check OpenClaw Gateway Status
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Check if gateway is running
 */
export function checkGatewayStatus() {
  try {
    // Try to get gateway status
    const result = execSync('openclaw gateway status 2>&1', { encoding: 'utf-8' });
    return { running: true, output: result };
  } catch (e) {
    return { running: false, error: e.message };
  }
}

/**
 * Check listening ports
 */
export function checkPorts() {
  try {
    const result = execSync('ss -tlnp 2>/dev/null | grep -E "(3000|8080)" || echo "No matching ports"', { encoding: 'utf-8' });
    return result.trim();
  } catch {
    return 'Unable to check ports';
  }
}

/**
 * Main CLI
 */
export function main(args) {
  const verbose = args.includes('--verbose');
  
  console.log('🔍 OpenClaw Gateway Status\n');
  
  const status = checkGatewayStatus();
  
  if (status.running) {
    console.log('✅ Gateway: RUNNING');
    if (verbose) {
      console.log('\n' + status.output);
    }
  } else {
    console.log('❌ Gateway: NOT RUNNING');
    console.log(`\nError: ${status.error}`);
    
    console.log('\nTo start gateway:');
    console.log('  openclaw gateway start');
  }
  
  console.log('\n📡 Checking ports...');
  const ports = checkPorts();
  console.log(ports || '  No OpenClaw ports found');
  
  console.log('\nUseful commands:');
  console.log('  openclaw gateway status');
  console.log('  openclaw gateway start');
  console.log('  openclaw gateway stop');
  console.log('  openclaw gateway restart');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
