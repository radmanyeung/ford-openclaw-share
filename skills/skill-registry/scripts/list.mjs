#!/usr/bin/env node
/**
 * List Skills
 * Display all registered skills
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');

/**
 * Load global registry
 */
export function loadRegistry() {
  const registryPath = path.join(SKILLS_DIR, 'skills-registry.json');
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  }
  return { skills: {} };
}

/**
 * Get all skill directories
 */
export function getAllSkills() {
  const skills = [];
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = path.join(SKILLS_DIR, entry.name);
      if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
        skills.push(entry.name);
      }
    }
  }
  
  return skills;
}

/**
 * Format skills as table
 */
export function formatAsTable(skills, registry) {
  const lines = [];
  lines.push('SKILL                    VERSION   TAGS');
  lines.push('-'.repeat(60));
  
  for (const skill of skills) {
    const meta = registry.skills[skill] || {};
    const version = meta.version || '?.?.?';
    const tags = (meta.tags || []).slice(0, 3).join(', ');
    
    const line = skill.padEnd(24) + 
                 version.padEnd(10) + 
                 (tags || '-');
    lines.push(line);
  }
  
  lines.push('-'.repeat(60));
  lines.push(`Total: ${skills.length} skills`);
  
  return lines.join('\n');
}

/**
 * Main CLI
 */
export function main(args) {
  const format = args[0] || 'table';
  const allSkills = getAllSkills();
  const registry = loadRegistry();
  
  if (format === 'json') {
    console.log(JSON.stringify({
      skills: allSkills,
      registry
    }, null, 2));
  } else {
    console.log(formatAsTable(allSkills, registry));
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
