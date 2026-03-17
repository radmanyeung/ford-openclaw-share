#!/usr/bin/env node
/**
 * Provider Health Check (v4)
 * - Reads OpenClaw provider config
 * - Uses provider-specific adapters (OpenAI/Gemini/Jina)
 * - Includes OAuth-managed providers via auth-profiles token extraction
 * - Adds re-login assistance for OAuth failures
 * - Reports OK/FAIL/WARN without leaking secrets
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const asJson = args.includes('--json');
const assistLogin = args.includes('--assist-login');
const oauthDetails = args.includes('--oauth-details');
const timeoutMs = Number(getArg('--timeout') || '12000');
const cfgArg = getArg('--config');

const defaultConfigCandidates = [
  cfgArg,
  process.env.HOME + '/.openclaw/openclaw.json',
  process.env.HOME + '/.openclaw/workspace/openclaw.json',
  path.join(os.homedir(), '.openclaw', 'openclaw.json'),
  path.join(os.homedir(), '.openclaw', 'workspace', 'openclaw.json'),
].filter(Boolean);

const authProfileCandidates = [
  process.env.HOME + '/.openclaw/agents/main/agent/auth-profiles.json',
  path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json'),
];

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadJsonIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeError(text) {
  if (!text) return 'empty response';
  const t = String(text).slice(0, 1200);
  try {
    const j = JSON.parse(t);
    const msg = j?.error?.message || j?.message || j?.error;
    if (typeof msg === 'string') return msg.slice(0, 300);
  } catch {
    // ignore
  }
  return t.split('\n')[0].slice(0, 300);
}

function resolveEnvRef(value) {
  if (!value || typeof value !== 'string') return '';
  const m = value.match(/^\$\{([A-Z0-9_]+)\}$/i);
  if (!m) return value;
  return process.env[m[1]] || '';
}

function providerKind(providerName, model, baseUrl) {
  const b = String(baseUrl || '').toLowerCase();
  const m = String(model || '').toLowerCase();
  const n = String(providerName || '').toLowerCase();

  if (b.includes('generativelanguage.googleapis.com') || n.startsWith('google-') || m.includes('gemini')) {
    return 'google-gemini';
  }
  if (n === 'jina' || m.includes('embedding')) {
    return 'jina-embeddings';
  }
  return 'openai-compatible';
}

function loadAuthProfiles() {
  const p = firstExisting(authProfileCandidates);
  return { path: p, data: loadJsonIfExists(p) };
}

function oauthTokenForProvider(providerName, authProfiles) {
  const profiles = authProfiles?.data?.profiles || {};
  const lastGood = authProfiles?.data?.lastGood || {};

  const fromLastGoodId = lastGood[providerName];
  if (fromLastGoodId && profiles[fromLastGoodId]?.access) {
    return profiles[fromLastGoodId].access;
  }

  for (const p of Object.values(profiles)) {
    if (p?.provider === providerName && p?.access) return p.access;
  }
  return '';
}

function oauthProfileForProvider(providerName, authProfiles) {
  const profiles = authProfiles?.data?.profiles || {};
  const lastGood = authProfiles?.data?.lastGood || {};
  const fromLastGoodId = lastGood[providerName];

  if (fromLastGoodId && profiles[fromLastGoodId]) {
    return { id: fromLastGoodId, ...profiles[fromLastGoodId] };
  }

  for (const [id, p] of Object.entries(profiles)) {
    if (p?.provider === providerName) return { id, ...p };
  }

  return null;
}

function providersMarkedOAuthInConfig(config) {
  const set = new Set();
  const entries = Object.values(config?.auth?.profiles || {});
  for (const p of entries) {
    if (p?.provider && p?.mode === 'oauth') set.add(p.provider);
  }
  return set;
}

function isOAuthManagedProvider(providerName, provider, oauthConfiguredProviders, authProfiles) {
  const rawApiKey = String(provider?.apiKey || '');
  if (oauthConfiguredProviders.has(providerName)) return true;
  if (/-oauth$/i.test(rawApiKey)) return true;
  if (oauthProfileForProvider(providerName, authProfiles)) return true;
  return false;
}

function decodeJwtExpMs(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload?.exp) return null;
    return Number(payload.exp) * 1000;
  } catch {
    return null;
  }
}

function classifyAuthState({ oauthManaged, token, oauthProfile }) {
  if (!oauthManaged) return { authState: 'not-oauth', authExpiryMs: null };
  if (!token) return { authState: 'missing-token', authExpiryMs: null };

  const now = Date.now();
  const expFromProfile = Number(oauthProfile?.expires || 0) || null;
  const expFromJwt = decodeJwtExpMs(token);
  const authExpiryMs = expFromProfile || expFromJwt || null;

  if (authExpiryMs && authExpiryMs <= now) {
    return { authState: 'expired', authExpiryMs };
  }

  // Warn if expiring within 7 days
  const warnDays = 7 * 24 * 60 * 60 * 1000;
  if (authExpiryMs && authExpiryMs - now < warnDays) {
    return { authState: 'expiring-soon', authExpiryMs, expiresInDays: Math.ceil((authExpiryMs - now) / (24 * 60 * 60 * 1000)) };
  }

  return { authState: 'present', authExpiryMs };
}

function resolveAuth(providerName, provider, authProfiles) {
  const raw = provider?.apiKey ? String(provider.apiKey) : '';
  const envResolved = resolveEnvRef(raw);

  if (envResolved && !envResolved.endsWith('-oauth')) {
    return { token: envResolved, mode: 'apiKey/env' };
  }

  const oauthAccess = oauthTokenForProvider(providerName, authProfiles);
  if (oauthAccess) {
    return { token: oauthAccess, mode: 'oauth-access-token' };
  }

  return { token: '', mode: raw ? 'unresolved-placeholder' : 'missing' };
}

async function postJson(url, body, headers) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function poeRequestShapeMismatch(status, detail) {
  return status === 400 && /thinking\.enabled\.budget_tokens/i.test(detail || '');
}

async function checkOpenAICompatible(providerName, baseUrl, model, token) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const cleanBase = String(baseUrl).replace(/\/$/, '');

  const body = {
    model,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 8,
    temperature: 0,
  };

  const r1 = await postJson(`${cleanBase}/chat/completions`, body, headers);
  if (r1.ok) return { ok: true, status: r1.status, endpoint: '/chat/completions', detail: '' };

  const r2 = await postJson(
    `${cleanBase}/completions`,
    { model, prompt: 'ping', max_tokens: 8, temperature: 0 },
    headers,
  );
  if (r2.ok) return { ok: true, status: r2.status, endpoint: '/completions', detail: '' };

  const r1Detail = summarizeError(r1.text);
  const r2Detail = summarizeError(r2.text);

  if (String(providerName).toLowerCase().startsWith('poe ') && poeRequestShapeMismatch(r1.status, r1Detail)) {
    return {
      ok: true,
      warn: true,
      status: r1.status,
      endpoint: '/chat/completions',
      detail: 'reachable/authenticated, but provider-specific thinking schema mismatch',
    };
  }

  return {
    ok: false,
    status: `${r1.status}/${r2.status}`,
    endpoint: '/chat/completions & /completions',
    detail: r2Detail || r1Detail,
  };
}

async function checkGoogleGemini(baseUrl, model, token) {
  if (!token) {
    return { ok: false, status: '-', endpoint: '-', detail: 'missing auth token (API key or OAuth access token)' };
  }

  const cleanBase = String(baseUrl).replace(/\/$/, '');
  const endpoint = `/models/${encodeURIComponent(model)}:generateContent`;
  const url = `${cleanBase}${endpoint}`;
  const body = {
    contents: [{ parts: [{ text: 'ping' }] }],
    generationConfig: { maxOutputTokens: 8, temperature: 0 },
  };

  const headers = token.startsWith('ya29.') || token.startsWith('eyJ')
    ? { authorization: `Bearer ${token}` }
    : { 'x-goog-api-key': token };

  const r = await postJson(url, body, headers);
  if (r.ok) return { ok: true, status: r.status, endpoint, detail: '' };
  return { ok: false, status: r.status, endpoint, detail: summarizeError(r.text) };
}

async function checkJinaEmbeddings(baseUrl, model, token) {
  if (!token) {
    return { ok: false, status: '-', endpoint: '-', detail: 'missing API key/token' };
  }
  const cleanBase = String(baseUrl).replace(/\/$/, '');
  const endpoint = '/embeddings';
  const r = await postJson(
    `${cleanBase}${endpoint}`,
    { model, input: ['ping'] },
    { authorization: `Bearer ${token}` },
  );
  if (r.ok) return { ok: true, status: r.status, endpoint, detail: '' };
  return { ok: false, status: r.status, endpoint, detail: summarizeError(r.text) };
}

function suggestRecovery({ providerName, oauthManaged, result, authState }) {
  const s = String(result?.status || '');
  const d = String(result?.detail || '').toLowerCase();

  if (result.ok && !result.warn) return { severity: 'none', action: '' };
  if (result.ok && result.warn) {
    if (String(providerName).toLowerCase().startsWith('poe ')) {
      return { severity: 'low', action: 'Poe request schema mismatch; keep as WARN or add provider-specific thinking budget payload.' };
    }
    return { severity: 'low', action: 'Endpoint reachable with warning; inspect provider-specific request schema.' };
  }

  if (oauthManaged) {
    if (authState === 'missing-token' || authState === 'expired' || /401|403/.test(s) || d.includes('invalid') || d.includes('unauthorized') || d.includes('expired')) {
      return {
        severity: 'high',
        action: `Re-login: openclaw models auth login --provider ${providerName}`,
      };
    }
    if (authState === 'expiring-soon') {
      return {
        severity: 'medium',
        action: `OAuth token expiring soon. Re-login to refresh: openclaw models auth login --provider ${providerName}`,
      };
    }
  }

  if (s.includes('429') || d.includes('quota') || d.includes('billing') || d.includes('rate limit')) {
    return { severity: 'medium', action: 'Check provider quota/billing/rate-limit and retry.' };
  }

  if (s.includes('404') || d.includes('not found')) {
    return { severity: 'medium', action: 'Verify baseUrl/endpoint path and model id.' };
  }

  if (d.includes('timeout') || d.includes('aborted')) {
    return { severity: 'medium', action: 'Network timeout: increase --timeout or retry later.' };
  }

  return { severity: 'medium', action: 'Inspect provider config, credentials, and endpoint compatibility.' };
}

async function checkProvider(providerName, provider, ctx) {
  const model = provider?.models?.[0]?.id || provider?.models?.[0] || null;
  const baseUrl = provider?.baseUrl || provider?.endpoint || null;
  const { token, mode } = resolveAuth(providerName, provider, ctx.authProfiles);

  const oauthManaged = isOAuthManagedProvider(providerName, provider, ctx.oauthConfiguredProviders, ctx.authProfiles);
  const oauthProfile = oauthProfileForProvider(providerName, ctx.authProfiles);
  const { authState, authExpiryMs } = classifyAuthState({ oauthManaged, token, oauthProfile });

  if (!baseUrl || !model) {
    return {
      provider: providerName,
      model,
      kind: '-',
      oauthManaged,
      oauthProfile,
      authState,
      authExpiryMs,
      authMode: mode,
      status: '-',
      endpoint: '-',
      detail: 'missing baseUrl/model',
      recovery: suggestRecovery({ providerName, oauthManaged, result: { ok: false, status: '-', detail: 'missing baseUrl/model' }, authState }),
    };
  }

  const kind = providerKind(providerName, model, baseUrl);

  try {
    let r;
    if (kind === 'google-gemini') {
      r = await checkGoogleGemini(baseUrl, model, token);
    } else if (kind === 'jina-embeddings') {
      r = await checkJinaEmbeddings(baseUrl, model, token);
    } else {
      r = await checkOpenAICompatible(providerName, baseUrl, model, token);
    }

    return {
      provider: providerName,
      model,
      kind,
      authMode: mode,
      oauthManaged,
      oauthProfile,
      authState,
      authExpiryMs,
      warn: false,
      ...r,
      recovery: suggestRecovery({ providerName, oauthManaged, result: r, authState }),
    };
  } catch (error) {
    const detail = error?.name === 'AbortError' ? 'timeout/aborted' : String(error?.message || error).slice(0, 240);
    const failed = {
      ok: false,
      status: '-',
      endpoint: '-',
      detail,
    };

    return {
      provider: providerName,
      model,
      kind,
      authMode: mode,
      oauthManaged,
      oauthProfile,
      authState,
      authExpiryMs,
      warn: false,
      ...failed,
      recovery: suggestRecovery({ providerName, oauthManaged, result: failed, authState }),
    };
  }
}

function printLoginAssist(results) {
  const targets = results.filter((r) => !r.ok && r.oauthManaged && r.recovery?.action?.startsWith('Re-login:'));
  if (targets.length === 0) return;

  console.log('\nOAuth Re-Login Assist:');
  for (const r of targets) {
    console.log(`- ${r.provider}: ${r.recovery.action}`);
  }
}

async function main() {
  const cfgPath = firstExisting(defaultConfigCandidates);
  if (!cfgPath) {
    console.error('No OpenClaw config file found. Pass --config <path>.');
    process.exit(3);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to parse config: ${cfgPath}`);
    console.error(String(error?.message || error));
    process.exit(3);
  }

  const providers = config?.models?.providers || {};
  const entries = Object.entries(providers);
  const authProfiles = loadAuthProfiles();
  const oauthConfiguredProviders = providersMarkedOAuthInConfig(config);

  if (entries.length === 0) {
    console.error(`No providers found in config: ${cfgPath}`);
    process.exit(3);
  }

  const ctx = { authProfiles, oauthConfiguredProviders };

  const results = [];
  for (const [name, provider] of entries) {
    results.push(await checkProvider(name, provider, ctx));
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ config: cfgPath, authProfiles: authProfiles.path, timeoutMs, results }, null, 2)}\n`);
  } else {
    console.log(`Config: ${cfgPath}`);
    if (authProfiles.path) console.log(`Auth profiles: ${authProfiles.path}`);

    for (const r of results) {
      if (r.ok && r.warn) {
        console.log(`WARN ${r.provider}  model=${r.model}  ${r.detail}`);
      } else if (r.ok) {
        console.log(`OK   ${r.provider}  model=${r.model}  via ${r.endpoint}`);
      } else {
        const authHint = r.oauthManaged ? ` oauth=${r.authState}` : '';
        console.log(`FAIL ${r.provider}  model=${r.model || '-'}  (${r.status})${authHint}  ${r.detail}`);
        if (r.recovery?.action) {
          console.log(`     ↳ ${r.recovery.action}`);
        }
      }
    }

    if (assistLogin) {
      printLoginAssist(results);
    }

    // OAuth detailed info
    if (oauthDetails) {
      console.log('\n=== OAuth Details ===\n');
      for (const r of results) {
        if (r.oauthProfile) {
          const exp = r.oauthProfile.expires ? new Date(Number(r.oauthProfile.expires)).toISOString() : 'unknown';
          const email = r.oauthProfile.email || 'N/A';
          console.log(`${r.provider}:`);
          console.log(`  Email: ${email}`);
          console.log(`  Expires: ${exp}`);
          console.log(`  State: ${r.authState}`);
          console.log('');
        }
      }
    }
  }

  const hardFail = results.some((r) => !r.ok);
  process.exit(hardFail ? 2 : 0);
}

main().catch((error) => {
  console.error(`Fatal: ${String(error?.message || error)}`);
  process.exit(3);
});
