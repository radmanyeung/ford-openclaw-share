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
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const RUNS_DIR = path.join(__dirname, '..', 'runs');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';

function resolveTemplate(value, ctx) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(v => resolveTemplate(v, ctx));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTemplate(v, ctx);
    return out;
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, pathExpr) => {
    const parts = pathExpr.trim().split('.');
    // Strict check: referencing steps.X.output requires X to have completed.
    // Silent empty fallback here was causing agents to hallucinate when upstream steps failed/skipped.
    if (parts[0] === 'steps' && parts.length >= 3 && parts[2] === 'output') {
      const stepId = parts[1];
      const stepResult = ctx.steps?.[stepId];
      if (stepResult && stepResult.status !== 'completed') {
        throw new Error(`Template references steps.${stepId}.output but step status is '${stepResult.status}'`);
      }
      if (!stepResult) {
        throw new Error(`Template references steps.${stepId}.output but step has not run yet`);
      }
    }
    let cur = ctx;
    for (const p of parts) {
      if (cur == null) return '';
      cur = cur[p];
    }
    if (cur == null) return '';
    return typeof cur === 'string' ? cur : JSON.stringify(cur);
  });
}

const AGENT_MSG_MAX = 120_000;
function truncateForArgv(s) {
  if (typeof s !== 'string' || s.length <= AGENT_MSG_MAX) return s;
  const keep = 40_000;
  return s.slice(0, keep) + `\n\n... [truncated ${s.length - 2 * keep} chars to fit argv limit] ...\n\n` + s.slice(-keep);
}

function runOpenclawAgent(agentId, message, timeoutSec, verbose) {
  return new Promise((resolve) => {
    const safeMsg = truncateForArgv(message);
    if (verbose && safeMsg !== message) console.log(`   ✂ message truncated ${message.length} → ${safeMsg.length} chars`);
    const args = ['agent', '--agent', agentId, '--json', '--message', safeMsg];
    if (timeoutSec) args.push('--timeout', String(timeoutSec));
    if (verbose) console.log(`   ▶ ${OPENCLAW_BIN} agent --agent ${agentId} --json --message <${message.length} chars>`);
    const child = spawn(OPENCLAW_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const killTimer = timeoutSec ? setTimeout(() => child.kill('SIGTERM'), (timeoutSec + 30) * 1000) : null;
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', (code) => {
      if (killTimer) clearTimeout(killTimer);
      if (code !== 0) return resolve({ ok: false, error: `openclaw exit ${code}: ${stderr.trim() || stdout.trim()}` });
      const raw = stdout.trim();
      try {
        const j = JSON.parse(raw);
        const payloads = j?.result?.payloads;
        if (Array.isArray(payloads) && payloads.length) {
          const texts = payloads.map(p => p?.text).filter(t => typeof t === 'string' && t.length);
          if (texts.length) return resolve({ ok: true, output: texts.join('\n\n') });
        }
        const reply = j.reply || j.message || j.output || j.content || j.text;
        if (typeof reply === 'string') return resolve({ ok: true, output: reply });
        return resolve({ ok: true, output: JSON.stringify(j) });
      } catch {
        return resolve({ ok: true, output: raw });
      }
    });
    child.on('error', (err) => {
      if (killTimer) clearTimeout(killTimer);
      resolve({ ok: false, error: `spawn failed: ${err.message}` });
    });
  });
}

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
    verbose: false,
    inputs: {}
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--action' && args[i + 1]) config.action = args[++i];
    else if (arg === '--workflow' && args[i + 1]) config.workflow = args[++i];
    else if (arg === '--run-id' && args[i + 1]) config.runId = args[++i];
    else if (arg === '--dry-run') config.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') config.verbose = true;
    else if (arg === '--input' && args[i + 1]) {
      const kv = args[++i];
      const idx = kv.indexOf('=');
      if (idx > 0) config.inputs[kv.slice(0, idx)] = kv.slice(idx + 1);
    }
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
async function executeStep(step, runId, verbose, ctx) {
  const startTime = Date.now();
  let result = { status: 'pending' };

  if (verbose) {
    console.log(`   🔄 Executing: ${step.name} (${step.id})`);
  }

  try {
    result.status = 'running';

    switch (step.type) {
      case 'shell': {
        const command = resolveTemplate(step.command, ctx);
        const stepEnv = step.env ? resolveTemplate(step.env, ctx) : {};
        const { exec } = await import('child_process');
        await new Promise((resolve) => {
          exec(command, {
            cwd: __dirname,
            env: { ...process.env, ...stepEnv },
            maxBuffer: 16 * 1024 * 1024,
            timeout: step.timeout ? step.timeout * 1000 : undefined,
            shell: '/bin/bash'
          }, (error, stdout, stderr) => {
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
      }

      case 'write-report': {
        const outPath = resolveTemplate(step.path, ctx);
        const content = resolveTemplate(step.content, ctx);
        const expanded = outPath.startsWith('~/') ? path.join(process.env.HOME || '', outPath.slice(2)) : outPath;
        fs.mkdirSync(path.dirname(expanded), { recursive: true });
        fs.writeFileSync(expanded, content);
        result.status = 'completed';
        result.output = `Saved: ${expanded} (${content.length} chars)`;
        break;
      }

      case 'agent': {
        if (!step.agent) {
          result.status = 'failed';
          result.error = 'agent step missing "agent" field';
          break;
        }
        const params = step.params ? resolveTemplate(step.params, ctx) : {};
        const message = params.task || params.message || params.prompt || JSON.stringify(params);
        const ac = await runOpenclawAgent(step.agent, message, step.timeout, verbose);
        if (ac.ok) {
          result.status = 'completed';
          result.output = ac.output;
        } else {
          result.status = 'failed';
          result.error = ac.error;
        }
        break;
      }

      default:
        result.status = 'completed';
        result.output = `Step ${step.id} completed`;
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  // Semantic assertions — evaluated only if the step technically completed.
  // Lets workflows reject agent outputs that indicate refusal/invalid response.
  if (step.assert && result.status === 'completed' && typeof result.output === 'string') {
    const out = result.output;
    const failAssert = (msg) => { result.status = 'failed'; result.error = `Assertion failed: ${msg}`; };
    if (Array.isArray(step.assert.notContains)) {
      for (const needle of step.assert.notContains) {
        if (out.includes(needle)) { failAssert(`output contains forbidden phrase "${needle}"`); break; }
      }
    }
    if (result.status === 'completed' && Array.isArray(step.assert.contains)) {
      for (const needle of step.assert.contains) {
        if (!out.includes(needle)) { failAssert(`output missing required phrase "${needle}"`); break; }
      }
    }
    if (result.status === 'completed' && typeof step.assert.matches === 'string') {
      try {
        if (!new RegExp(step.assert.matches).test(out)) failAssert(`output did not match regex /${step.assert.matches}/`);
      } catch (e) { failAssert(`invalid regex: ${e.message}`); }
    }
    if (result.status === 'completed' && typeof step.assert.minLength === 'number') {
      if (out.length < step.assert.minLength) failAssert(`output length ${out.length} < minLength ${step.assert.minLength}`);
    }
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
  
  // Merge inputs: workflow defaults → CLI overrides
  const mergedInputs = {};
  for (const [k, v] of Object.entries(workflow.inputs || {})) {
    if (v && typeof v === 'object' && 'default' in v) mergedInputs[k] = v.default;
  }
  Object.assign(mergedInputs, config.inputs);
  for (const [k, spec] of Object.entries(workflow.inputs || {})) {
    if (spec && spec.required && (mergedInputs[k] == null || mergedInputs[k] === '')) {
      console.error(`❌ Missing required input: --input ${k}=<value>`);
      return;
    }
  }

  const runId = generateRunId();
  const run = {
    runId,
    workflowName: config.workflow,
    status: 'running',
    startTime: Date.now(),
    inputs: mergedInputs,
    stepResults: {}
  };

  // Tee console.log into logs/<runId>.log so `tail -f` works in real time.
  // The log file survives the run and is the authoritative human-readable trace.
  const logFile = path.join(LOGS_DIR, `${runId}.log`);
  const logStream = config.dryRun ? null : fs.createWriteStream(logFile, { flags: 'w' });
  const _origLog = console.log;
  const _origErr = console.error;
  if (logStream) {
    const writeToFile = (args) => {
      const line = args.map(a => typeof a === 'string' ? a : (a === null || a === undefined ? String(a) : JSON.stringify(a))).join(' ');
      logStream.write(line + '\n');
    };
    console.log = (...args) => { _origLog(...args); writeToFile(args); };
    console.error = (...args) => { _origErr(...args); writeToFile(args); };
  }
  const endLogging = () => {
    if (!logStream) return;
    console.log = _origLog;
    console.error = _origErr;
    logStream.end();
  };

  console.log(`
🚀 Executing Workflow: ${workflow.name}
   Run ID: ${runId}
   Mode:   ${config.dryRun ? 'DRY RUN' : 'LIVE'}
   Log:    ${logFile}
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
    
    // Check dependencies — both 'failed' and 'skipped' block downstream execution
    if (step.dependsOn) {
      const blockingDeps = step.dependsOn.filter(dep => {
        const s = run.stepResults[dep]?.status;
        return s === 'failed' || s === 'skipped';
      });
      if (blockingDeps.length > 0) {
        const reasons = blockingDeps.map(d => `${d}:${run.stepResults[d].status}`).join(', ');
        console.log(`   ⏭️  Skipped - blocking dependencies: ${reasons}`);
        run.stepResults[step.id] = { status: 'skipped', duration: 0, error: `Blocked by: ${reasons}` };
        continue;
      }
    }
    
    // Build context for template resolution
    const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '-');
    const ctx = { inputs: mergedInputs, steps: run.stepResults, env: { ...process.env, RUN_TIMESTAMP: runTimestamp, RUN_ID: runId } };

    // Execute step
    const result = await executeStep(step, runId, config.verbose, ctx);
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
        const retryResult = await executeStep(step, runId, config.verbose, ctx);
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
   Log:    ${logFile}
`);
  endLogging();
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
  
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '-');
  const ctx = { inputs: run.inputs || {}, steps: run.stepResults, env: { ...process.env, RUN_TIMESTAMP: runTimestamp, RUN_ID: config.runId } };
  for (const step of failedSteps) {
    const result = await executeStep(step, config.runId, config.verbose, ctx);
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
  --workflow <name>   Workflow file name (without .json)
  --run-id <id>       Execution run ID
  --input key=value   Workflow input (repeatable)
  --dry-run           Preview without execution
  --verbose, -v       Detailed output

Env:
  OPENCLAW_BIN        Path to openclaw CLI (default: openclaw)

Examples:
  node scripts/orchestrator.mjs --action list
  node scripts/orchestrator.mjs --action execute --workflow my-workflow
  node scripts/orchestrator.mjs --action execute --workflow osint-triage \\
       --input subject="Jane Doe" --input scopeNotes="2024-2026, US media"
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
