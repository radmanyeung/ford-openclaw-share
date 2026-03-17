#!/usr/bin/env node
/**
 * List Dependencies
 * Shows all skills and their declared dependencies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..');

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
 * Load dependencies.json for a skill
 */
export function loadDependencies(skillName) {
  const depsPath = path.join(SKILLS_DIR, skillName, 'dependencies.json');
  if (fs.existsSync(depsPath)) {
    return JSON.parse(fs.readFileSync(depsPath, 'utf-8'));
  }
  return null;
}

/**
 * Build dependency graph
 */
export function buildDependencyGraph() {
  const skills = getAllSkills();
  const graph = {
    skills: {},
    dependencies: {},
    dependents: {}
  };
  
  // Initialize
  for (const skill of skills) {
    graph.skills[skill] = { name: skill, installed: true };
    graph.dependencies[skill] = [];
    graph.dependents[skill] = [];
  }
  
  // Build edges
  for (const skill of skills) {
    const deps = loadDependencies(skill);
    if (deps && deps.dependencies) {
      const allDeps = [
        ...(deps.dependencies.hard || []),
        ...(deps.dependencies.soft || []),
        ...(deps.dependencies.optional || [])
      ];
      
      for (const dep of allDeps) {
        graph.dependencies[skill].push({ name: dep, type: deps.dependencies.hard?.includes(dep) ? 'hard' : 'soft' });
        
        if (graph.dependents[dep]) {
          graph.dependents[dep].push(skill);
        }
      }
    }
  }
  
  return graph;
}

/**
 * Format output as table
 */
export function formatAsTable(graph) {
  const lines = [];
  lines.push('SKILL                    HARD    SOFT    OPTIONAL');
  lines.push('-'.repeat(55));
  
  for (const skill of Object.keys(graph.skills)) {
    const deps = graph.dependencies[skill];
    const hard = deps.filter(d => d.type === 'hard').map(d => d.name);
    const soft = deps.filter(d => d.type === 'soft').map(d => d.name);
    const optional = deps.filter(d => d.type === 'optional').map(d => d.name);
    
    const line = skill.padEnd(24) + 
                 (hard.join(', ') || '-').padEnd(10) + 
                 (soft.join(', ') || '-').padEnd(10) + 
                 (optional.join(', ') || '-');
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * Main CLI
 */
export function main(args) {
  const graph = buildDependencyGraph();
  const format = args[0] || 'table';
  
  if (format === 'json') {
    console.log(JSON.stringify(graph, null, 2));
  } else {
    console.log(formatAsTable(graph));
    
    console.log('\nLegend:');
    console.log('  - Skill has no dependencies');
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
