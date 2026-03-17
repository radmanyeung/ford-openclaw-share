#!/usr/bin/env node
/**
 * Report Generator - Generate structured reports from memory, git, and context
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  memoryPath: 'memory/',
  contextSummary: 'memory/context-summary.md',
  outputDir: 'reports/',
  templatesPath: 'references/templates.md'
};

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    type: 'daily',
    format: 'markdown',
    maxLines: 500,
    output: CONFIG.outputDir,
    compact: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' || arg === '-t') config.type = args[++i];
    if (arg === '--format' || arg === '-f') config.format = args[++i];
    if (arg === '--max-lines') config.maxLines = parseInt(args[++i]);
    if (arg === '--output' || arg === '-o') config.output = args[++i];
    if (arg === '--compact') config.compact = true;
  }
  return config;
}

function collectMemoryData() {
  const data = { files: [], content: '' };
  try {
    const files = fs.readdirSync(CONFIG.memoryPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(CONFIG.memoryPath, file), 'utf-8');
      const lines = content.split('\n').slice(0, config.maxLines);
      data.files.push({ name: file, lines: lines.length, content: lines.join('\n') });
      data.content += `\n## ${file}\n${lines.join('\n')}\n`;
    }
  } catch (e) {
    console.error('Memory path not found:', CONFIG.memoryPath);
  }
  return data;
}

function collectGitData() {
  try {
    const log = execSync('git log --oneline -20', { encoding: 'utf-8' });
    const status = execSync('git status --short', { encoding: 'utf-8' });
    const diff = execSync('git diff --stat', { encoding: 'utf-8' });
    return { log, status, diff };
  } catch (e) {
    return { log: '', status: '', diff: '' };
  }
}

function generateDailyReport(data, git, config) {
  const date = new Date().toISOString().split('T')[0];
  const title = `Daily Report - ${date}`;

  let content = `# ${title}\n\n`;
  content += `## Summary\n\n`;
  content += `- Memory files processed: ${data.files.length}\n`;
  content += `- Total lines read: ${data.content.split('\n').length}\n`;
  content += `- Report type: ${config.type}\n\n`;

  content += `## Memory Overview\n\n`;
  for (const file of data.files) {
    content += `### ${file.name}\n`;
    content += `- Lines: ${file.lines}\n\n`;
    if (!config.compact) {
      content += `${file.content}\n\n`;
    }
  }

  content += `## Git Activity\n\n`;
  content += `### Recent Commits\n\`\`\`\n${git.log}\`\`\`\n\n`;
  content += `### Status\n\`\`\`\n${git.status}\`\`\`\n\n`;
  content += `### Changes\n\`\`\`\n${git.diff}\`\`\`\n\n`;

  return { content, metadata: { date, type: config.type, files: data.files.length } };
}

function saveReport(report, config) {
  if (!fs.existsSync(config.output)) {
    fs.mkdirSync(config.output, { recursive: true });
  }
  const filename = `${config.output}${new Date().toISOString().split('T')[0]}-${config.type}-report.md`;
  fs.writeFileSync(filename, report.content);
  return filename;
}

function main() {
  const config = parseArgs();
  console.log('Generating report:', config.type);

  const memoryData = collectMemoryData();
  const gitData = collectGitData();
  const report = generateDailyReport(memoryData, gitData, config);
  const filename = saveReport(report, config);

  console.log('Report saved:', filename);
  console.log('Tokens estimated:', report.content.split(' ').length * 1.3);
}

main();
