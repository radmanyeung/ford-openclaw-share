#!/usr/bin/env node
/**
 * Auto-Detect Dependencies
 * Scans SKILL.md files to auto-detect skill references
 * Usage: node scripts/auto-detect-deps.mjs [--write]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');

const WRITE = process.argv.includes('--write');

/**
 * Get all skill directories
 */
function getAllSkills() {
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
 * Extract skill references from SKILL.md content
 */
function extractReferences(content, allSkills) {
  const references = new Set();
  
  // Match patterns like "skill-name", [[skill-name]], or "See skill-name"
  for (const skill of allSkills) {
    // Skip self-references
    if (content.includes(skill)) {
      // Only count if it's clearly referencing another skill
      const patterns = [
        new RegExp(`\\[${skill}\\]`, 'i'),
        new RegExp(`"${skill}"`, 'i'),
        new RegExp(`'${skill}'`, 'i'),
        new RegExp(`${skill}-skill`, 'i'),
        new RegExp(`skill/${skill}`, 'i'),
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          references.add(skill);
          break;
        }
      }
    }
  }
  
  return [...references];
}

/**
 * Scan all skills and detect references
 */
function autoDetect() {
  const skills = getAllSkills();
  const results = {};
  
  console.log('=== Auto-Detecting Skill Dependencies ===\n');
  
  for (const skill of skills) {
    const skillMd = path.join(SKILLS_DIR, skill, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    
    const content = fs.readFileSync(skillMd, 'utf-8');
    const refs = extractReferences(content, skills);
    
    // Filter out self-reference
    const filtered = refs.filter(r => r !== skill);
    
    if (filtered.length > 0) {
      results[skill] = filtered;
      console.log(`${skill} → ${filtered.join(', ')}`);
    }
  }
  
  console.log(`\n📊 Total: ${Object.keys(results).length} skills with detected references`);
  
  // Write to dependencies.json if requested
  if (WRITE) {
    console.log('\n💾 Writing to dependencies.json...');
    for (const [skill, deps] of Object.entries(results)) {
      const depsPath = path.join(SKILLS_DIR, skill, 'dependencies.json');
      let existing = {};
      
      if (fs.existsSync(depsPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(depsPath, 'utf-8'));
        } catch {}
      }
      
      // Merge with existing
      existing[skill] = existing[skill] || {};
      existing[skill].version = existing[skill].version || "1.0.0";
      existing[skill].dependencies = existing[skill].dependencies || {};
      existing[skill].dependencies.soft = [...new Set([
        ...(existing[skill].dependencies.soft || []),
        ...deps
      ])];
      
      fs.writeFileSync(depsPath, JSON.stringify(existing, null, 2) + '\n');
    }
    console.log('✅ Done!');
  }
  
  return results;
}

autoDetect();
