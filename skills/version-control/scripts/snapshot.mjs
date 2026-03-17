#!/usr/bin/env node
/**
 * snapshot.mjs - Create, list, and restore skill snapshots
 * 
 * Usage:
 *   node scripts/snapshot.mjs --skill <skill-name> --action <create|list|restore>
 *   node scripts/snapshot.mjs --skill <skill-name> --action restore --snapshot <id>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');
const SNAPSHOTS_DIR = path.join(__dirname, '..', '..', 'snapshots');

// Ensure snapshots directory exists
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    skill: null,
    action: null,
    snapshot: null,
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skill' && args[i + 1]) config.skill = args[++i];
    else if (arg === '--action' && args[i + 1]) config.action = args[++i];
    else if (arg === '--snapshot' && args[i + 1]) config.snapshot = args[++i];
    else if (arg === '--verbose' || arg === '-v') config.verbose = true;
  }
  
  return config;
}

/**
 * Calculate file hash for integrity verification
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get all files in a skill directory recursively
 */
function getSkillFiles(skillPath) {
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
          content: fs.readFileSync(fullPath, 'utf8'),
          hash: calculateHash(fs.readFileSync(fullPath))
        });
      }
    }
  }
  
  scanDir(skillPath);
  return files;
}

/**
 * Create a snapshot of a skill
 */
function createSnapshot(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName);
  
  if (!fs.existsSync(skillPath)) {
    console.error(`❌ Skill not found: ${skillName}`);
    process.exit(1);
  }
  
  const snapshotId = `${skillName}-${Date.now()}`;
  const skillFiles = getSkillFiles(skillPath);
  
  const snapshot = {
    id: snapshotId,
    skill: skillName,
    created: new Date().toISOString(),
    version: null, // Will be populated from registry if available
    files: skillFiles,
    fileCount: skillFiles.length,
    totalSize: skillFiles.reduce((sum, f) => sum + f.content.length, 0)
  };
  
  // Save snapshot
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  
  console.log(`✅ Snapshot created: ${snapshotId}`);
  console.log(`   Files: ${snapshot.fileCount}`);
  console.log(`   Size: ${(snapshot.totalSize / 1024).toFixed(2)} KB`);
  console.log(`   Path: ${snapshotPath}`);
  
  return snapshot;
}

/**
 * List all snapshots for a skill
 */
function listSnapshots(skillName) {
  const skillSnapshots = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.startsWith(`${skillName}-`) && f.endsWith('.json'))
    .map(f => {
      const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf8');
      return JSON.parse(content);
    })
    .sort((a, b) => new Date(b.created) - new Date(a.created));
  
  if (skillSnapshots.length === 0) {
    console.log(`📭 No snapshots found for skill: ${skillName}`);
    return [];
  }
  
  console.log(`📸 Snapshots for "${skillName}":\n`);
  console.log('ID'.padEnd(30) + 'Created'.padEnd(25) + 'Files');
  console.log('-'.repeat(70));
  
  for (const snap of skillSnapshots) {
    const date = new Date(snap.created).toLocaleString();
    console.log(snap.id.padEnd(30) + date.padEnd(25) + snap.fileCount);
  }
  
  return skillSnapshots;
}

/**
 * Restore a skill from a snapshot
 */
function restoreSnapshot(skillName, snapshotId) {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);
  
  if (!fs.existsSync(snapshotPath)) {
    console.error(`❌ Snapshot not found: ${snapshotId}`);
    process.exit(1);
  }
  
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const skillPath = path.join(SKILLS_DIR, skillName);
  
  // Backup current state first
  const backupId = `${skillName}-backup-${Date.now()}`;
  const backupFiles = getSkillFiles(skillPath);
  const backup = {
    id: backupId,
    skill: skillName,
    created: new Date().toISOString(),
    files: backupFiles,
    restoredFrom: snapshotId
  };
  fs.writeFileSync(
    path.join(SNAPSHOTS_DIR, `${backupId}.json`), 
    JSON.stringify(backup, null, 2)
  );
  console.log(`💾 Current state backed up: ${backupId}`);
  
  // Remove current skill files
  if (fs.existsSync(skillPath)) {
    fs.rmSync(skillPath, { recursive: true, force: true });
  }
  fs.mkdirSync(skillPath, { recursive: true });
  
  // Restore files from snapshot
  for (const file of snapshot.files) {
    const filePath = path.join(skillPath, file.path);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, file.content);
  }
  
  console.log(`✅ Restored "${skillName}" from snapshot: ${snapshotId}`);
  console.log(`   Files restored: ${snapshot.files.length}`);
  console.log(`   Backup saved: ${backupId} (for manual cleanup if needed)`);
}

/**
 * Main execution
 */
function main() {
  const config = parseArgs();
  
  if (!config.skill || !config.action) {
    console.log(`
📸 Skill Snapshot Manager

Usage:
  node scripts/snapshot.mjs --skill <skill-name> --action <action> [options]

Actions:
  create    Create a new snapshot of the skill
  list      List all snapshots for a skill
  restore   Restore skill from a snapshot

Options:
  --skill <name>     Name of the skill
  --action <action>  Action to perform
  --snapshot <id>    Snapshot ID for restore action
  --verbose, -v      Show detailed output

Examples:
  node scripts/snapshot.mjs --skill version-control --action create
  node scripts/snapshot.mjs --skill version-control --action list
  node scripts/snapshot.mjs --skill version-control --action restore --snapshot version-control-1234567890
`);
    process.exit(config.skill ? 0 : 1);
  }
  
  switch (config.action) {
    case 'create':
      createSnapshot(config.skill);
      break;
    case 'list':
      listSnapshots(config.skill);
      break;
    case 'restore':
      if (!config.snapshot) {
        console.error('❌ --snapshot <id> required for restore action');
        process.exit(1);
      }
      restoreSnapshot(config.skill, config.snapshot);
      break;
    default:
      console.error(`❌ Unknown action: ${config.action}`);
      process.exit(1);
  }
}

main();
