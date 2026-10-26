#!/usr/bin/env node
/**
 * Lightweight load test of the AI-CORP API (Phase 6, Task 28).
 *
 * Runs a weighted mix of the requests a dashboard user makes, with N virtual users for a
 * fixed duration, then reports throughput, error rate and p50/p95/p99 latency per endpoint
 * against the budgets in budgets.json. Exits with code 1 when a budget is missed.
 * No dependencies: Node 18+ (global fetch).
 *
 *   node scripts/perf/load-test.mjs --api http://localhost:3000/api --users 20 --duration 30 \
 *        --email admin@aicorp.com --password admin123 [--create-every 10] [--out report.md]
 *
 * --create-every N: one virtual user in N creates a project (this starts a workflow run,
 * so point the API at a mock LLM). 0 disables project creation.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]]] : pairs), [])
);
const API = args.api ?? 'http://localhost:3000/api';
const USERS = Number(args.users ?? 20);
const DURATION_S = Number(args.duration ?? 30);
const CREATE_EVERY = Number(args['create-every'] ?? 0);
const here = path.dirname(new URL(import.meta.url).pathname);
const budgets = JSON.parse(fs.readFileSync(args.budgets ?? path.join(here, 'budgets.json'), 'utf8'));

async function request(method, url, token, body) {
  const started = performance.now();
  try {
    const res = await fetch(API + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { ms: performance.now() - started, status: res.status, data: text ? safeJson(text) : null };
  } catch (err) {
    return { ms: performance.now() - started, status: 0, data: String(err) };
  }
}
const safeJson = t => { try { return JSON.parse(t); } catch { return t; } };

// ---- setup ---------------------------------------------------------------------------
const login = await request('POST', '/auth/login', null, { email: args.email ?? 'admin@aicorp.com', password: args.password ?? 'admin123' });
if (login.status >= 300) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.data)}`);
const token = login.data.accessToken;
const projects = (await request('GET', '/projects', token)).data;
const ids = Array.isArray(projects) ? projects.map(p => p.id) : [];
if (!ids.length) console.warn('No projects yet: project-specific requests are skipped');
const pick = list => list[Math.floor(Math.random() * list.length)];

/** The request mix: [label, weight, () => request] */
const MIX = [
  ['GET /health', 5, () => request('GET', '/health')],
  ['GET /projects', 25, () => request('GET', '/projects', token)],
  ['GET /projects/:id', 20, () => request('GET', `/projects/${pick(ids)}`, token), true],
  ['GET /tasks?projectId', 10, () => request('GET', `/tasks?projectId=${pick(ids)}`, token), true],
  ['GET /reports/projects/:id/cost', 10, () => request('GET', `/reports/projects/${pick(ids)}/cost`, token), true],
  ['GET /analytics/agents', 10, () => request('GET', '/analytics/agents?days=30', token)],
  ['GET /projects/:id/estimate', 10, () => request('GET', `/projects/${pick(ids)}/estimate`, token), true],
  ['GET /projects/:id/code-quality', 10, () => request('GET', `/projects/${pick(ids)}/code-quality`, token), true],
].filter(([, , , needsProject]) => !needsProject || ids.length);
const totalWeight = MIX.reduce((s, m) => s + m[1], 0);
const choose = () => {
  let r = Math.random() * totalWeight;
  for (const m of MIX) if ((r -= m[1]) < 0) return m;
  return MIX[0];
};

// ---- run -----------------------------------------------------------------------------
const samples = new Map(); // label → { ms: number[], errors: number, statuses: {} }
const record = (label, res) => {
  if (!samples.has(label)) samples.set(label, { ms: [], errors: 0, statuses: {} });
  const s = samples.get(label);
  s.ms.push(res.ms);
  s.statuses[res.status] = (s.statuses[res.status] ?? 0) + 1;
  if (res.status === 0 || res.status >= 400) s.errors++;
};

const deadline = Date.now() + DURATION_S * 1000;
let created = 0;
async function virtualUser(n) {
  while (Date.now() < deadline) {
    if (CREATE_EVERY > 0 && n % CREATE_EVERY === 0 && Math.random() < 0.1) {
      const res = await request('POST', '/projects', token, {
        name: `Load test ${n}-${created++}`,
        description: 'Load test project: a small library system to borrow and return books.',
        goal: 'Measure the API under concurrent use without changing behaviour',
      });
      record('POST /projects', res);
      continue;
    }
    const [label, , run] = choose();
    record(label, await run());
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => virtualUser(i)));
const elapsed = (Date.now() - started) / 1000;

// ---- report --------------------------------------------------------------------------
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0);
const rows = [];
let total = 0, errors = 0, violations = 0;
for (const [label, s] of [...samples.entries()].sort()) {
  const sorted = [...s.ms].sort((a, b) => a - b);
  const budget = budgets.endpoints[label] ?? budgets.default;
  const r = { label, n: sorted.length, p50: pct(sorted, 50), p95: pct(sorted, 95), p99: pct(sorted, 99), errors: s.errors, statuses: s.statuses, budget };
  r.ok = r.p50 <= budget.p50 && r.p95 <= budget.p95 && r.p99 <= budget.p99;
  if (!r.ok) violations++;
  total += r.n;
  errors += s.errors;
  rows.push(r);
}
const errorRate = total ? errors / total : 0;
const errorOk = errorRate <= budgets.maxErrorRate;
const fmt = ms => `${Math.round(ms)}`;

const lines = [
  `# Load test ${new Date().toISOString()}`,
  '',
  `${USERS} virtual users for ${DURATION_S} s against \`${API}\`: **${total} requests, ${(total / elapsed).toFixed(1)} req/s, error rate ${(errorRate * 100).toFixed(2)} %** (budget ${(budgets.maxErrorRate * 100).toFixed(0)} %)${CREATE_EVERY ? `, ${created} projects created` : ''}.`,
  '',
  '| Endpoint | Requests | p50 ms | p95 ms | p99 ms | Budget p50/p95/p99 | Errors | Result |',
  '|----------|---------:|-------:|-------:|-------:|--------------------|-------:|--------|',
  ...rows.map(r => `| \`${r.label}\` | ${r.n} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${r.budget.p50}/${r.budget.p95}/${r.budget.p99} | ${r.errors} | ${r.ok ? 'within budget' : '**over budget**'} |`),
  '',
];
const report = lines.join('\n');
console.log(report);
if (args.out) fs.writeFileSync(args.out, report);
process.exit(violations || !errorOk ? 1 : 0);
