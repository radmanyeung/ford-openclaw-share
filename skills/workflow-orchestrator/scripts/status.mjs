#!/usr/bin/env node
/**
 * Workflow Status Script
 *
 * Usage:
 *   node status.mjs                       # show latest run
 *   node status.mjs --run-id <id>         # show specific run
 *   node status.mjs --recent <count>      # list recent runs
 *   node status.mjs --workflow <name>     # runs for a workflow
 *   node status.mjs --watch               # live-refresh latest run
 *   node status.mjs --format json         # machine-readable
 *   node status.mjs --cleanup [minutes]   # mark stuck 'running' runs as abandoned
 *   node status.mjs --cleanup --dry-run   # preview without writing
 *   node status.mjs --log                 # print log path of latest run
 *   node status.mjs --tail                # tail -f the latest run's log
 *
 * Flags:
 *   -e / --executionId / --run-id   Run ID (run-<ts>-<hash>)
 *   -r / --recent                   Count of recent runs
 *   -w / --workflow                 Filter by workflow name
 *   --watch                         Re-render every 2s until done
 *   --cleanup [minutes]             Mark runs stuck in 'running' longer than
 *                                   threshold (default 60 min) as 'abandoned'
 *   --dry-run                       With --cleanup: preview only
 *   --format <text|json>            Output format (default: text)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = process.env.WORKFLOW_RUNS_DIR || join(__dirname, '..', 'runs');

const args = process.argv.slice(2);
const getArg = (...flags) => {
  for (const f of flags) {
    const i = args.indexOf(f);
    if (i !== -1) return args[i + 1];
  }
  return null;
};
const hasFlag = (...flags) => flags.some(f => args.includes(f));

const runId = getArg('--run-id', '--executionId', '-e');
const recent = getArg('--recent', '-r');
const workflowName = getArg('--workflow', '-w');
const format = getArg('--format') || 'text';
const watch = hasFlag('--watch');
const cleanup = hasFlag('--cleanup');
const dryRun = hasFlag('--dry-run');
const logFlag = hasFlag('--log');
const tailFlag = hasFlag('--tail');
// --cleanup may be followed by a number
const cleanupThresholdMin = (() => {
  if (!cleanup) return null;
  const raw = getArg('--cleanup');
  const n = raw && !raw.startsWith('--') ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 60;
})();

function loadRun(id) {
  const file = join(RUNS_DIR, id.endsWith('.json') ? id : `${id}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf-8')); } catch { return null; }
}

function listRunFiles() {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter(f => f.startsWith('run-') && f.endsWith('.json'))
    .map(f => ({ id: f.replace(/\.json$/, ''), path: join(RUNS_DIR, f) }));
}

function listRuns(count = 10, workflowFilter = null) {
  const runs = listRunFiles()
    .map(({ id, path }) => {
      try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
    })
    .filter(Boolean)
    .filter(r => !workflowFilter || r.workflowName === workflowFilter)
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  return count ? runs.slice(0, count) : runs;
}

function iconFor(status) {
  return {
    completed: '✅',
    failed:    '❌',
    skipped:   '⏭️ ',
    running:   '🔄',
    pending:   '⏳',
    abandoned: '👻'
  }[status] || '•';
}

function runCleanup(thresholdMin, preview) {
  const now = Date.now();
  const limitMs = thresholdMin * 60 * 1000;
  const runs = listRuns(null);
  const stuck = runs.filter(r => r.status === 'running' && (now - r.startTime) > limitMs);
  if (!stuck.length) {
    console.log(`No stuck runs (threshold: ${thresholdMin} min).`);
    return;
  }
  console.log(`Found ${stuck.length} stuck run${stuck.length > 1 ? 's' : ''} (status=running, age > ${thresholdMin} min):\n`);
  for (const r of stuck) {
    const ageMin = Math.round((now - r.startTime) / 60000);
    console.log(`  ${preview ? '[DRY-RUN] would mark' : 'marking'} ${r.runId}`);
    console.log(`    workflow: ${r.workflowName}  subject: ${r.inputs?.subject || '?'}  age: ${ageMin} min`);
    if (!preview) {
      r.status = 'abandoned';
      r.endTime = now;
      r.abandonedReason = `Stuck in 'running' for ${ageMin} min (> ${thresholdMin} min threshold)`;
      const file = join(RUNS_DIR, `${r.runId}.json`);
      writeFileSync(file, JSON.stringify(r, null, 2));
    }
  }
  console.log(`\n${preview ? 'Dry-run complete — no files modified.' : `Marked ${stuck.length} run(s) as 'abandoned'.`}`);
}

function durationStr(run) {
  const end = run.endTime || Date.now();
  const sec = Math.round((end - run.startTime) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

function renderRun(run) {
  if (format === 'json') { console.log(JSON.stringify(run, null, 2)); return; }

  const lines = [];
  lines.push(`## Run: ${run.runId}`);
  lines.push(`Workflow:  ${run.workflowName}`);
  lines.push(`Status:    ${run.status.toUpperCase()} ${iconFor(run.status)}`);
  lines.push(`Started:   ${new Date(run.startTime).toLocaleString()}`);
  lines.push(`Duration:  ${durationStr(run)}${run.endTime ? '' : ' (in progress)'}`);
  if (run.inputs && Object.keys(run.inputs).length) {
    const io = Object.entries(run.inputs).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ');
    lines.push(`Inputs:    ${io}`);
  }
  lines.push('');
  lines.push('Steps:');
  const steps = Object.entries(run.stepResults || {});
  if (!steps.length) {
    lines.push('  (no steps run yet)');
  } else {
    const maxId = Math.max(...steps.map(([k]) => k.length));
    for (const [id, r] of steps) {
      const dur = r.duration ? ` ${r.duration}ms` : '';
      lines.push(`  ${iconFor(r.status)} ${id.padEnd(maxId)}  ${r.status}${dur}`);
      if (r.error) lines.push(`     ↳ ${r.error}`);
    }
  }
  console.log(lines.join('\n'));
}

function renderRecentTable(runs) {
  if (format === 'json') { console.log(JSON.stringify(runs, null, 2)); return; }
  if (!runs.length) { console.log('No runs found'); return; }

  const rows = runs.map(r => ({
    id: r.runId,
    wf: r.workflowName,
    st: r.status,
    icon: iconFor(r.status === 'completed' ? 'completed' : r.status === 'failed' ? 'failed' : 'running'),
    dur: durationStr(r),
    steps: Object.keys(r.stepResults || {}).length,
    subject: (r.inputs && (r.inputs.subject || Object.values(r.inputs)[0])) || ''
  }));
  const idW = Math.max(12, ...rows.map(r => r.id.length));
  const wfW = Math.max(12, ...rows.map(r => r.wf.length));
  const stW = 10;

  const hdr = 'Run ID'.padEnd(idW) + '  ' + 'Workflow'.padEnd(wfW) + '  ' + 'Status'.padEnd(stW) + 'Duration  Steps  Subject';
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const r of rows) {
    console.log(
      r.id.padEnd(idW) + '  ' +
      r.wf.padEnd(wfW) + '  ' +
      `${r.icon} ${r.st}`.padEnd(stW) +
      r.dur.padEnd(9) + ' ' +
      String(r.steps).padEnd(5) + '  ' +
      (typeof r.subject === 'string' ? r.subject : JSON.stringify(r.subject)).slice(0, 40)
    );
  }
}

function latestRun(workflowFilter = null) {
  const runs = listRuns(1, workflowFilter);
  return runs[0] || null;
}

async function runWatch() {
  const clear = '\x1B[2J\x1B[H';
  let lastId = null;
  while (true) {
    const run = runId ? loadRun(runId) : latestRun(workflowName);
    if (!run) {
      process.stdout.write(clear + 'No run found yet… (waiting)\n');
    } else {
      process.stdout.write(clear);
      renderRun(run);
      console.log(`\n(auto-refresh every 2s — Ctrl+C to quit)`);
      if (run.endTime) {
        console.log(`Run finished.`);
        break;
      }
      lastId = run.runId;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

const LOGS_DIR = join(__dirname, '..', 'logs');

function logPathFor(targetRunId) {
  return join(LOGS_DIR, `${targetRunId}.json`.replace(/\.json$/, '.log'));
}

async function runTail(targetRunId) {
  const { spawn } = await import('child_process');
  const file = logPathFor(targetRunId);
  if (!existsSync(file)) { console.error(`Log file not found: ${file}`); process.exit(1); }
  const child = spawn('tail', ['-f', file], { stdio: 'inherit' });
  child.on('close', code => process.exit(code || 0));
}

async function main() {
  if (logFlag || tailFlag) {
    const target = runId || (latestRun(workflowName)?.runId);
    if (!target) { console.error('No run found.'); process.exit(1); }
    const file = logPathFor(target);
    if (logFlag && !tailFlag) { console.log(file); return; }
    if (!existsSync(file)) { console.error(`Log file not found: ${file}\n(Only runs started after the logging patch will have logs.)`); process.exit(1); }
    await runTail(target);
    return;
  }
  if (cleanup) { runCleanup(cleanupThresholdMin, dryRun); return; }
  if (watch) { await runWatch(); return; }

  if (runId) {
    const run = loadRun(runId);
    if (!run) { console.error(`Run not found: ${runId}`); process.exit(1); }
    renderRun(run);
    return;
  }

  if (recent) {
    renderRecentTable(listRuns(parseInt(recent, 10), workflowName));
    return;
  }

  if (workflowName) {
    renderRecentTable(listRuns(20, workflowName));
    return;
  }

  // No args → show latest run (most common case)
  const run = latestRun();
  if (!run) { console.log('No runs found.'); return; }
  renderRun(run);
}

main().catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });
