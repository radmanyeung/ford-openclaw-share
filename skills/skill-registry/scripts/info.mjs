#!/usr/bin/env node
/**
 * Get Skill Info
 * Display detailed information about a skill
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');

/**
 * Read skill metadata from SKILL.md
 */
export function readSkillMeta(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  
  const content = fs.readFileSync(skillPath, 'utf-8');
  
  // Extract frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const frontmatter = match[1];
    const nameMatch = frontmatter.match(/name:\s*(.+)/);
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    
    return {
      name: skillName,
      description: descMatch ? descMatch[1].trim() : '',
      frontmatter: content.substring(0, 1000)
    };
  }
  
  return { name: skillName, description: content.substring(0, 200) };
}

/**
 * Get skill scripts
 */
export function getSkillScripts(skillName) {
  const scriptsPath = path.join(SKILLS_DIR, skillName, 'scripts');
  if (!fs.existsSync(scriptsPath)) return [];
  
  return fs.readdirSync(scriptsPath)
    .filter(f => f.endsWith('.mjs') || f.endsWith('.js') || f.endsWith('.py'))
    .map(f => ({
      name: f.replace(/\.(mjs|js|py)$/, ''),
      file: f,
      executable: true
    }));
}

/**
 * Get skill references
 */
export function getSkillReferences(skillName) {
  const refsPath = path.join(SKILLS_DIR, skillName, 'references');
  if (!fs.existsSync(refsPath)) return [];
  
  return fs.readdirSync(refsPath).map(f => f);
}

/**
 * Load registry entry
 */
export function getRegistryEntry(skillName) {
  const registryPath = path.join(SKILLS_DIR, 'skills-registry.json');
  if (!fs.existsSync(registryPath)) return null;
  
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  return registry.skills?.[skillName] || null;
}

/**
 * Main CLI
 */
export function main(args) {
  const skillName = args[0];
  
  if (!skillName) {
    console.log(`
Get Skill Info

Usage: node info.mjs <skill-name>

Example:
  node info.mjs context-compression
`);
    process.exit(1);
  }
  
  const skillPath = path.join(SKILLS_DIR, skillName);
  if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
    console.log(`Skill "${skillName}" not found.`);
    process.exit(1);
  }
  
  const meta = readSkillMeta(skillName);
  const scripts = getSkillScripts(skillName);
  const refs = getSkillReferences(skillName);
  const registry = getRegistryEntry(skillName);
  
  const info = {
    name: skillName,
    ...meta,
    version: registry?.version || 'unknown',
    author: registry?.author || 'unknown',
    created: registry?.created || 'unknown',
    tags: registry?.tags || [],
    scripts,
    references: refs,
    path: skillPath
  };
  
  if (args.includes('--json')) {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(`📦 ${info.name}`);
    console.log('='.repeat(50));
    console.log(`Description: ${info.description}`);
    console.log(`Version: ${info.version}`);
    console.log(`Author: ${info.author}`);
    console.log(`Created: ${info.created}`);
    console.log(`Path: ${info.path}`);
    
    if (info.tags.length) {
      console.log(`\nTags: ${info.tags.join(', ')}`);
    }
    
    if (info.scripts.length) {
      console.log(`\nScripts:`);
      for (const s of info.scripts) {
        console.log(`  - ${s.name} (${s.file})`);
      }
    }
    
    if (info.references.length) {
      console.log(`\nReferences:`);
      for (const r of info.references) {
        console.log(`  - ${r}`);
      }
    }
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
