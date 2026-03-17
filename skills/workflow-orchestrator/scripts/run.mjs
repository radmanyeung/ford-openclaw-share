#!/usr/bin/env node
/**
 * Workflow Runner Script
 * 
 * Usage:
 *   node run.mjs --file <workflow.json> [--inputs '{}'] [--dry-run] [--resume <stepId>]
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { executeWorkflow } = await import('../lib/executor.mjs');

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const file = getArg('--file') || getArg('-f');
const inputsStr = getArg('--inputs') || getArg('-i') || '{}';
const dryRun = args.includes('--dry-run');
const resume = getArg('--resume');

if (!file) {
  console.error(`Usage: node run.mjs --file <workflow.json> [options]

Options:
  --file, -f <path>      Workflow definition file (required)
  --inputs, -i <json>    Input variables as JSON
  --dry-run              Preview execution without running
  --resume <stepId>      Resume from specific step
`);
  process.exit(1);
}

// Load workflow
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const workflow = JSON.parse(readFileSync(file, 'utf-8'));
const inputs = JSON.parse(inputsStr);

console.log('## Workflow Execution');
console.log(`Name: ${workflow.name}`);
console.log(`Version: ${workflow.version}`);
console.log(`Description: ${workflow.description || 'N/A'}`);
console.log(`Steps: ${workflow.steps.length}`);
console.log(`Entry: ${workflow.entry}`);
console.log('');

if (dryRun) {
  console.log('## Dry Run - Steps Preview');
  workflow.steps.forEach((step, i) => {
    console.log(`${i + 1}. ${step.id} (${step.type})`);
    console.log(`   Name: ${step.name || 'N/A'}`);
    console.log(`   On Success: ${step.onSuccess || 'end'}`);
    console.log(`   On Failure: ${step.onFailure || 'stop'}`);
  });
  console.log('');
  console.log('Dry run complete. Use without --dry-run to execute.');
  process.exit(0);
}

// Execute workflow
console.log('## Starting Execution\n');

executeWorkflow(workflow, inputs, resume)
  .then(result => {
    console.log('\n## Execution Complete');
    console.log(`Execution ID: ${result.executionId}`);
    console.log(`Status: ${result.status}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n## Execution Failed');
    console.error(`Error: ${error.message}`);
    console.error('\nUse --resume to continue from failure point');
    process.exit(1);
  });
