#!/usr/bin/env node
/**
 * Validate Dependency Graph
 * Detects circular dependencies and missing dependencies
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
 * Build full dependency graph
 */
export function buildGraph() {
  const skills = fs.readdirSync(SKILLS_DIR)
    .filter(f => fs.existsSync(path.join(SKILLS_DIR, f, 'SKILL.md')));
  
  const graph = {};
  
  for (const skill of skills) {
    const deps = loadDependencies(skill);
    graph[skill] = {
      name: skill,
      hard: deps?.dependencies?.hard || [],
      soft: deps?.dependencies?.soft || [],
      optional: deps?.dependencies?.optional || []
    };
  }
  
  return graph;
}

/**
 * Detect circular dependencies using DFS
 */
export function detectCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  
  function dfs(node, path = []) {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }
    
    if (visited.has(node)) return;
    
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const hardDeps = graph[node]?.hard || [];
    for (const dep of hardDeps) {
      if (graph[dep]) {
        dfs(dep, [...path]);
      }
    }
    
    recursionStack.delete(node);
  }
  
  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}

/**
 * Check for missing dependencies
 */
export function checkMissingDependencies(graph) {
  const missing = [];
  const allSkills = new Set(Object.keys(graph));
  
  for (const skill of Object.keys(graph)) {
    const hardDeps = graph[skill]?.hard || [];
    const softDeps = graph[skill]?.soft || [];
    
    for (const dep of [...hardDeps, ...softDeps]) {
      if (!allSkills.has(dep)) {
        missing.push({
          skill,
          missing: dep,
          type: hardDeps.includes(dep) ? 'hard' : 'soft'
        });
      }
    }
  }
  
  return missing;
}

/**
 * Main CLI
 */
export function main(args) {
  const graph = buildGraph();
  const cycles = detectCycles(graph);
  const missing = checkMissingDependencies(graph);
  
  const result = {
    valid: cycles.length === 0 && missing.length === 0,
    cycles: cycles,
    missing: missing
  };
  
  console.log(JSON.stringify(result, null, 2));
  
  if (cycles.length > 0) {
    console.log('\nCircular dependencies found:');
    for (const cycle of cycles) {
      console.log('  ' + cycle.join(' → '));
    }
  }
  
  if (missing.length > 0) {
    console.log('\nMissing dependencies:');
    for (const m of missing) {
      console.log(`  [${m.skill}] requires ${m.missing} (${m.type})`);
    }
  }
  
  if (result.valid) {
    console.log('\n✅ Dependency graph is valid');
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
