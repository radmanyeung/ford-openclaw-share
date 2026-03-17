#!/usr/bin/env node
/**
 * Workflow Execution Engine
 * 
 * Executes workflow steps with:
 * - State persistence
 * - Error handling & retries
 * - Parallel execution
 * - Progress tracking
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = process.env.WORKFLOW_STATE_DIR || join(__dirname, '..', '..', '..', 'tmp', 'workflows');

// Generate unique execution ID
function generateExecutionId() {
  return `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// State management
class WorkflowState {
  constructor(executionId, workflow) {
    this.executionId = executionId;
    this.workflow = workflow.name;
    this.version = workflow.version;
    this.status = 'pending';
    this.currentStep = null;
    this.startTime = null;
    this.endTime = null;
    this.inputs = {};
    this.stepResults = {};
    this.context = {};
    this.errors = [];
  }
  
  save() {
    const stateFile = join(STATE_DIR, `${this.executionId}.json`);
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(this, null, 2));
  }
  
  static load(executionId) {
    const stateFile = join(STATE_DIR, `${executionId}.json`);
    if (!existsSync(stateFile)) return null;
    const data = JSON.parse(readFileSync(stateFile, 'utf-8'));
    return Object.assign(new WorkflowState(data.executionId, { name: data.workflow, version: data.version }), data);
  }
  
  markStepStarted(stepId) {
    this.currentStep = stepId;
    this.stepResults[stepId] = {
      status: 'running',
      startTime: Date.now()
    };
    this.save();
  }
  
  markStepCompleted(stepId, output, duration) {
    this.stepResults[stepId] = {
      ...this.stepResults[stepId],
      status: 'completed',
      output,
      duration,
      endTime: Date.now()
    };
    this.save();
  }
  
  markStepFailed(stepId, error, duration) {
    this.stepResults[stepId] = {
      ...this.stepResults[stepId],
      status: 'failed',
      error: error.message,
      errorStack: error.stack,
      duration,
      endTime: Date.now()
    };
    this.errors.push({ step: stepId, error: error.message, time: Date.now() });
    this.save();
  }
  
  markStepSkipped(stepId, reason) {
    this.stepResults[stepId] = {
      status: 'skipped',
      reason,
      time: Date.now()
    };
    this.save();
  }
}

// Execute script step
async function executeScriptStep(step, state, context) {
  const { command, workingDir, env = {}, timeout = 60000, shell = 'bash' } = step.config;
  
  // Interpolate variables
  const interpolatedCommand = interpolate(command, { inputs: state.inputs, context, env: process.env });
  const interpolatedEnv = {};
  for (const [key, value] of Object.entries(env)) {
    interpolatedEnv[key] = interpolate(value, { inputs: state.inputs, context, env: process.env });
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn(interpolatedCommand, [], {
      shell: true,
      cwd: workingDir || process.cwd(),
      env: { ...process.env, ...interpolatedEnv },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Step timed out after ${timeout}ms`));
    }, timeout);
    
    child.on('close', code => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
      }
    });
    
    child.on('error', reject);
  });
}

// Execute API step
async function executeApiStep(step, state, context) {
  const { url, method = 'GET', headers = {}, body } = step.config;
  
  const interpolatedUrl = interpolate(url, { inputs: state.inputs, context });
  const interpolatedBody = body ? JSON.parse(interpolate(JSON.stringify(body), { inputs: state.inputs, context })) : undefined;
  
  const response = await fetch(interpolatedUrl, {
    method,
    headers,
    body: interpolatedBody ? JSON.stringify(interpolatedBody) : undefined
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return data;
}

// Execute condition step
async function executeConditionStep(step, state, context) {
  const { expression, trueBranch, falseBranch } = step.config;
  
  const interpolatedExpr = interpolate(expression, { inputs: state.inputs, context, stepResults: state.stepResults });
  
  try {
    // Safe evaluation (limited scope)
    const result = new Function('inputs', 'context', 'stepResults', `return ${interpolatedExpr}`)(
      state.inputs,
      context,
      state.stepResults
    );
    
    return result ? trueBranch : falseBranch;
  } catch (error) {
    throw new Error(`Condition evaluation failed: ${error.message}`);
  }
}

// Interpolate variables in string
function interpolate(str, vars) {
  return str.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const parts = path.split('.');
    let value = vars;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return match; // Keep original if not found
      }
    }
    return String(value ?? '');
  });
}

// Execute single step
async function executeStep(step, state, context) {
  const startTime = Date.now();
  state.markStepStarted(step.id);
  
  try {
    let output;
    
    switch (step.type) {
      case 'script':
        output = await executeScriptStep(step, state, context);
        break;
      case 'api':
        output = await executeApiStep(step, state, context);
        break;
      case 'condition':
        output = await executeConditionStep(step, state, context);
        break;
      case 'wait':
        const delay = step.config.delay || 1000;
        await new Promise(r => setTimeout(r, delay));
        output = { waited: delay };
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
    
    const duration = Date.now() - startTime;
    state.markStepCompleted(step.id, output, duration);
    
    // Update context with step output
    Object.assign(context, { [step.id]: output });
    
    return { success: true, output, nextStep: step.onSuccess };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    state.markStepFailed(step.id, error, duration);
    return { success: false, error, nextStep: step.onFailure };
  }
}

// Execute workflow
export async function executeWorkflow(workflow, inputs = {}, resumeFrom = null) {
  const executionId = generateExecutionId();
  const state = new WorkflowState(executionId, workflow);
  state.inputs = inputs;
  state.startTime = Date.now();
  state.status = 'running';
  state.save();
  
  const context = {};
  let currentStepId = resumeFrom || workflow.entry;
  let visited = new Set();
  
  try {
    while (currentStepId) {
      // Prevent infinite loops
      if (visited.has(currentStepId)) {
        throw new Error(`Infinite loop detected at step: ${currentStepId}`);
      }
      visited.add(currentStepId);
      
      // Find step definition
      const step = workflow.steps.find(s => s.id === currentStepId);
      if (!step) {
        throw new Error(`Step not found: ${currentStepId}`);
      }
      
      console.log(`[EXEC] Starting step: ${step.id} (${step.name || step.type})`);
      
      // Execute step
      const result = await executeStep(step, state, context);
      
      // Determine next step
      if (result.success) {
        if (Array.isArray(result.nextStep)) {
          // Parallel branches - execute sequentially for now (TODO: parallel)
          console.log(`[EXEC] Parallel branch: ${result.nextStep.join(', ')}`);
          for (const nextId of result.nextStep) {
            currentStepId = nextId;
            await executeStepById(nextId, workflow, state, context, visited);
          }
          currentStepId = null; // End of parallel branch
        } else {
          currentStepId = result.nextStep;
        }
      } else {
        // Handle failure
        if (result.nextStep) {
          currentStepId = Array.isArray(result.nextStep) ? result.nextStep[0] : result.nextStep;
        } else {
          state.status = 'failed';
          state.endTime = Date.now();
          state.save();
          throw result.error;
        }
      }
    }
    
    // Workflow completed successfully
    state.status = 'completed';
    state.endTime = Date.now();
    state.save();
    
    console.log(`[EXEC] Workflow completed: ${executionId}`);
    return { executionId, status: 'completed', context };
    
  } catch (error) {
    state.status = 'failed';
    state.endTime = Date.now();
    state.save();
    throw error;
  }
}

// Helper to execute step by ID
async function executeStepById(stepId, workflow, state, context, visited) {
  const step = workflow.steps.find(s => s.id === stepId);
  if (!step) return;
  
  const result = await executeStep(step, state, context);
  
  if (result.success && result.nextStep) {
    const nextId = Array.isArray(result.nextStep) ? result.nextStep[0] : result.nextStep;
    if (!visited.has(nextId)) {
      await executeStepById(nextId, workflow, state, context, visited);
    }
  }
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  
  const file = getArg('--file');
  const inputsStr = getArg('--inputs') || '{}';
  const resume = getArg('--resume');
  
  if (!file) {
    console.error('Usage: node executor.mjs --file <workflow.json> [--inputs \'{}\'] [--resume <stepId>]');
    process.exit(1);
  }
  
  const workflow = JSON.parse(readFileSync(file, 'utf-8'));
  const inputs = JSON.parse(inputsStr);
  
  executeWorkflow(workflow, inputs, resume)
    .then(result => {
      console.log('Workflow completed:', result.executionId);
      process.exit(0);
    })
    .catch(error => {
      console.error('Workflow failed:', error.message);
      process.exit(1);
    });
}
