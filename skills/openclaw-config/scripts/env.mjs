#!/usr/bin/env node
/**
 * List OpenClaw Environment Variables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

/**
 * Get all OPENCLAW_* variables
 */
export function getOpenclawEnv() {
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
 * Get effective config from environment
 */
export function getEffectiveConfig() {
  const env = getOpenclawEnv();
  
  return {
    provider: {
      OPENCLAW_PROVIDER: env.OPENCLAW_PROVIDER,
      OPENCLAW_PROVIDER_API_KEY: env.OPENCLAW_PROVIDER_API_KEY ? '***' : undefined
    },
    model: {
      OPENCLAW_MODEL: env.OPENCLAW_MODEL,
      OPENCLAW_MODEL_ENDPOINT: env.OPENCLAW_MODEL_ENDPOINT
    },
    gateway: {
      OPENCLAW_HOST: env.OPENCLAW_HOST,
      OPENCLAW_PORT: env.OPENCLAW_PORT,
      OPENCLAW_TOKEN: env.OPENCLAW_TOKEN ? '***' : undefined
    },
    channels: {
      OPENCLAW_TELEGRAM_TOKEN: env.OPENCLAW_TELEGRAM_TOKEN ? '***' : undefined,
      OPENCLAW_DISCORD_TOKEN: env.OPENCLAW_DISCORD_TOKEN ? '***' : undefined,
      OPENCLAW_WHATSAPP_SESSION: env.OPENCLAW_WHATSAPP_SESSION
    },
    features: {
      OPENCLAW_SPEECH_ENABLED: env.OPENCLAW_SPEECH_ENABLED,
      OPENCLAW_WEB_SEARCH: env.OPENCLAW_WEB_SEARCH,
      OPENCLAW_COMPRESSION: env.OPENCLAW_COMPRESSION
    }
  };
}

/**
 * Main CLI
 */
export function main(args) {
  const json = args.includes('--json');
  const all = args.includes('--all');
  
  if (all) {
    // Show raw environment variables
    const env = getOpenclawEnv();
    
    if (json) {
      console.log(JSON.stringify(env, null, 2));
    } else {
      console.log('🌍 OpenClaw Environment Variables:\n');
      if (Object.keys(env).length === 0) {
        console.log('  No OPENCLAW_* variables set');
      } else {
        for (const [key, value] of Object.entries(env)) {
          const display = key.includes('TOKEN') || key.includes('KEY') ? '***' : value;
          console.log(`${key}=${display}`);
        }
      }
    }
  } else {
    // Show effective config
    const config = getEffectiveConfig();
    
    if (json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('⚙️  OpenClaw Environment Configuration:\n');
      
      for (const [section, values] of Object.entries(config)) {
        console.log(`📌 ${section.toUpperCase()}:`);
        for (const [key, value] of Object.entries(values)) {
          if (value !== undefined) {
            console.log(`   ${key}: ${value}`);
          }
        }
        console.log('');
      }
    }
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
