#!/usr/bin/env node
/**
 * Workflow Status Script
 * 
 * Usage:
 *   node status.mjs --executionId <id>
 *   node status.mjs --recent <count>
 *   node status.mjs --workflow <name>
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = process.env.WORKFLOW_STATE_DIR || join(__dirname, '..', '..', '..', 'tmp', 'workflows');

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const executionId = getArg('--executionId') || getArg('-e');
const recent = getArg('--recent') || getArg('-r');
const workflowName = getArg('--workflow') || getArg('-w');
const format = getArg('--format') || 'text';

// Load state file
function loadState(execId) {
  const stateFile = join(STATE_DIR, `${execId}.json`);
  if (!existsSync(stateFile)) return null;
  return JSON.parse(readFileSync(stateFile, 'utf-8'));
}

// List recent executions
function listRecent(count = 10) {
  if (!existsSync(STATE_DIR)) {
    console.log('No executions found');
    return [];
  }
  
  const files = readdirSync(STATE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const state = loadState(f.replace('.json', ''));
      return state;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, count);
  
  return files;
}

// Format state for display
function formatState(state) {
  const duration = state.endTime 
    ? Math.round((new Date(state.endTime) - new Date(state.startTime)) / 1000)
    : Math.round((Date.now() - new Date(state.startTime)) / 1000);
  
  return {
    executionId: state.executionId,
    workflow: state.workflow,
    version: state.version,
    status: state.status,
    currentStep: state.currentStep,
    duration: `${duration}s`,
    startTime: state.startTime,
    endTime: state.endTime,
    stepCount: Object.keys(state.stepResults).length,
    errors: state.errors.length
  };
}

// Display single execution
function showExecution(execId) {
  const state = loadState(execId);
  
  if (!state) {
    console.error(`Execution not found: ${execId}`);
    process.exit(1);
  }
  
  const formatted = formatState(state);
  
  console.log('## Execution Status');
  console.log(`Execution ID: ${formatted.executionId}`);
  console.log(`Workflow: ${formatted.workflow} v${formatted.version}`);
  console.log(`Status: ${formatted.status.toUpperCase()}`);
  console.log(`Current Step: ${formatted.currentStep || 'N/A'}`);
  console.log(`Duration: ${formatted.duration}`);
  console.log(`Started: ${formatted.startTime}`);
  console.log(`Ended: ${formatted.endTime || 'N/A'}`);
  console.log('');
  
  console.log('## Step Results');
  Object.entries(state.stepResults).forEach(([stepId, result]) => {
    const icon = result.status === 'completed' ? '✓' : result.status === 'failed' ? '✗' : '○';
    const duration = result.duration ? `${result.duration}ms` : '';
    console.log(`${icon} ${stepId}: ${result.status} ${duration}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  if (state.errors.length > 0) {
    console.log('\n## Errors');
    state.errors.forEach((err, i) => {
      console.log(`${i + 1}. [${err.time}] ${err.step}: ${err.error}`);
    });
  }
  
  if (state.context && Object.keys(state.context).length > 0) {
    console.log('\n## Context');
    Object.entries(state.context).forEach(([key, value]) => {
      console.log(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
  }
}

// Display recent executions
function showRecent(count) {
  const executions = listRecent(count);
  
  if (executions.length === 0) {
    console.log('No recent executions found');
    return;
  }
  
  console.log(`## Recent Executions (${executions.length})\n`);
  
  const table = executions.map(e => formatState(e));
  
  // Simple table format
  console.log('Execution ID'.padEnd(30) + 'Workflow'.padEnd(20) + 'Status'.padEnd(12) + 'Duration'.padEnd(10) + 'Steps');
  console.log('-'.repeat(90));
  
  table.forEach(row => {
    console.log(
      row.executionId.padEnd(30) +
      row.workflow.padEnd(20) +
      row.status.padEnd(12) +
      row.duration.padEnd(10) +
      row.stepCount
    );
  });
}

// Main execution
function main() {
  try {
    if (executionId) {
      showExecution(executionId);
    } else if (recent) {
      showRecent(parseInt(recent, 10));
    } else if (workflowName) {
      const executions = listRecent(100).filter(e => e.workflow === workflowName);
      if (executions.length === 0) {
        console.log(`No executions found for workflow: ${workflowName}`);
      } else {
        console.log(`Found ${executions.length} execution(s) for ${workflowName}`);
        executions.slice(0, 10).forEach(e => {
          console.log(`  ${e.executionId} - ${e.status} (${e.startTime})`);
        });
      }
    } else {
      console.error(`Usage: node status.mjs --executionId <id> | --recent <count> | --workflow <name>
      
Options:
  --executionId, -e <id>  Show specific execution
  --recent, -r <count>    Show recent executions
  --workflow, -w <name>   Show executions for workflow
  --format <text|json>    Output format
`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
