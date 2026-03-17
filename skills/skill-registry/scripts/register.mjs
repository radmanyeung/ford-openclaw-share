#!/usr/bin/env node
/**
 * Register Skill
 * Add or remove skills from the global registry
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(SKILLS_DIR, 'skills-registry.json');

/**
 * Load global registry
 */
export function loadRegistry() {
  if (fs.existsSync(REGISTRY_PATH)) {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  }
  return { skills: {}, tags: {}, lastUpdated: null };
}

/**
 * Save global registry
 */
export function saveRegistry(registry) {
  registry.lastUpdated = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Read skill metadata from registry.json
 */
export function readSkillRegistry(skillName) {
  const regPath = path.join(SKILLS_DIR, skillName, 'registry.json');
  if (fs.existsSync(regPath)) {
    return JSON.parse(fs.readFileSync(regPath, 'utf-8'));
  }
  return null;
}

/**
 * Register a skill
 */
export function registerSkill(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName);
  
  if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
    return { success: false, error: 'Skill not found' };
  }
  
  const skillReg = readSkillRegistry(skillName);
  if (!skillReg || !skillReg.skills) {
    return { success: false, error: 'No registry.json found for skill' };
  }
  
  const registry = loadRegistry();
  const skillInfo = skillReg.skills[skillName];
  
  if (!skillInfo) {
    return { success: false, error: 'Skill not in registry.json' };
  }
  
  // Add to registry
  registry.skills[skillName] = {
    name: skillInfo.name,
    description: skillInfo.description,
    version: skillInfo.version,
    tags: skillInfo.tags || [],
    author: skillInfo.author,
    created: skillInfo.created,
    path: skillPath
  };
  
  // Add to tags index
  for (const tag of (skillInfo.tags || [])) {
    if (!registry.tags[tag]) registry.tags[tag] = [];
    if (!registry.tags[tag].includes(skillName)) {
      registry.tags[tag].push(skillName);
    }
  }
  
  saveRegistry(registry);
  
  return { success: true, skill: skillName };
}

/**
 * Unregister a skill
 */
export function unregisterSkill(skillName) {
  const registry = loadRegistry();
  
  if (!registry.skills[skillName]) {
    return { success: false, error: 'Skill not in registry' };
  }
  
  const tags = registry.skills[skillName].tags || [];
  
  // Remove from tags index
  for (const tag of tags) {
    if (registry.tags[tag]) {
      registry.tags[tag] = registry.tags[tag].filter(s => s !== skillName);
      if (registry.tags[tag].length === 0) {
        delete registry.tags[tag];
      }
    }
  }
  
  // Remove from skills
  delete registry.skills[skillName];
  
  saveRegistry(registry);
  
  return { success: true, skill: skillName };
}

/**
 * Main CLI
 */
export function main(args) {
  const command = args[0];
  const skillName = args[1];
  
  if (!command || !skillName) {
    console.log(`
Register Skill

Usage: 
  node register.mjs add <skill-name>
  node register.mjs remove <skill-name>

Examples:
  node register.mjs add context-compression
  node register.mjs remove skill-a
`);
    process.exit(1);
  }
  
  let result;
  
  if (command === 'add' || command === 'register') {
    result = registerSkill(skillName);
  } else if (command === 'remove' || command === 'unregister') {
    result = unregisterSkill(skillName);
  } else {
    console.log(`Unknown command: ${command}`);
    process.exit(1);
  }
  
  if (result.success) {
    console.log(`✅ ${command === 'add' ? 'Registered' : 'Unregistered'}: ${skillName}`);
  } else {
    console.log(`❌ Error: ${result.error}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
