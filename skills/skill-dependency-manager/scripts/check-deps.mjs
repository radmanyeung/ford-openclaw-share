#!/usr/bin/env node
/**
 * Check Dependencies
 * Verifies if all dependencies for a skill are met
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');

/**
 * Load registry to get installed skills
 */
export function loadRegistry() {
  const registryPath = path.join(SKILLS_DIR, 'skills-registry.json');
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  }
  return { skills: {} };
}

/**
 * Load dependencies.json for a specific skill
 */
export function loadDependencies(skillName) {
  const depsPath = path.join(SKILLS_DIR, skillName, 'dependencies.json');
  if (fs.existsSync(depsPath)) {
    return JSON.parse(fs.readFileSync(depsPath, 'utf-8'));
  }
  return null;
}

/**
 * Check if a skill is installed
 */
export function isSkillInstalled(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName);
  return fs.existsSync(skillPath) && fs.existsSync(path.join(skillPath, 'SKILL.md'));
}

/**
 * Check dependencies for a skill
 */
export function checkDependencies(skillName) {
  const deps = loadDependencies(skillName);
  const installed = loadRegistry().skills;
  
  if (!deps) {
    return {
      skill: skillName,
      status: 'no-dependencies',
      missing: [],
      installed: Object.keys(installed)
    };
  }
  
  const missing = [];
  const installedDeps = [];
  
  // Check hard dependencies
  for (const dep of (deps.dependencies?.hard || [])) {
    if (!isSkillInstalled(dep)) {
      missing.push({ name: dep, type: 'hard' });
    } else {
      installedDeps.push(dep);
    }
  }
  
  // Check soft dependencies
  const softMissing = (deps.dependencies?.soft || []).filter(d => !isSkillInstalled(d));
  
  // Check optional dependencies
  const optionalMissing = (deps.dependencies?.optional || []).filter(d => !isSkillInstalled(d));
  
  return {
    skill: skillName,
    status: missing.length === 0 ? 'ok' : 'missing-dependencies',
    hardDeps: deps.dependencies?.hard || [],
    softDeps: deps.dependencies?.soft || [],
    optionalDeps: deps.dependencies?.optional || [],
    missing: missing,
    softMissing,
    optionalMissing,
    installed: installedDeps
  };
}

/**
 * Main CLI
 */
export function main(args) {
  const skillName = args[0];
  
  if (!skillName) {
    console.log(`
Check Dependencies

Usage: node check-deps.mjs <skill-name>

Example:
  node check-deps.mjs skill-a
`);
    process.exit(1);
  }
  
  const result = checkDependencies(skillName);
  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
