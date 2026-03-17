#!/usr/bin/env node
/**
 * Resolve Dependencies
 * Install or report missing dependencies for a skill
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');

/**
 * Load dependencies for a skill
 */
export function loadDependencies(skillName) {
  const depsPath = path.join(SKILLS_DIR, skillName, 'dependencies.json');
  if (fs.existsSync(depsPath)) {
    return JSON.parse(fs.readFileSync(depsPath, 'utf-8'));
  }
  return null;
}

/**
 * Check if skill exists
 */
export function skillExists(skillName) {
  return fs.existsSync(path.join(SKILLS_DIR, skillName));
}

/**
 * Resolve and report status
 */
export function resolveDependencies(skillName) {
  const deps = loadDependencies(skillName);
  
  if (!deps) {
    return {
      skill: skillName,
      status: 'no-deps-file',
      actions: []
    };
  }
  
  const actions = [];
  const hardDeps = deps.dependencies?.hard || [];
  const softDeps = deps.dependencies?.soft || [];
  
  // Check hard dependencies
  for (const dep of hardDeps) {
    if (skillExists(dep)) {
      actions.push({ action: 'ok', skill: dep, reason: 'hard dependency installed' });
    } else {
      actions.push({ action: 'install', skill: dep, reason: 'hard dependency missing' });
    }
  }
  
  // Check soft dependencies
  for (const dep of softDeps) {
    if (skillExists(dep)) {
      actions.push({ action: 'ok', skill: dep, reason: 'soft dependency installed' });
    } else {
      actions.push({ action: 'warn', skill: dep, reason: 'soft dependency missing (optional)' });
    }
  }
  
  const allHardInstalled = hardDeps.every(d => skillExists(d));
  
  return {
    skill: skillName,
    status: allHardInstalled ? 'ready' : 'missing-hard-deps',
    canProceed: allHardInstalled,
    actions
  };
}

/**
 * Main CLI
 */
export function main(args) {
  const skillName = args[0];
  
  if (!skillName) {
    console.log(`
Resolve Dependencies

Usage: node resolve-deps.mjs <skill-name>

Example:
  node resolve-deps.mjs skill-a
`);
    process.exit(1);
  }
  
  const result = resolveDependencies(skillName);
  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
