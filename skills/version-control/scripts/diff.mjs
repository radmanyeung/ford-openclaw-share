#!/usr/bin/env node
/**
 * diff.mjs - Compare skill versions and show changes
 * 
 * Usage:
 *   node scripts/diff.mjs --skill <skill-name> --from <version> --to <version>
 *   node scripts/diff.mjs --skill <skill-name> --from <version> --current
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');
const SNAPSHOTS_DIR = path.join(__dirname, '..', '..', 'snapshots');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    skill: null,
    from: null,
    to: null,
    current: false,
    json: false,
    stat: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skill' && args[i + 1]) config.skill = args[++i];
    else if (arg === '--from' && args[i + 1]) config.from = args[++i];
    else if (arg === '--to' && args[i + 1]) config.to = args[++i];
    else if (arg === '--current') config.current = true;
    else if (arg === '--json') config.json = true;
    else if (arg === '--stat' || arg === '-s') config.stat = true;
  }
  
  return config;
}

/**
 * Load registry to get skill versions
 */
function loadRegistry() {
  const registryPath = path.join(__dirname, '..', 'registry.json');
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  }
  return null;
}

/**
 * Get version info from registry
 */
function getVersionInfo(skillName, version) {
  const registry = loadRegistry();
  if (!registry?.skills?.[skillName]) return null;
  
  const skill = registry.skills[skillName];
  return skill.versions.find(v => v.version === version);
}

/**
 * Get the current version of a skill
 */
function getCurrentVersion(skillName) {
  const registry = loadRegistry();
  if (registry?.skills?.[skillName]) {
    return registry.skills[skillName].current;
  }
  
  // Fallback: look for snapshot with latest timestamp
  const snapshots = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.startsWith(`${skillName}-`) && f.endsWith('.json'))
    .map(f => ({
      name: f,
      time: parseInt(f.replace(`${skillName}-`, '').replace('.json', ''))
    }))
    .sort((a, b) => b.time - a.time);
  
  return snapshots[0]?.time ? new Date(snapshots[0].time).toISOString() : 'unknown';
}

/**
 * Load skill files from a snapshot
 */
function loadFromSnapshot(skillName, timestamp) {
  const snapshotId = `${skillName}-${timestamp}`;
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);
  
  if (!fs.existsSync(snapshotPath)) {
    // Try to find by version
    const registry = loadRegistry();
    if (registry?.skills?.[skillName]) {
      const versionInfo = registry.skills[skillName].versions.find(v => v.version === timestamp);
      if (versionInfo) {
        // Search for snapshot with this version
        const matching = fs.readdirSync(SNAPSHOTS_DIR)
          .filter(f => f.startsWith(`${skillName}-`) && f.endsWith('.json'));
        for (const f of matching) {
          const snap = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf8'));
          if (snap.version === timestamp) {
            return snap.files;
          }
        }
      }
    }
    return null;
  }
  
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  return snapshot.files;
}

/**
 * Load skill files from current skill directory
 */
function loadFromDirectory(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName);
  if (!fs.existsSync(skillPath)) return null;
  
  const files = [];
  
  function scanDir(dir, basePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (entry.isDirectory()) {
        scanDir(fullPath, relativePath);
      } else if (entry.isFile()) {
        files.push({
          path: relativePath,
          content: fs.readFileSync(fullPath, 'utf8')
        });
      }
    }
  }
  
  scanDir(skillPath);
  return files;
}

/**
 * Compute diff between two file lists
 */
function computeDiff(oldFiles, newFiles) {
  const oldMap = new Map(oldFiles.map(f => [f.path, f.content]));
  const newMap = new Map(newFiles.map(f => [f.path, f.content]));
  
  const changes = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  };
  
  // Check for added and modified
  for (const [path, content] of newMap) {
    if (!oldMap.has(path)) {
      changes.added.push({ path, content });
    } else if (oldMap.get(path) !== content) {
      changes.modified.push({ 
        path, 
        oldContent: oldMap.get(path), 
        newContent: content 
      });
    } else {
      changes.unchanged.push({ path });
    }
  }
  
  // Check for removed
  for (const [path] of oldMap) {
    if (!newMap.has(path)) {
      changes.removed.push({ path, content: oldMap.get(path) });
    }
  }
  
  return changes;
}

/**
 * Format diff for console output
 */
function formatDiff(changes, statOnly = false) {
  const lines = [];
  
  // Summary
  lines.push(`📊 Diff Summary:`);
  lines.push(`   Added:    ${changes.added.length} file(s)`);
  lines.push(`   Removed:  ${changes.removed.length} file(s)`);
  lines.push(`   Modified: ${changes.modified.length} file(s)`);
  lines.push('');
  
  if (statOnly) return lines.join('\n');
  
  // Details
  if (changes.added.length > 0) {
    lines.push(`🟢 Added Files:`);
    for (const f of changes.added) {
      lines.push(`   + ${f.path}`);
    }
    lines.push('');
  }
  
  if (changes.removed.length > 0) {
    lines.push(`🔴 Removed Files:`);
    for (const f of changes.removed) {
      lines.push(`   - ${f.path}`);
    }
    lines.push('');
  }
  
  if (changes.modified.length > 0) {
    lines.push(`🟡 Modified Files:`);
    for (const f of changes.modified) {
      lines.push(`   ~ ${f.path}`);
      
      // Show line diff
      const oldLines = f.oldContent.split('\n');
      const newLines = f.newContent.split('\n');
      const maxLines = Math.max(oldLines.length, newLines.length);
      let changesCount = 0;
      
      for (let i = 0; i < maxLines; i++) {
        if (oldLines[i] !== newLines[i]) {
          changesCount++;
          if (changesCount <= 5) { // Limit output
            lines.push(`     Line ${i + 1}:`);
            if (oldLines[i] !== undefined) lines.push(`       - ${oldLines[i].substring(0, 80)}`);
            if (newLines[i] !== undefined) lines.push(`       + ${newLines[i].substring(0, 80)}`);
          }
        }
      }
      
      if (changesCount > 5) {
        lines.push(`     ... and ${changesCount - 5} more line(s)`);
      }
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
  const config = parseArgs();
  
  if (!config.skill || (!config.from && !config.current)) {
    console.log(`
📊 Skill Version Diff

Usage:
  node scripts/diff.mjs --skill <skill-name> --from <version> --to <version>
  node scripts/diff.mjs --skill <skill-name> --from <version> --current

Options:
  --skill <name>    Name of the skill
  --from <version>  Source version (timestamp or "current")
  --to <version>    Target version (timestamp)
  --current         Compare against current working directory
  --json            Output in JSON format
  --stat, -s        Show only statistics

Examples:
  node scripts/diff.mjs --skill version-control --from 1.1.0 --to 1.2.0
  node scripts/diff.mjs --skill version-control --from 1.1.0 --current --stat
`);
    process.exit(config.skill ? 0 : 1);
  }
  
  // Load source files
  let oldFiles;
  if (config.from === 'current') {
    oldFiles = loadFromDirectory(config.skill);
    if (!oldFiles) {
      console.error(`❌ Could not load current files for skill: ${config.skill}`);
      process.exit(1);
    }
  } else {
    oldFiles = loadFromSnapshot(config.skill, config.from);
    if (!oldFiles) {
      console.error(`❌ Could not find version: ${config.from}`);
      process.exit(1);
    }
  }
  
  // Load target files
  let newFiles;
  if (config.to) {
    if (config.to === 'current') {
      newFiles = loadFromDirectory(config.skill);
    } else {
      newFiles = loadFromSnapshot(config.skill, config.to);
    }
  } else {
    // Default to current directory
    newFiles = loadFromDirectory(config.skill);
  }
  
  if (!newFiles) {
    console.error(`❌ Could not find version: ${config.to || 'current'}`);
    process.exit(1);
  }
  
  // Compute and display diff
  const changes = computeDiff(oldFiles, newFiles);
  
  if (config.json) {
    console.log(JSON.stringify(changes, null, 2));
  } else {
    console.log(formatDiff(changes, config.stat));
  }
}

main();
