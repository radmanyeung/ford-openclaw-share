#!/usr/bin/env node
/**
 * Task Dependency Graph Manager
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKILLS_DIR = path.join(__dirname, '../../../../skills');

// ANSI colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

class DependencyGraph {
  constructor() {
    this.graph = new Map(); // skill -> dependencies
    this.reverseGraph = new Map(); // skill -> dependents
    this.visited = new Set();
    this.inStack = new Set();
    this.cycles = [];
  }

  log(msg, color = RESET) {
    console.log(`${color}${msg}${RESET}`);
  }

  // Load all skills and their dependencies
  loadAll() {
    if (!fs.existsSync(SKILLS_DIR)) {
      this.log('Skills directory not found', RED);
      return;
    }

    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        this.loadSkill(entry.name);
      }
    }

    // Build reverse graph
    for (const [skill, deps] of this.graph) {
      for (const dep of deps.hard.concat(deps.soft).concat(deps.optional || [])) {
        const depName = dep.split('@')[0];
        if (!this.reverseGraph.has(depName)) {
          this.reverseGraph.set(depName, []);
        }
        this.reverseGraph.get(depName).push(skill);
      }
    }
  }

  // Load single skill dependencies
  loadSkill(skillName) {
    const depsPath = path.join(SKILLS_DIR, skillName, 'dependencies.json');

    if (!fs.existsSync(depsPath)) {
      // Check SKILL.md for inline dependencies
      const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf8');
        const match = content.match(/depends?\s+on\s+([^\n]+)/i);
        if (match) {
          this.graph.set(skillName, {
            version: 'auto',
            dependencies: { hard: [], soft: [], optional: [] }
          });
        }
      }
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(depsPath, 'utf8'));
      const skillData = data[skillName] || data;
      this.graph.set(skillName, skillData);
    } catch (e) {
      this.log(`Error loading ${skillName}: ${e.message}`, RED);
    }
  }

  // Detect cycles using DFS
  detectCycles() {
    this.cycles = [];
    this.visited = new Set();
    this.inStack = new Set();

    for (const node of this.graph.keys()) {
      if (!this.visited.has(node)) {
        this.dfs(node);
      }
    }

    return this.cycles;
  }

  dfs(node) {
    this.visited.add(node);
    this.inStack.add(node);

    const deps = this.graph.get(node);
    const allDeps = [
      ...(deps?.dependencies?.hard || []),
      ...(deps?.dependencies?.soft || []),
      ...(deps?.dependencies?.optional || [])
    ];

    for (const dep of allDeps) {
      const depName = dep.split('@')[0];

      if (!this.visited.has(depName)) {
        if (this.dfs(depName)) return true;
      } else if (this.inStack.has(depName)) {
        // Found cycle
        const cycle = this.getCyclePath(node, depName);
        this.cycles.push(cycle);
        return true;
      }
    }

    this.inStack.delete(node);
    return false;
  }

  getCyclePath(start, end) {
    const path = [end, start];
    let current = start;

    while (true) {
      const deps = this.graph.get(current);
      const allDeps = [
        ...(deps?.dependencies?.hard || []),
        ...(deps?.dependencies?.soft || []),
        ...(deps?.dependencies?.optional || [])
      ];

      const parent = alldeps.find(d => d.split('@')[0] === end);
      if (!parent) break;

      path.unshift(parent);
      end = current;
      current = parent.split('@')[0];
    }

    return path;
  }

  // Get all dependents of a skill
  getDependents(skillName) {
    const direct = this.reverseGraph.get(skillName) || [];
    const all = new Set(direct);

    for (const dep of direct) {
      this.collectDependents(dep, all);
    }

    return Array.from(all);
  }

  collectDependents(skill, set) {
    const direct = this.reverseGraph.get(skill) || [];
    for (const dep of direct) {
      if (!set.has(dep)) {
        set.add(dep);
        this.collectDependents(dep, set);
      }
    }
  }

  // Get dependency tree
  getTree(skillName, depth = 0, visited = new Set()) {
    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '' : indent + '└─ ';
    const result = [];

    if (visited.has(skillName)) {
      result.push(`${prefix}${skillName} (circular)`);
      return result;
    }
    visited.add(skillName);

    const deps = this.graph.get(skillName);
    const allDeps = [
      ...(deps?.dependencies?.hard || []).map(d => ({ ...d, type: 'hard' })),
      ...(deps?.dependencies?.soft || []).map(d => ({ ...d, type: 'soft' })),
      ...(deps?.dependencies?.optional || []).map(d => ({ ...d, type: 'optional' }))
    ];

    result.push(`${prefix}${skillName}`);

    for (const dep of allDeps) {
      const depName = dep.split('@')[0];
      const typeColor = dep.type === 'hard' ? RED : dep.type === 'soft' ? YELLOW : CYAN;
      const typeMarker = dep.type === 'hard' ? '[!]' : dep.type === 'soft' ? '[~]' : '[?]';

      result.push(`${indent}├── ${typeMarker} `);
      result.push(...this.getTree(depName, depth + 1, visited).map(l =>
        indent + l.replace(/^└─/, '├──')
      ));
    }

    return result;
  }

  // Visualize as ASCII
  visualize() {
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      this.log('\n⚠ Circular dependencies detected!', RED);
      cycles.forEach(c => {
        this.log(`  ${c.join(' → ')}`, RED);
      });
      return;
    }

    this.log('\nDependency Graph:', CYAN);
    this.log('─'.repeat(40));

    const roots = this.findRoots();
    for (const root of roots) {
      const tree = this.getTree(root);
      this.log('');
      tree.forEach(line => {
        const colored = line
          .replace(/\[!\]/g, `${RED}[!]${RESET}`)
          .replace(/\[~\]/g, `${YELLOW}[~]${RESET}`)
          .replace(/\[?\]/g, `${CYAN}[?]${RESET}`);
        this.log(colored);
      });
    }

    this.log('\nLegend: [!] hard  [~] soft  [?] optional', YELLOW);
  }

  // Find root skills (no dependents)
  findRoots() {
    const allSkills = new Set(this.graph.keys());
    for (const deps of this.graph.values()) {
      const allDeps = [
        ...(deps?.dependencies?.hard || []),
        ...(deps?.dependencies?.soft || []),
        ...(deps?.dependencies?.optional || [])
      ];
      allDeps.forEach(d => allSkills.delete(d.split('@')[0]));
    }
    return Array.from(allSkills);
  }

  // Plan safe update order
  planUpdate() {
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      this.log('Cannot plan: circular dependencies detected', RED);
      cycles.forEach(c => this.log(`  ${c.join(' → ')}`, RED));
      return;
    }

    this.log('\nSafe Update Order:', CYAN);
    this.log('─'.repeat(30));

    // Topological sort
    const visited = new Set();
    const order = [];

    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const deps = this.graph.get(node);
      const allDeps = [
        ...(deps?.dependencies?.hard || []),
        ...(deps?.dependencies?.soft || []),
        ...(deps?.dependencies?.optional || [])
      ];

      for (const dep of allDeps) {
        visit(dep.split('@')[0]);
      }

      order.push(node);
    };

    for (const skill of this.graph.keys()) {
      visit(skill);
    }

    order.reverse().forEach((skill, i) => {
      this.log(`${i + 1}. ${skill}`);
    });
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0] || 'visual';
const target = args[1];

const graph = new DependencyGraph();

switch (command) {
  case 'check':
    if (!target) {
      console.log('Usage: node graph.mjs check <skill-name>');
      process.exit(1);
    }
    graph.loadAll();
    const deps = graph.graph.get(target);
    if (deps) {
      console.log(`Dependencies for ${target}:`);
      console.log(JSON.stringify(deps, null, 2));
    } else {
      console.log(`Skill ${target} not found`);
    }
    break;

  case 'tree':
    graph.loadAll();
    const tree = graph.getTree(target || graph.findRoots()[0]);
    tree.forEach(l => console.log(l));
    break;

  case 'visual':
    graph.loadAll();
    graph.visualize();
    break;

  case 'dependents':
    if (!target) {
      console.log('Usage: node graph.mjs dependents <skill-name>');
      process.exit(1);
    }
    graph.loadAll();
    const dependents = graph.getDependents(target);
    console.log(`Skills depending on ${target}:`);
    if (dependents.length === 0) {
      console.log('  (none)');
    } else {
      dependents.forEach(d => console.log(`  - ${d}`));
    }
    break;

  case 'validate':
    graph.loadAll();
    const cycles = graph.detectCycles();
    if (cycles.length === 0) {
      console.log('✓ No circular dependencies detected');
    } else {
      console.log('✗ Circular dependencies found:');
      cycles.forEach(c => console.log(`  ${c.join(' → ')}`));
    }
    break;

  case 'plan':
    graph.loadAll();
    graph.planUpdate();
    break;

  default:
    console.log('Usage: node graph.mjs <command> [args]');
    console.log('');
    console.log('Commands:');
    console.log('  check <skill>      Show dependencies for a skill');
    console.log('  tree [skill]       Show dependency tree');
    console.log('  visual             Show full graph visually');
    console.log('  dependents <skill> Show skills depending on this one');
    console.log('  validate           Check for circular dependencies');
    console.log('  plan               Plan safe update order');
}
