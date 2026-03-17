#!/usr/bin/env node
/**
 * orchestrator.mjs - Cross-Platform Workflow Orchestrator
 * 
 * Usage:
 *   node scripts/orchestrator.mjs --action <action> [options]
 * 
 * Actions:
 *   execute  - Run a workflow
 *   list     - List available workflows
 *   show     - Show workflow details
 *   status   - Check execution status
 *   retry    - Retry failed steps
 *   cancel   - Cancel running workflow
 *   create   - Create new workflow
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const RUNS_DIR = path.join(__dirname, '..', 'runs');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Ensure directories exist
[WORKFLOWS_DIR, RUNS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    action: null,
    workflow: null,
    runId: null,
    dryRun: false,
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--action' && args[i + 1]) config.action = args[++i];
    else if (arg === '--workflow' && args[i + 1]) config.workflow = args[++i];
    else if (arg === '--run-id' && args[i + 1]) config.runId = args[++i];
    else if (arg === '--dry-run') config.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') config.verbose = true;
  }
  
  return config;
}

/**
 * Generate unique run ID
 */
function generateRunId() {
  return `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Load workflow definition
 */
function loadWorkflow(name) {
  const workflowPath = path.join(WORKFLOWS_DIR, `${name}.json`);
  if (fs.existsSync(workflowPath)) {
    return JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  }
  return null;
}

/**
 * Save run state
 */
function saveRun(runId, state) {
  const runPath = path.join(RUNS_DIR, `${runId}.json`);
  fs.writeFileSync(runPath, JSON.stringify(state, null, 2));
}

/**
 * Load run state
 */
function loadRun(runId) {
  const runPath = path.join(RUNS_DIR, `${runId}.json`);
  if (fs.existsSync(runPath)) {
    return JSON.parse(fs.readFileSync(runPath, 'utf8'));
  }
  return null;
}

/**
 * Get workflow steps sorted by dependencies (topological)
 */
function getExecutionOrder(steps) {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const visited = new Set();
  const order = [];
  
  function visit(stepId) {
    if (visited.has(stepId)) return;
    
    const step = stepMap.get(stepId);
    if (!step) return;
    
    if (step.dependsOn) {
      for (const dep of step.dependsOn) {
        visit(dep);
      }
    }
    
    visited.add(stepId);
    order.push(step);
  }
  
  for (const step of steps) {
    visit(step.id);
  }
  
  return order;
}

/**
 * Execute a single step
 */
async function executeStep(step, runId, verbose) {
  const startTime = Date.now();
  let result = { status: 'pending' };
  
  if (verbose) {
    console.log(`   🔄 Executing: ${step.name} (${step.id})`);
  }
  
  try {
    result.status = 'running';
    
    switch (step.type) {
      case 'shell':
        // Simulate shell command
        const { exec } = await import('child_process');
        await new Promise((resolve, reject) => {
          exec(step.command, { cwd: __dirname }, (error, stdout, stderr) => {
            result.output = stdout || stderr;
            if (error) {
              result.status = 'failed';
              result.error = error.message;
            } else {
              result.status = 'completed';
            }
            resolve();
          });
        });
        break;
        
      case 'agent':
        // Placeholder for agent execution
        result.output = `[Agent: ${step.agent}] ${JSON.stringify(step.params)}`;
        result.status = 'completed';
        break;
        
      default:
        result.status = 'completed';
        result.output = `Step ${step.id} completed`;
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }
  
  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Action: list - List available workflows
 */
function actionList() {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
  
  console.log(`📋 Available Workflows (${files.length})\n`);
  
  for (const file of files) {
    const workflow = loadWorkflow(file.replace('.json', ''));
    const stepCount = workflow?.steps?.length || 0;
    console.log(`   ${file.replace('.json', '')}: ${workflow?.description || 'No description'} (${stepCount} steps)`);
  }
}

/**
 * Action: show - Show workflow details
 */
function actionShow(config) {
  if (!config.workflow) {
    console.error('❌ --workflow <name> required');
    return;
  }
  
  const workflow = loadWorkflow(config.workflow);
  if (!workflow) {
    console.error(`❌ Workflow not found: ${config.workflow}`);
    return;
  }
  
  console.log(`
📋 Workflow: ${workflow.name}
${workflow.description || 'No description'}

Steps (${workflow.steps.length}):
`);
  
  const order = getExecutionOrder(workflow.steps);
  for (const step of order) {
    const deps = step.dependsOn?.join(', ') || 'none';
    console.log(`   ${step.id.padEnd(15)} ${step.name}`);
    console.log(`      Type: ${step.type} | Depends: ${deps}`);
    if (step.retry) console.log(`      Retry: ${step.retry}x`);
  }
}

/**
 * Action: status - Check execution status
 */
function actionStatus(config) {
  if (!config.runId) {
    console.error('❌ --run-id <id> required');
    return;
  }
  
  const run = loadRun(config.runId);
  if (!run) {
    console.error(`❌ Run not found: ${config.runId}`);
    return;
  }
  
  console.log(`
📊 Run Status: ${config.runId}
==============================
Workflow: ${run.workflowName}
Status:   ${run.status}
Started:  ${new Date(run.startTime).toLocaleString()}
Duration: ${((Date.now() - run.startTime) / 1000).toFixed(1)}s

Steps:
`);
  
  for (const [stepId, result] of Object.entries(run.stepResults || {})) {
    const statusIcon = result.status === 'completed' ? '✅' : 
                       result.status === 'failed' ? '❌' : 
                       result.status === 'running' ? '🔄' : '⏳';
    console.log(`   ${statusIcon} ${stepId}: ${result.status} (${result.duration}ms)`);
    if (result.error) console.log(`      Error: ${result.error}`);
  }
}

/**
 * Action: execute - Run a workflow
 */
async function actionExecute(config) {
  if (!config.workflow) {
    console.error('❌ --workflow <name> required');
    return;
  }
  
  const workflow = loadWorkflow(config.workflow);
  if (!workflow) {
    console.error(`❌ Workflow not found: ${config.workflow}`);
    return;
  }
  
  const runId = generateRunId();
  const run = {
    runId,
    workflowName: config.workflow,
    status: 'running',
    startTime: Date.now(),
    stepResults: {}
  };
  
  console.log(`
🚀 Executing Workflow: ${workflow.name}
   Run ID: ${runId}
   Mode:   ${config.dryRun ? 'DRY RUN' : 'LIVE'}
`);
  
  if (config.dryRun) {
    const order = getExecutionOrder(workflow.steps);
    console.log('Execution order:');
    for (const step of order) {
      console.log(`   ${step.id}: ${step.name} (${step.type})`);
    }
    return;
  }
  
  saveRun(runId, run);
  
  // Execute steps in order
  const order = getExecutionOrder(workflow.steps);
  
  for (const step of order) {
    console.log(`\n📝 Step: ${step.name}`);
    
    // Check dependencies
    if (step.dependsOn) {
      const failedDeps = step.dependsOn.filter(dep => 
        run.stepResults[dep]?.status === 'failed'
      );
      if (failedDeps.length > 0) {
        console.log(`   ⏭️  Skipped - failed dependencies: ${failedDeps.join(', ')}`);
        run.stepResults[step.id] = { status: 'skipped', duration: 0 };
        continue;
      }
    }
    
    // Execute step
    const result = await executeStep(step, runId, config.verbose);
    run.stepResults[step.id] = result;
    saveRun(runId, run);
    
    console.log(`   ${result.status === 'completed' ? '✅' : '❌'} ${result.status} (${result.duration}ms)`);
    if (result.error) console.log(`      ${result.error}`);
    
    // Handle retry on failure
    if (result.status === 'failed' && step.retry) {
      let attempts = 1;
      while (attempts < step.retry && result.status === 'failed') {
        console.log(`   🔄 Retry ${attempts + 1}/${step.retry}...`);
        if (step.retryDelay) await new Promise(r => setTimeout(r, step.retryDelay * 1000));
        const retryResult = await executeStep(step, runId, config.verbose);
        result.status = retryResult.status;
        result.output = retryResult.output;
        result.error = retryResult.error;
        result.duration = (result.duration || 0) + retryResult.duration;
        attempts++;
      }
      run.stepResults[step.id] = result;
      saveRun(runId, run);
      console.log(`   ${result.status === 'completed' ? '✅' : '❌'} ${result.status} after retry (${result.duration}ms)`);
    }
  }
  
  // Determine final status
  const results = Object.values(run.stepResults);
  const allCompleted = results.every(r => r.status === 'completed');
  const anyFailed = results.some(r => r.status === 'failed');
  
  run.status = allCompleted ? 'completed' : anyFailed ? 'failed' : 'partial';
  run.endTime = Date.now();
  saveRun(runId, run);
  
  console.log(`
🏁 Workflow Complete
   Status: ${run.status}
   Duration: ${((run.endTime - run.startTime) / 1000).toFixed(1)}s
   Run ID: ${runId}
`);
}

/**
 * Action: retry - Retry failed steps
 */
async function actionRetry(config) {
  if (!config.runId) {
    console.error('❌ --run-id <id> required');
    return;
  }
  
  const run = loadRun(config.runId);
  if (!run) {
    console.error(`❌ Run not found: ${config.runId}`);
    return;
  }
  
  console.log(`🔄 Retrying failed steps from run: ${config.runId}`);
  
  const workflow = loadWorkflow(run.workflowName);
  const failedSteps = workflow.steps.filter(s => 
    run.stepResults[s.id]?.status === 'failed'
  );
  
  for (const step of failedSteps) {
    const result = await executeStep(step, config.runId, config.verbose);
    run.stepResults[step.id] = result;
    console.log(`   ${result.status === 'completed' ? '✅' : '❌'} ${step.id}: ${result.status}`);
  }
  
  run.status = Object.values(run.stepResults).every(r => r.status === 'completed') 
    ? 'completed' : 'failed';
  saveRun(config.runId, run);
}

/**
 * Action: cancel - Cancel running workflow
 */
function actionCancel(config) {
  if (!config.runId) {
    console.error('❌ --run-id <id> required');
    return;
  }
  
  const run = loadRun(config.runId);
  if (!run) {
    console.error(`❌ Run not found: ${config.runId}`);
    return;
  }
  
  run.status = 'cancelled';
  run.endTime = Date.now();
  saveRun(config.runId, run);
  
  console.log(`✅ Cancelled run: ${config.runId}`);
}

/**
 * Action: create - Create new workflow
 */
function actionCreate(config) {
  console.log(`
📝 Create New Workflow

This action requires interactive input. Please create a JSON file in:
   ${WORKFLOWS_DIR}/

Example template:
{
  "name": "my-workflow",
  "description": "Description of workflow",
  "steps": [
    {
      "id": "step1",
      "name": "First Step",
      "type": "shell",
      "command": "echo 'Hello'"
    }
  ]
}
`);
}

/**
 * Main execution
 */
async function main() {
  const config = parseArgs();
  
  if (!config.action) {
    console.log(`
🚀 Workflow Orchestrator

Usage:
  node scripts/orchestrator.mjs --action <action> [options]

Actions:
  execute  Run a workflow (--workflow <name>)
  list     List available workflows
  show     Show workflow details (--workflow <name>)
  status   Check execution status (--run-id <id>)
  retry    Retry failed steps (--run-id <id>)
  cancel   Cancel running workflow (--run-id <id>)
  create   Create new workflow template

Options:
  --workflow <name>  Workflow file name (without .json)
  --run-id <id>      Execution run ID
  --dry-run          Preview without execution
  --verbose, -v      Detailed output

Examples:
  node scripts/orchestrator.mjs --action list
  node scripts/orchestrator.mjs --action execute --workflow my-workflow
  node scripts/orchestrator.mjs --action status --run-id run-123456-abc
`);
    process.exit(0);
  }
  
  switch (config.action) {
    case 'list':
      actionList();
      break;
    case 'show':
      actionShow(config);
      break;
    case 'status':
      actionStatus(config);
      break;
    case 'execute':
      await actionExecute(config);
      break;
    case 'retry':
      await actionRetry(config);
      break;
    case 'cancel':
      actionCancel(config);
      break;
    case 'schedule':
      actionSchedule(config);
      break;
    case 'create':
      actionCreate(config);
      break;
    default:
      console.error(`❌ Unknown action: ${config.action}`);
      process.exit(1);
  }
}

main();
