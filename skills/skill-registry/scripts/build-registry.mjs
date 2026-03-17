#!/usr/bin/env node
/**
 * Build Global Registry
 * Scan all skills and build a centralized registry
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(SKILLS_DIR, 'skills-registry.json');

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
 * Parse YAML frontmatter from SKILL.md
 */
function parseSkillFrontmatter(skillPath) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return null;
  
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      
      // Handle array-like values (dependencies, tags)
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value.replace(/[\[\]"]/g, '').split(',').map(t => t.trim()).filter(Boolean);
      } else {
        frontmatter[key] = value;
      }
    }
  }
  return frontmatter;
}

/**
 * Read skill's local registry.json
 */
export function readSkillRegistry(skillName) {
  const regPath = path.join(SKILLS_DIR, skillName, 'registry.json');
  if (fs.existsSync(regPath)) {
    return JSON.parse(fs.readFileSync(regPath, 'utf-8'));
  }
  return null;
}

/**
 * Build global registry from all skills
 */
export function buildRegistry() {
  const skills = getAllSkills();
  const registry = {
    skills: {},
    tags: {},
    lastUpdated: new Date().toISOString()
  };
  
  for (const skillName of skills) {
    const skillReg = readSkillRegistry(skillName);
    const skillPath = path.join(SKILLS_DIR, skillName);
    const frontmatter = parseSkillFrontmatter(skillPath);
    
    if (skillReg?.skills?.[skillName]) {
      const info = skillReg.skills[skillName];
      
      registry.skills[skillName] = {
        name: info.name,
        description: info.description,
        version: info.version || '1.0.0',
        tags: info.tags || [],
        author: info.author || 'unknown',
        created: info.created || 'unknown',
        path: skillPath
      };
      
      // Index by tags
      for (const tag of (info.tags || [])) {
        if (!registry.tags[tag]) registry.tags[tag] = [];
        if (!registry.tags[tag].includes(skillName)) {
          registry.tags[tag].push(skillName);
        }
      }
    } else if (frontmatter?.name) {
      // Use frontmatter from SKILL.md
      registry.skills[skillName] = {
        name: frontmatter.name || skillName,
        description: frontmatter.description || 'No description',
        version: frontmatter.version || 'unknown',
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : (frontmatter.tags ? frontmatter.tags.replace(/[\[\]"]/g, '').split(',').map(t => t.trim()).filter(Boolean) : []),
        dependencies: Array.isArray(frontmatter.dependencies) ? frontmatter.dependencies : [],
        author: 'unknown',
        created: 'unknown',
        path: skillPath
      };
    } else {
      // Skill without registry.json - create basic entry
      registry.skills[skillName] = {
        name: skillName,
        description: 'No description',
        version: 'unknown',
        tags: [],
        author: 'unknown',
        created: 'unknown',
        path: skillPath
      };
    }
  }
  
  return registry;
}

/**
 * Save registry
 */
export function saveRegistry(registry) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Main CLI
 */
export function main(args) {
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  const registry = buildRegistry();
  
  if (dryRun) {
    console.log('Dry run - would create registry with:');
    console.log(`  ${Object.keys(registry.skills).length} skills`);
    console.log(`  ${Object.keys(registry.tags).length} tags`);
    console.log(JSON.stringify(registry, null, 2));
  } else {
    saveRegistry(registry);
    console.log(`✅ Built registry with ${Object.keys(registry.skills).length} skills`);
    console.log(`   Saved to: ${REGISTRY_PATH}`);
    
    if (verbose) {
      console.log('\nTags:');
      for (const [tag, skills] of Object.entries(registry.tags)) {
        console.log(`  ${tag}: ${skills.join(', ')}`);
      }
    }
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
