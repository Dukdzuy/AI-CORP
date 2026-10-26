// Drives the Phase 5 end-to-end run against a running API (http://localhost:3000).
// Start the API with WEBHOOK_ALLOW_PRIVATE_NETWORKS=true (the receiver below is on localhost)
// and API_RATE_LIMIT_PER_MINUTE=20 (so the rate limit is reached quickly).
// Usage: node e2e.mjs [outDir]   → prints a log of every check; exported files go to outDir
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:3000/api';
const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function call(method, p, { token, apiKey, body, raw } = {}) {
  const res = await fetch(API + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const ok = (r, label) => { if (r.status >= 300) throw new Error(`${label} -> ${r.status} ${JSON.stringify(r.data)}`); return r.data; };
const login = async (email, password) => ok(await call('POST', '/auth/login', { body: { email, password } }), `login ${email}`).accessToken;
async function register(name, email) {
  const r = await call('POST', '/auth/register', { body: { name, email, password: 'secret123' } });
  if (r.status !== 201 && r.status !== 409) throw new Error(`register ${email}: ${r.status}`);
  return login(email, 'secret123');
}

// ---- Webhook receiver that verifies signatures ----------------------------------
const received = [];
let SECRET = null;
const receiver = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const ts = Number(req.headers['x-aicorp-timestamp']);
    const sig = req.headers['x-aicorp-signature'];
    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET ?? '').update(`${ts}.${body}`).digest('hex');
    received.push({ event: req.headers['x-aicorp-event'], valid: sig === expected, body: JSON.parse(body) });
    res.writeHead(200).end('ok');
  });
});
await new Promise(r => receiver.listen(4555, '127.0.0.1', r));

// ---- 1. Authentication is global --------------------------------------------------
check('health is public', (await call('GET', '/health')).status === 200);
check('projects need a token', (await call('GET', '/projects')).status === 401);

const admin = await login('admin@aicorp.com', 'admin123');
const me = ok(await call('GET', '/auth/me', { token: admin }), 'me');
check('admin has every permission', me.permissions.length === 13, `${me.permissions.length} permissions`);

// ---- 2. RBAC: roles and ownership ---------------------------------------------------
const alice = await register('Alice (board)', 'alice@aicorp.com');
const carol = await register('Carol (board)', 'carol@aicorp.com');
let bob = await register('Bob (viewer)', 'bob@aicorp.com');
const users = ok(await call('GET', '/users', { token: admin }), 'users');
const bobId = users.find(u => u.email === 'bob@aicorp.com').id;
const role = ok(await call('PATCH', `/users/${bobId}/role`, { token: admin, body: { role: 'viewer' } }), 'role');
check('admin makes Bob a viewer', role.role === 'viewer' && role.permissions.join() === 'project:read,report:view');
check('role change applies to the existing token', (await call('GET', '/auth/me', { token: bob })).data.role === 'viewer');
check('viewer cannot create a project', (await call('POST', '/projects', { token: bob, body: { name: 'Nope', description: 'x', goal: 'A goal long enough to be valid here' } })).status === 403);
check('viewer can list projects', (await call('GET', '/projects', { token: bob })).status === 200);
check('viewer cannot read the audit log', (await call('GET', '/audit', { token: bob })).status === 403);
check('board member cannot manage users', (await call('GET', '/users', { token: alice })).status === 403);
const adminId = users.find(u => u.email === 'admin@aicorp.com').id;
check('last admin cannot be demoted', (await call('PATCH', `/users/${adminId}/role`, { token: admin, body: { role: 'viewer' } })).status === 409);

// ---- 3. Integration: webhook + API key -------------------------------------------
const hook = ok(await call('POST', '/integrations/webhooks', {
  token: alice,
  body: { url: 'http://127.0.0.1:4555/hook', events: ['project.created', 'workflow.started', 'quality.gate.evaluated', 'approval.requested', 'workflow.completed', 'report.generated'] },
}), 'webhook');
SECRET = hook.secret;
check('webhook secret returned once', !!hook.secret && !(ok(await call('GET', '/integrations/webhooks', { token: alice }), 'list')[0].secret));
const test = ok(await call('POST', `/integrations/webhooks/${hook.id}/test`, { token: alice }), 'test');
check('test delivery succeeds', test.ok && test.responseCode === 200);

const issued = ok(await call('POST', '/integrations/api-keys', {
  token: alice, body: { name: 'CI pipeline', scopes: ['project:read', 'project:create', 'project:export'] },
}), 'key');
const KEY = issued.token;
check('API key issued (token shown once)', /^aic_[a-z0-9]{12}_/.test(KEY));
check('viewer cannot grant beyond role', (await call('POST', '/integrations/api-keys', { token: bob, body: { name: 'x', scopes: ['project:create'] } })).status === 403);
check('key with a scope beyond the role is refused', (await call('POST', '/integrations/api-keys', { token: alice, body: { name: 'x', scopes: ['user:manage'] } })).status === 400);
check('API key rejected outside /api/v1', (await call('GET', '/projects', { apiKey: KEY })).status === 401);
check('API key limited to its scopes', (await call('GET', '/v1/projects/any/reports/cost', { apiKey: KEY })).status === 403);
check('wrong API key rejected', (await call('GET', '/v1/projects', { apiKey: KEY.slice(0, -2) + 'xx' })).status === 401);

const created = ok(await call('POST', '/v1/projects', {
  apiKey: KEY,
  body: { name: 'Thư viện số (API)', description: 'Mượn và trả sách', goal: 'Hệ thống quản lý thư viện số cho trường học', budget: 5, templateId: 'ooad-software-project' },
}), 'v1 create');
check('project created through /api/v1 with the key', !!created.id, created.statusUrl);
const projectId = created.id;

// ---- 4. Workflow runs; approval ownership ------------------------------------------
let status;
for (let i = 0; i < 240; i++) {
  status = ok(await call('GET', `/v1/projects/${projectId}/status`, { apiKey: KEY }), 'status');
  if (status.pendingApprovals > 0 || ['failed', 'completed'].includes(status.workflow?.status)) break;
  await sleep(500);
}
check('status endpoint follows the run', status.pendingApprovals === 1, `${status.workflow.status} at ${status.workflow.currentNodeId}, ${status.workflow.stepsCompleted} steps, coverage ${status.traceabilityCoverage}`);
const approval = ok(await call('GET', `/approvals?projectId=${projectId}`, { token: alice }), 'approvals')[0];
check('another board member cannot answer Alice\'s approval', (await call('POST', `/approvals/${approval.id}/approve`, { token: carol })).status === 403);
check('viewer cannot approve', (await call('POST', `/approvals/${approval.id}/approve`, { token: bob })).status === 403);
ok(await call('POST', `/approvals/${approval.id}/approve`, { token: alice, body: { comment: 'Looks good' } }), 'approve');
for (let i = 0; i < 120; i++) {
  status = ok(await call('GET', `/v1/projects/${projectId}/status`, { apiKey: KEY }), 'status');
  if (status.workflow.status !== 'running' && status.workflow.status !== 'paused') break;
  await sleep(500);
}
check('run completes after approval', status.workflow.status === 'completed');

// ---- 5. Ownership and before/after audit --------------------------------------------
check('another board member cannot edit the project', (await call('PATCH', `/projects/${projectId}`, { token: carol, body: { budget: 50 } })).status === 403);
ok(await call('PATCH', `/projects/${projectId}`, { token: alice, body: { budget: 12 } }), 'owner edit');
const upd = ok(await call('GET', `/audit?action=project.update&projectId=${projectId}`, { token: admin }), 'audit').items[0];
check('update audited with before/after', upd?.changes?.diff?.some(d => d.field === 'budget'), JSON.stringify(upd?.changes?.diff));

const keyPdf = await call('GET', `/v1/projects/${projectId}/export?format=pdf`, { apiKey: KEY, raw: true });
check('export through the API key', keyPdf.status === 200 && keyPdf.headers.get('content-type') === 'application/pdf', `status ${keyPdf.status}`);

// ---- 6. Rate limits ----------------------------------------------------------------
let limited;
for (let i = 0; i < 25; i++) {
  limited = await call('GET', '/v1/projects', { apiKey: KEY });
  if (limited.status === 429) break;
}
check('API key rate limited (429 + Retry-After)', limited.status === 429 && !!limited.headers.get('retry-after'), `limit ${limited.headers.get('x-ratelimit-limit')}`);
let failed = 0, loginLimited = null;
for (let i = 0; i < 12; i++) {
  const r = await call('POST', '/auth/login', { body: { email: 'carol@aicorp.com', password: 'wrong-password' } });
  if (r.status === 401) failed++;
  if (r.status === 429) { loginLimited = r; break; }
}
check('login rate limited (10 per minute per IP + email)', loginLimited?.status === 429, `${failed} failed logins first`);

// ---- 7. Exports and reports ---------------------------------------------------------
for (const format of ['json', 'csv', 'pdf']) {
  const res = await call('GET', `/projects/${projectId}/export?format=${format}`, { token: alice, raw: true });
  const buf = Buffer.from(await res.arrayBuffer());
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || `export.${format}`;
  fs.writeFileSync(path.join(OUT, name), buf);
  const valid = format === 'pdf' ? buf.subarray(0, 5).toString() === '%PDF-' : format === 'json' ? !!JSON.parse(buf.toString()).project : buf.toString().includes('task_id');
  check(`export ${format}`, res.status === 200 && valid, `${name}, ${buf.length} bytes`);
}
const cost = ok(await call('GET', `/reports/projects/${projectId}/cost`, { token: bob }), 'cost');
check('viewer reads the cost report', cost.calls > 0, `$${cost.total} over ${cost.calls} calls, ${cost.byAgent.length} agents`);
const perf = ok(await call('GET', `/reports/performance?projectId=${projectId}`, { token: bob }), 'perf');
check('performance report', perf.byRole.length > 0, perf.byRole.slice(0, 3).map(r => `${r.role} ${r.executions}x ${Math.round(r.successRate * 100)}%`).join(', '));

// The workflow completed, so make one project active for the weekly report
const p2 = ok(await call('POST', '/projects', { token: alice, body: { name: 'Weekly report demo', description: 'x', goal: 'A project that is still running this week' } }), 'p2');
await sleep(1500);
const weekly = ok(await call('POST', '/reports/weekly/run', { token: admin }), 'weekly');
const weekly2 = ok(await call('POST', '/reports/weekly/run', { token: admin }), 'weekly2');
check('weekly report written once per week', weekly.generated.length >= 1 && weekly2.generated.length === 0, `${weekly.period}: ${weekly.generated.map(g => g.path).join(', ')}`);
const file = await call('GET', `/projects/${p2.id}/files/reports/weekly-${weekly.period}.md`, { token: alice });
check('weekly report readable in Artifacts', file.status === 200);

// ---- 8. Audit log, anomalies, CSV ---------------------------------------------------
const audit = ok(await call('GET', '/audit?pageSize=200', { token: admin }), 'audit');
const actions = [...new Set(audit.items.map(e => e.action))].sort();
check('audit has user, system and agent actions', ['project.create', 'auth.login', 'access.denied', 'workflow.completed', 'agent.task_completed', 'approval.approve'].every(a => actions.includes(a)), actions.join(', '));
const anomalies = ok(await call('GET', '/audit/anomalies', { token: admin }), 'anomalies');
check('failed logins detected as an anomaly', anomalies.some(a => a.rule === 'repeated_failed_login'), anomalies.map(a => a.message).join(' | '));
const csv = await call('GET', '/audit/export?action=project.*', { token: admin, raw: true });
const csvText = await csv.text();
fs.writeFileSync(path.join(OUT, 'audit-projects.csv'), csvText);
check('audit CSV export', csvText.includes('project.create') && csvText.split('\n')[0].includes('timestamp'), `${csvText.trim().split('\n').length - 1} rows`);

// ---- 9. Webhooks received and signed ---------------------------------------------------
await sleep(1500);
const events = received.map(r => r.event);
check('webhooks delivered for the run', ['project.created', 'workflow.started', 'approval.requested', 'workflow.completed', 'report.generated'].every(e => events.includes(e)), [...new Set(events)].join(', '));
check('every delivery correctly signed', received.length > 0 && received.every(r => r.valid), `${received.length} deliveries`);
const deliveries = ok(await call('GET', `/integrations/webhooks/${hook.id}/deliveries`, { token: alice }), 'deliveries');
check('deliveries recorded', deliveries.length >= received.length - 1, `${deliveries.length} rows`);

// ---- 10. OpenAPI ------------------------------------------------------------------------
const spec = await (await fetch('http://localhost:3000/api/docs-json')).json();
check('OpenAPI documents /api/v1', !!spec.paths['/api/v1/projects'] && !!spec.components.securitySchemes['api-key'], Object.keys(spec.paths).length + ' paths');

// ---- 11. Revocation -----------------------------------------------------------------------
ok(await call('DELETE', `/integrations/api-keys/${issued.apiKey.id}`, { token: alice }), 'revoke');
check('revoked key rejected', (await call('GET', '/v1/projects', { apiKey: KEY })).status === 401);
const bobRow = (await call('PATCH', `/users/${bobId}/active`, { token: admin, body: { isActive: false } })).data;
check('deactivated user loses access at once', bobRow.isActive === false && (await call('GET', '/projects', { token: bob })).status === 401);

receiver.close();
const failedChecks = results.filter(r => !r.ok);
console.log(`\n${results.length - failedChecks.length}/${results.length} checks passed; projectId ${projectId}`);
fs.writeFileSync(path.join(OUT, 'webhooks-received.json'), JSON.stringify(received.map(r => ({ event: r.event, valid: r.valid, data: r.body.data })), null, 2));
process.exit(failedChecks.length ? 1 : 0);
