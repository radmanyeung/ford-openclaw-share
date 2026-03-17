#!/usr/bin/env node
/**
 * learn.mjs - Active Learning Node Main Interface
 * 
 * Records patterns from user feedback, task outcomes, and session observations.
 * 
 * Usage:
 *   node scripts/learn.mjs --action <action> [options]
 * 
 * Actions:
 *   correct   - Record user correction/negativity
 *   success   - Record successful outcome
 *   preference - Infer preference from behavior
 *   feedback  - Record explicit user feedback
 *   summarize - Create session-level learning summary
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '..');
const REFERENCES_DIR = join(SKILL_DIR, 'references');

// Helper to load JSON
function loadJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

// Helper to save JSON
function saveJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// Generate unique ID
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}${random}`;
}

// Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { action: null, options: {} };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--action' || arg === '-a') {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result.action = next;
        i++;
      }
    } else if (arg.startsWith('--')) {
      const key = arg.substring(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result.options[key] = next;
        i++;
      } else {
        result.options[key] = true;
      }
    } else if (!result.action) {
      result.action = arg;
    } else {
      const key = arg.replace(/^-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result.options[key] = next;
        i++;
      } else {
        result.options[key] = true;
      }
    }
  }
  
  return result;
}

// Helper functions
function inferType(input, outcome) {
  const text = `${input} ${outcome}`.toLowerCase();
  if (text.includes('verbose') || text.includes('long') || text.includes('detail')) return 'verbosity';
  if (text.includes('tone') || text.includes('casual') || text.includes('serious')) return 'tone';
  if (text.includes('format') || text.includes('table') || text.includes('bullet')) return 'format';
  if (text.includes('wrong') || text.includes('incorrect') || text.includes('error')) return 'accuracy';
  return 'general';
}

function inferPatternName(outcome) {
  const text = outcome.toLowerCase();
  if (text.includes('concise') || text.includes('short')) return 'concise_over_verbose';
  if (text.includes('bullet')) return 'bullet_preference';
  if (text.includes('formal')) return 'formal_tone';
  if (text.includes('繁体')) return 'traditional_chinese';
  return 'general_preference';
}

function inferTrigger(context) {
  const text = context.toLowerCase();
  if (text.includes('explanation') || text.includes('explain')) return 'explanation_request';
  if (text.includes('technical')) return 'technical_content';
  if (text.includes('security')) return 'security_topic';
  if (text.includes('overview') || text.includes('summary')) return 'summary_request';
  return 'general';
}

function inferAction(outcome) {
  const text = outcome.toLowerCase();
  if (text.includes('concise') || text.includes('short')) {
    return { response_length: 'short', format: 'bullet_points', detail_level: 'summary_only' };
  }
  if (text.includes('formal')) {
    return { tone: 'formal', detail_level: 'comprehensive', format: 'structured' };
  }
  return { response_length: 'medium', format: 'paragraph' };
}

// Action handlers
const actions = {
  correct: (opts) => {
    const { input, context, outcome, severity = 'medium' } = opts;
    
    if (!input || !context || !outcome) {
      console.error('Error: --input, --context, and --outcome required for correct action');
      process.exit(1);
    }
    
    const correctionLog = loadJson(join(REFERENCES_DIR, 'correction-log.json')) || {
      version: '1.0.0',
      updated: new Date().toISOString(),
      corrections: []
    };
    
    const correction = {
      id: generateId('corr'),
      type: inferType(input, outcome),
      input,
      context,
      outcome,
      severity,
      occurred: new Date().toISOString(),
      prevented_count: 0
    };
    
    // Add prevention suggestion
    if (outcome.toLowerCase().includes('verbose')) {
      correction.prevention = 'Use concise bullet points, offer details on request';
    } else if (outcome.toLowerCase().includes('tone')) {
      correction.prevention = 'Match tone to topic seriousness';
    } else {
      correction.prevention = 'Review response against user preferences before sending';
    }
    
    correctionLog.corrections.push(correction);
    correctionLog.updated = new Date().toISOString();
    saveJson(join(REFERENCES_DIR, 'correction-log.json'), correctionLog);
    
    console.log(`✅ Correction recorded: ${correction.id}`);
    console.log(`   Prevention: ${correction.prevention}`);
  },
  
  success: (opts) => {
    const { input, context, outcome } = opts;
    
    if (!input || !context || !outcome) {
      console.error('Error: --input, --context, and --outcome required for success action');
      process.exit(1);
    }
    
    const successPatterns = loadJson(join(REFERENCES_DIR, 'success-patterns.json')) || {
      version: '1.0.0',
      updated: new Date().toISOString(),
      patterns: []
    };
    
    const pattern = {
      id: generateId('succ'),
      input,
      context,
      outcome,
      occurred: new Date().toISOString(),
      replication_count: 1
    };
    
    // Check for existing similar pattern
    const existing = successPatterns.patterns.find(p => 
      p.outcome.toLowerCase() === outcome.toLowerCase()
    );
    
    if (existing) {
      existing.replication_count++;
      console.log(`✅ Updated success pattern: ${existing.id} (now ${existing.replication_count}x)`);
    } else {
      successPatterns.patterns.push(pattern);
      successPatterns.updated = new Date().toISOString();
      saveJson(join(REFERENCES_DIR, 'success-patterns.json'), successPatterns);
      console.log(`✅ Success pattern recorded: ${pattern.id}`);
    }
  },
  
  preference: (opts) => {
    const { input, context, outcome } = opts;
    
    if (!input || !context || !outcome) {
      console.error('Error: --input, --context, and --outcome required for preference action');
      process.exit(1);
    }
    
    const preferences = loadJson(join(REFERENCES_DIR, 'preference-patterns.json')) || {
      version: '1.0.0',
      updated: new Date().toISOString(),
      patterns: []
    };
    
    const pattern = {
      id: generateId('pref'),
      pattern: inferPatternName(outcome),
      description: outcome,
      triggers: [inferTrigger(context)],
      confidence: 0.6,  // First observation
      occurrences: 1,
      last_seen: new Date().toISOString(),
      action: inferAction(outcome)
    };
    
    // Check for existing pattern
    const existing = preferences.patterns.find(p => 
      p.pattern === pattern.pattern
    );
    
    if (existing) {
      if (!existing.triggers.includes(pattern.triggers[0])) {
        existing.triggers.push(pattern.triggers[0]);
      }
      existing.occurrences++;
      existing.confidence = Math.min(0.95, existing.confidence + 0.1);
      existing.last_seen = new Date().toISOString();
      console.log(`✅ Updated preference: ${existing.pattern} (confidence: ${existing.confidence.toFixed(2)})`);
    } else {
      preferences.patterns.push(pattern);
      preferences.updated = new Date().toISOString();
      saveJson(join(REFERENCES_DIR, 'preference-patterns.json'), preferences);
      console.log(`✅ Preference recorded: ${pattern.pattern}`);
    }
  },
  
  feedback: async (opts) => {
    const { input, type = 'general', sentiment = 'neutral' } = opts;
    
    if (!input) {
      console.error('Error: --input required for feedback action');
      process.exit(1);
    }
    
    // Categorize feedback
    if (sentiment === 'negative') {
      await actions.correct({ 
        input, 
        context: 'User feedback', 
        outcome: input,
        severity: 'low'
      });
    } else if (sentiment === 'positive') {
      await actions.success({
        input,
        context: 'User positive feedback',
        outcome: input
      });
    }
    
    console.log(`✅ Feedback recorded: type=${type}, sentiment=${sentiment}`);
  },
  
  summarize: (opts) => {
    const { period = 'daily' } = opts;
    
    const correctionLog = loadJson(join(REFERENCES_DIR, 'correction-log.json'));
    const successPatterns = loadJson(join(REFERENCES_DIR, 'success-patterns.json'));
    const preferences = loadJson(join(REFERENCES_DIR, 'preference-patterns.json'));
    
    const summary = {
      period,
      generated: new Date().toISOString(),
      stats: {
        corrections: correctionLog?.corrections?.length || 0,
        successes: successPatterns?.patterns?.length || 0,
        preferences: preferences?.patterns?.length || 0
      },
      recent_corrections: correctionLog?.corrections?.slice(-3) || [],
      top_patterns: (preferences?.patterns || [])
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
    };
    
    console.log(`\n📊 Learning Summary (${period})`);
    console.log(`   Corrections: ${summary.stats.corrections}`);
    console.log(`   Success patterns: ${summary.stats.successes}`);
    console.log(`   Preferences: ${summary.stats.preferences}`);
    
    if (summary.top_patterns.length > 0) {
      console.log('\n   Top patterns:');
      summary.top_patterns.forEach(p => {
        console.log(`   - ${p.pattern} (conf: ${(p.confidence * 100).toFixed(0)}%)`);
      });
    }
  }
};

// Main
async function main() {
  const { action, options } = parseArgs();
  
  if (!action) {
    console.log('Active Learning Node - Learn Interface');
    console.log('');
    console.log('Usage: node scripts/learn.mjs --action <action> [options]');
    console.log('');
    console.log('Actions:');
    console.log('  correct     Record user correction/negativity');
    console.log('  success     Record successful outcome');
    console.log('  preference  Infer preference from behavior');
    console.log('  feedback    Record explicit user feedback');
    console.log('  summarize   Create session-level learning summary');
    console.log('');
    console.log('Options:');
    console.log('  --input, -i     What happened');
    console.log('  --context, -c   Situation description');
    console.log('  --outcome, -o   Resulting pattern');
    console.log('  --type          Feedback type');
    console.log('  --sentiment     positive/negative/neutral');
    console.log('  --period        daily/weekly');
    return;
  }
  
  const actionName = action.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  
  if (!actions[actionName]) {
    console.error(`Error: Unknown action '${action}'`);
    process.exit(1);
  }
  
  await actions[actionName](options);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
