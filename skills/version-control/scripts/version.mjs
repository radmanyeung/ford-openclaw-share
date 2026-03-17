#!/usr/bin/env node
/**
 * Version Control Script for Skills
 * 
 * Usage:
 *   node version.mjs --skill <name> --action <action> [options]
 * 
 * Actions:
 *   create  - Create initial version (1.0.0)
 *   update  - Create new version from current
 *   rollback - Restore previous version
 *   history - List version history
 *   info    - Show version details
 *   validate - Validate version change
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = process.env.SKILL_VERSION_REGISTRY || join(__dirname, '..', 'registry.json');
const SKILLS_DIR = join(__dirname, '..', '..');

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const skillName = getArg('--skill') || getArg('-s');
const action = getArg('--action') || getArg('-a');
const version = getArg('--version') || getArg('-v');
const type = getArg('--type') || getArg('-t');
const step = parseInt(getArg('--step') || '1', 10);
const message = getArg('--message') || getArg('-m');
const dryRun = args.includes('--dry-run');

if (!skillName || !action) {
  console.error(`Usage: node version.mjs --skill <name> --action <action> [options]
  
Actions: create, update, rollback, history, info, validate
Options:
  --skill <name>     Skill name (required)
  --action <action>  Action to perform (required)
  --version X.Y.Z    Specific version
  --type patch|minor|major  Version increment type
  --step N           Number of versions to rollback
  --message "desc"   Version description
  --dry-run          Preview without changes
`);
  process.exit(1);
}

// Load registry
function loadRegistry() {
  if (existsSync(REGISTRY_FILE)) {
    return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'));
  }
  return { skills: {}, lastUpdate: null };
}

function saveRegistry(registry, dryRun = false) {
  if (dryRun) {
    console.log('[DRY-RUN] Would save registry to:', REGISTRY_FILE);
    return;
  }
  registry.lastUpdate = new Date().toISOString();
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

// Calculate file hash
async function calculateHash(filePath) {
  const crypto = await import('crypto');
  const content = readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// Get skill files
function getSkillFiles(skillPath) {
  const files = [];
  function traverse(dir, base = '') {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = join(base, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath, relPath);
      } else if (entry.isFile() && !entry.name.startsWith('.') && !relPath.includes('node_modules')) {
        files.push(relPath);
      }
    }
  }
  traverse(skillPath);
  return files;
}

// Get current version from SKILL.md
function getCurrentVersion(skillPath) {
  const skillMd = join(skillPath, 'SKILL.md');
  if (existsSync(skillMd)) {
    const content = readFileSync(skillMd, 'utf-8');
    const match = content.match(/version:\s*(\d+)\.(\d+)\.(\d+)/i);
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}`;
    }
  }
  return null;
}

// Parse version string
function parseVersion(v) {
  const parts = v.split('.').map(Number);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

// Increment version
function incrementVersion(current, type) {
  const v = parseVersion(current);
  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
    default:
      return `${v.major}.${v.minor}.${v.patch + 1}`;
  }
}

// Compare versions
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

// Create new version
async function createVersion(skillName, newVersion, desc, dryRun = false) {
  const skillPath = join(SKILLS_DIR, skillName);
  const skillMd = join(skillPath, 'SKILL.md');
  
  if (!existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  
  const files = getSkillFiles(skillPath);
  const fileHashes = {};
  
  for (const file of files) {
    fileHashes[file] = await calculateHash(join(skillPath, file));
  }
  
  const versionEntry = {
    version: newVersion,
    date: new Date().toISOString(),
    description: desc || `Version ${newVersion}`,
    files: files,
    hashes: fileHashes,
    createdFrom: 'initial'
  };
  
  const registry = loadRegistry();
  
  if (!registry.skills[skillName]) {
    registry.skills[skillName] = { current: null, versions: [] };
  }
  
  // Add to versions array (newest first)
  registry.skills[skillName].versions.unshift(versionEntry);
  registry.skills[skillName].current = newVersion;
  
  if (!dryRun) {
    saveRegistry(registry);
  }
  
  return versionEntry;
}

// Update version (increment)
async function updateVersion(skillName, incrementType, desc, dryRun = false) {
  const registry = loadRegistry();
  const skill = registry.skills[skillName];
  
  if (!skill || !skill.current) {
    throw new Error(`Skill not found or no current version: ${skillName}`);
  }
  
  const newVersion = incrementVersion(skill.current, incrementType);
  return createVersion(skillName, newVersion, desc, dryRun);
}

// Rollback version
async function rollbackVersion(skillName, targetVersion, dryRun = false) {
  const registry = loadRegistry();
  const skill = registry.skills[skillName];
  
  if (!skill || !skill.versions || skill.versions.length === 0) {
    throw new Error(`No versions found for skill: ${skillName}`);
  }
  
  let versionEntry;
  if (targetVersion) {
    versionEntry = skill.versions.find(v => v.version === targetVersion);
    if (!versionEntry) {
      throw new Error(`Version not found: ${targetVersion}`);
    }
  } else {
    // Rollback by step count
    if (skill.versions.length <= step) {
      throw new Error(`Cannot rollback ${step} versions, only ${skill.versions.length} available`);
    }
    versionEntry = skill.versions[step]; // Skip current (index 0) + step
  }
  
  console.log(`Rolling back ${skillName} to version ${versionEntry.version}`);
  console.log(`Description: ${versionEntry.description}`);
  console.log(`Date: ${versionEntry.date}`);
  
  // Restore files from hashes if needed
  // For now, just update current pointer
  skill.current = versionEntry.version;
  
  if (!dryRun) {
    saveRegistry(registry);
  }
  
  return versionEntry;
}

// Show history
function showHistory(skillName) {
  const registry = loadRegistry();
  const skill = registry.skills[skillName];
  
  if (!skill || !skill.versions || skill.versions.length === 0) {
    console.log(`No versions found for skill: ${skillName}`);
    return;
  }
  
  console.log(`Version History for: ${skillName}`);
  console.log(`Current: ${skill.current}`);
  console.log('='.repeat(60));
  
  skill.versions.forEach((v, idx) => {
    const marker = idx === 0 ? ' (current)' : '';
    console.log(`${v.version}${marker} - ${v.date}`);
    console.log(`  ${v.description}`);
    console.log(`  Files: ${v.files.length}`);
    console.log();
  });
}

// Show version info
function showVersionInfo(skillName, version) {
  const registry = loadRegistry();
  const skill = registry.skills[skillName];
  
  if (!skill || !skill.versions) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  
  const versionEntry = skill.versions.find(v => v.version === version);
  if (!versionEntry) {
    throw new Error(`Version not found: ${version}`);
  }
  
  console.log(`Version: ${versionEntry.version}`);
  console.log(`Date: ${versionEntry.date}`);
  console.log(`Description: ${versionEntry.description}`);
  console.log(`Files: ${versionEntry.files.length}`);
  console.log('\nFile Hashes:');
  Object.entries(versionEntry.hashes || {}).forEach(([file, hash]) => {
    console.log(`  ${file}: ${hash}`);
  });
}

// Validate version change
async function validateVersion(skillName, newVersion, dryRun = false) {
  const registry = loadRegistry();
  const skill = registry.skills[skillName];
  
  console.log(`Validating version change for: ${skillName}`);
  console.log(`Proposed version: ${newVersion}`);
  
  // Check if skill exists
  const skillPath = join(SKILLS_DIR, skillName);
  if (!existsSync(skillPath)) {
    console.log('❌ Skill directory does not exist');
    return false;
  }
  
  // Check if SKILL.md exists
  const skillMd = join(skillPath, 'SKILL.md');
  if (!existsSync(skillMd)) {
    console.log('❌ SKILL.md not found');
    return false;
  }
  
  // Validate version format
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(newVersion)) {
    console.log('❌ Invalid version format (expected X.Y.Z)');
    return false;
  }
  
  // Check for breaking changes if skill exists
  if (skill && skill.current) {
    const current = parseVersion(skill.current);
    const proposed = parseVersion(newVersion);
    
    if (proposed.major > current.major) {
      console.log('⚠️  MAJOR version bump - this is a breaking change');
      console.log('   Ensure migration guide is documented');
    } else if (proposed.minor > current.minor) {
      console.log('✓ Minor version bump - new features, backward compatible');
    } else if (proposed.patch > current.patch) {
      console.log('✓ Patch version bump - bug fixes only');
    } else {
      console.log('❌ Version must be higher than current');
      return false;
    }
  }
  
  // Validate all files exist
  const files = getSkillFiles(skillPath);
  for (const file of files) {
    const filePath = join(skillPath, file);
    if (!existsSync(filePath)) {
      console.log(`❌ Missing file: ${file}`);
      return false;
    }
  }
  
  console.log('✓ All validations passed');
  return true;
}

// Main execution
async function main() {
  try {
    switch (action) {
      case 'create':
        if (!version) throw new Error('--version required for create');
        const createResult = await createVersion(skillName, version, message, dryRun);
        console.log(`✓ Created version ${createResult.version} for ${skillName}`);
        break;
        
      case 'update':
        if (!type) throw new Error('--type (patch|minor|major) required for update');
        const updateResult = await updateVersion(skillName, type, message, dryRun);
        console.log(`✓ Updated to version ${updateResult.version} for ${skillName}`);
        break;
        
      case 'rollback':
        await rollbackVersion(skillName, version, dryRun);
        console.log(`✓ Rollback complete`);
        break;
        
      case 'history':
        showHistory(skillName);
        break;
        
      case 'info':
        if (!version) throw new Error('--version required for info');
        showVersionInfo(skillName, version);
        break;
        
      case 'validate':
        const nextVersion = version || incrementVersion(
          loadRegistry().skills[skillName]?.current || '1.0.0', 
          type || 'patch'
        );
        await validateVersion(skillName, nextVersion, dryRun);
        break;
        
      default:
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
