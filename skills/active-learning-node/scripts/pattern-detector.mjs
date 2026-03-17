#!/usr/bin/env node
/**
 * pattern-detector.mjs - Cross-session Pattern Detection Engine
 * 
 * Scans learning data files to detect recurring patterns, escalate confidence,
 * and surface actionable insights.
 * 
 * Usage:
 *   node scripts/pattern-detector.mjs [--threshold N] [--output json|text]
 * 
 * What it does:
 *   1. Loads all reference JSON files (corrections, successes, preferences, interactions)
 *   2. Cross-correlates entries to find recurring themes
 *   3. Escalates confidence on repeated patterns
 *   4. Flags emerging patterns that haven't reached threshold yet
 *   5. Outputs actionable summary
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '..');
const REFERENCES_DIR = join(SKILL_DIR, 'references');

function loadJson(file) {
  const path = join(REFERENCES_DIR, file);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function saveJson(file, data) {
  writeFileSync(join(REFERENCES_DIR, file), JSON.stringify(data, null, 2) + '\n');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { threshold: 3, output: 'text' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--threshold' && args[i + 1]) { opts.threshold = parseInt(args[++i]); }
    if (args[i] === '--output' && args[i + 1]) { opts.output = args[++i]; }
  }
  return opts;
}

// ============================================================================
// Pattern Detection Logic
// ============================================================================

function extractKeywords(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'for', 'was', 'with', 'that', 'this', 'from', 'are', 'not'].includes(w));
}

function cosineSimilarity(a, b) {
  const allWords = [...new Set([...a, ...b])];
  const vecA = allWords.map(w => a.filter(x => x === w).length);
  const vecB = allWords.map(w => b.filter(x => x === w).length);
  const dot = vecA.reduce((s, v, i) => s + v * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(vecB.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

function detectClusters(entries, threshold = 0.4) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < entries.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [entries[i]];
    assigned.add(i);

    for (let j = i + 1; j < entries.length; j++) {
      if (assigned.has(j)) continue;
      const sim = cosineSimilarity(entries[i]._keywords, entries[j]._keywords);
      if (sim >= threshold) {
        cluster.push(entries[j]);
        assigned.add(j);
      }
    }
    if (cluster.length > 0) clusters.push(cluster);
  }
  return clusters;
}

function classifyPattern(cluster) {
  const allKeywords = cluster.flatMap(e => e._keywords);
  const freq = {};
  allKeywords.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const topKeywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

  // Classify by dominant theme
  const themes = {
    verbosity: ['verbose', 'concise', 'short', 'long', 'brief', 'detail'],
    format: ['bullet', 'table', 'list', 'format', 'structure', 'markdown'],
    language: ['chinese', 'traditional', 'english', '繁體', '繁体', '中文'],
    tone: ['tone', 'formal', 'casual', 'direct', 'serious', 'friendly'],
    accuracy: ['wrong', 'incorrect', 'error', 'mistake', 'fix', 'correct'],
    efficiency: ['fast', 'slow', 'efficient', 'quick', 'timeout', 'token']
  };

  let bestTheme = 'general';
  let bestScore = 0;
  for (const [theme, words] of Object.entries(themes)) {
    const score = topKeywords.filter(k => words.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestTheme = theme; }
  }

  return { theme: bestTheme, topKeywords, size: cluster.length };
}

// ============================================================================
// Main Detection Pipeline
// ============================================================================

function main() {
  const opts = parseArgs();
  const corrections = loadJson('correction-log.json');
  const successes = loadJson('success-patterns.json');
  const preferences = loadJson('preference-patterns.json');
  const performance = loadJson('performance-metrics.json');
  const interaction = loadJson('interaction-model.json');

  // Collect all entries with keywords
  const allEntries = [];

  (corrections?.corrections || []).forEach(c => {
    allEntries.push({
      source: 'correction', id: c.id, text: `${c.input} ${c.context} ${c.outcome}`,
      _keywords: extractKeywords(`${c.input} ${c.context} ${c.outcome}`),
      timestamp: c.occurred, severity: c.severity
    });
  });

  (successes?.patterns || []).forEach(s => {
    allEntries.push({
      source: 'success', id: s.id, text: `${s.input} ${s.context} ${s.outcome}`,
      _keywords: extractKeywords(`${s.input} ${s.context} ${s.outcome}`),
      timestamp: s.occurred, replicationCount: s.replication_count
    });
  });

  (preferences?.patterns || []).forEach(p => {
    allEntries.push({
      source: 'preference', id: p.id, text: `${p.pattern} ${p.description}`,
      _keywords: extractKeywords(`${p.pattern} ${p.description}`),
      timestamp: p.last_seen, confidence: p.confidence, occurrences: p.occurrences
    });
  });

  if (allEntries.length === 0) {
    if (opts.output === 'json') {
      console.log(JSON.stringify({ status: 'empty', patterns: [], emerging: [], recommendations: [] }));
    } else {
      console.log('⚠️  No learning data found. Record corrections/successes first.');
    }
    return;
  }

  // Detect clusters
  const clusters = detectClusters(allEntries, 0.3);
  const classified = clusters.map(c => ({ ...classifyPattern(c), entries: c }));

  // Split into confirmed patterns (>= threshold) and emerging
  const confirmed = classified.filter(c => c.size >= opts.threshold);
  const emerging = classified.filter(c => c.size > 1 && c.size < opts.threshold);
  const isolated = classified.filter(c => c.size === 1);

  // Cross-source patterns (entries from different sources in same cluster)
  const crossSource = classified.filter(c => {
    const sources = new Set(c.entries.map(e => e.source));
    return sources.size > 1;
  });

  // Generate recommendations
  const recommendations = [];
  confirmed.forEach(p => {
    recommendations.push({
      type: 'confirmed_pattern',
      theme: p.theme,
      action: `Consistently apply ${p.theme} pattern (${p.size} observations)`,
      keywords: p.topKeywords
    });
  });
  emerging.forEach(p => {
    recommendations.push({
      type: 'emerging_pattern',
      theme: p.theme,
      action: `Monitor ${p.theme} pattern (${p.size}/${opts.threshold} threshold)`,
      keywords: p.topKeywords
    });
  });

  // Update preference confidence based on cluster evidence
  if (preferences?.patterns) {
    let updated = false;
    for (const cluster of classified) {
      for (const entry of cluster.entries) {
        if (entry.source === 'preference' && cluster.size > 1) {
          const pref = preferences.patterns.find(p => p.id === entry.id);
          if (pref) {
            const boost = Math.min(0.05 * (cluster.size - 1), 0.15);
            const newConf = Math.min(0.95, pref.confidence + boost);
            if (newConf > pref.confidence) {
              pref.confidence = parseFloat(newConf.toFixed(2));
              pref.last_seen = new Date().toISOString();
              updated = true;
            }
          }
        }
      }
    }
    if (updated) {
      preferences.updated = new Date().toISOString();
      saveJson('preference-patterns.json', preferences);
    }
  }

  // Output
  if (opts.output === 'json') {
    console.log(JSON.stringify({
      status: 'ok',
      totalEntries: allEntries.length,
      confirmed: confirmed.map(c => ({ theme: c.theme, size: c.size, keywords: c.topKeywords })),
      emerging: emerging.map(c => ({ theme: c.theme, size: c.size, keywords: c.topKeywords })),
      crossSource: crossSource.map(c => ({
        theme: c.theme,
        sources: [...new Set(c.entries.map(e => e.source))],
        size: c.size
      })),
      recommendations,
      isolated: isolated.length
    }, null, 2));
  } else {
    console.log(`\n🔍 Pattern Detection Report`);
    console.log(`   Total entries: ${allEntries.length}`);
    console.log(`   Threshold: ${opts.threshold}`);
    console.log('');

    if (confirmed.length > 0) {
      console.log(`✅ Confirmed Patterns (${confirmed.length}):`);
      confirmed.forEach(p => {
        console.log(`   [${p.theme}] ${p.size} observations — keywords: ${p.topKeywords.join(', ')}`);
      });
    } else {
      console.log('   No confirmed patterns yet (need more data)');
    }

    if (emerging.length > 0) {
      console.log(`\n🌱 Emerging Patterns (${emerging.length}):`);
      emerging.forEach(p => {
        console.log(`   [${p.theme}] ${p.size}/${opts.threshold} — keywords: ${p.topKeywords.join(', ')}`);
      });
    }

    if (crossSource.length > 0) {
      console.log(`\n🔗 Cross-source Patterns (${crossSource.length}):`);
      crossSource.forEach(p => {
        const sources = [...new Set(p.entries.map(e => e.source))];
        console.log(`   [${p.theme}] sources: ${sources.join(' + ')} — ${p.size} entries`);
      });
    }

    if (recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      recommendations.forEach(r => {
        const icon = r.type === 'confirmed_pattern' ? '✅' : '🌱';
        console.log(`   ${icon} ${r.action}`);
      });
    }

    console.log(`\n   Isolated entries: ${isolated.length}`);
  }
}

main();
