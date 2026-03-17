#!/usr/bin/env node
/**
 * Search Skills
 * Find skills by name, tag, or description
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
      fullMeta: content.substring(0, 500)
    };
  }
  
  return { name: skillName, description: '', fullMeta: '' };
}

/**
 * Search skills by query
 */
export function searchSkills(query, registry) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  // Search by name and description in registry
  for (const [skillName, meta] of Object.entries(registry.skills || {})) {
    const nameMatch = skillName.toLowerCase().includes(queryLower);
    const descMatch = meta.description?.toLowerCase().includes(queryLower);
    const tagsMatch = (meta.tags || []).some(t => t.toLowerCase().includes(queryLower));
    
    if (nameMatch || descMatch || tagsMatch) {
      results.push({
        name: skillName,
        matchedOn: nameMatch ? 'name' : descMatch ? 'description' : 'tags',
        score: nameMatch ? 3 : descMatch ? 2 : 1,
        ...meta
      });
    }
  }
  
  // Sort by score
  results.sort((a, b) => b.score - a.score);
  
  return results;
}

/**
 * Main CLI
 */
export function main(args) {
  const query = args[0];
  
  if (!query) {
    console.log(`
Search Skills

Usage: node search.mjs <query>

Examples:
  node search.mjs context
  node search.mjs "version control"
  node search.mjs api
`);
    process.exit(1);
  }
  
  const registry = loadRegistry();
  const results = searchSkills(query, registry);
  
  if (args.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Search results for "${query}":\n`);
    
    if (results.length === 0) {
      console.log('No skills found.');
    } else {
      for (const r of results) {
        console.log(`📦 ${r.name}`);
        console.log(`   ${r.description || 'No description'}`);
        if (r.tags?.length) {
          console.log(`   Tags: ${r.tags.join(', ')}`);
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
