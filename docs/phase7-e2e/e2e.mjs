// Phase 7 end-to-end check of the production stack and the demo (Tasks 31–32).
// Runs against the web entry point (nginx in front of the API), after scripts/demo/seed-demo.mjs.
//   node docs/phase7-e2e/e2e.mjs [webUrl] [outDir]     (default http://localhost:8080)
// Env: ALLOWED_ORIGIN (the API's CORS_ORIGIN, default http://localhost:8080).
// Exit code 1 if a check fails.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const here = path.dirname(new URL(import.meta.url).pathname);
const WEB = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const API = `${WEB}/api`;
const OUT = process.argv[3] || path.join(here, 'out');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:8080';
const PASSWORD = process.env.DEMO_USER_PASSWORD || 'demo-2026';
const { io } = createRequire(path.join(here, '../../apps/web/package.json'))('socket.io-client');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const save = (file, data) => fs.writeFileSync(path.join(OUT, file), typeof data === 'string' ? data : JSON.stringify(data, null, 2));

async function call(method, p, { token, body, headers = {} } = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}
const ok = (r, label) => {
  if (r.status >= 300) throw new Error(`${label} -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
};
const login = async (email) => ok(await call('POST', '/auth/login', { body: { email, password: PASSWORD } }), `login ${email}`).accessToken;
const socketConnects = (token) =>
  new Promise((resolve) => {
    const socket = io(WEB, { auth: { token }, transports: ['websocket'], reconnection: false });
    // resolve first: close() emits 'disconnect' synchronously, which would resolve false
    const done = (value) => { resolve(value); socket.close(); };
    socket.on('connect', () => setTimeout(() => done(socket.connected), 500));
    socket.on('disconnect', () => done(false));
    socket.on('connect_error', () => done(false));
    setTimeout(() => done(false), 5000);
  });

// ---- 1. Production stack (Task 32) ---------------------------------------------------------
const health = await call('GET', '/health');
save('health.json', health.data);
check('readiness through nginx: database, Redis and LLM gateway healthy',
  health.status === 200 && health.data.status === 'healthy' && ['database', 'redis', 'ninerouter'].every((n) => health.data.checks.some((c) => c.name === n && c.status === 'healthy')),
  health.data.checks?.map((c) => `${c.name} ${c.status}`).join(', '));
check('liveness endpoint', (await call('GET', '/health/live')).status === 200);
check('Swagger disabled in production (ENABLE_SWAGGER=false)', (await call('GET', '/docs')).status === 404);
const corsAllowed = await fetch(`${API}/health`, { headers: { Origin: ALLOWED_ORIGIN } });
const corsOther = await fetch(`${API}/health`, { headers: { Origin: 'https://evil.example' } });
check('CORS only for CORS_ORIGIN',
  corsAllowed.headers.get('access-control-allow-origin') === ALLOWED_ORIGIN && !corsOther.headers.get('access-control-allow-origin'),
  `${ALLOWED_ORIGIN} → ${corsAllowed.headers.get('access-control-allow-origin')}, evil.example → ${corsOther.headers.get('access-control-allow-origin')}`);
const deepLink = await fetch(`${WEB}/projects/some-id`);
check('single-page app routes served by nginx', deepLink.status === 200 && (await deepLink.text()).includes('<div id="root">'));

const board = await login('board@aicorp.demo');
const viewer = await login('viewer@aicorp.demo');
check('realtime: Socket.IO through nginx accepts the login token', await socketConnects(board));
check('realtime: a forged token is disconnected', !(await socketConnects(board.slice(0, -4) + 'AAAA')));

// ---- 2. Demo data (Task 31) ----------------------------------------------------------------
const projects = ok(await call('GET', '/projects', { token: board }), 'projects');
const byName = Object.fromEntries(projects.map((p) => [p.name, p]));
const expected = ['Online Bookstore', 'Legacy Billing', 'Unsafe Portal', 'Library Loans (design)', 'Clinic Booking'];
check('demo projects present', expected.every((n) => byName[n]), expected.filter((n) => !byName[n]).join(', '));
const detail = {};
for (const name of expected) detail[name] = ok(await call('GET', `/projects/${byName[name].id}`, { token: board }), name);
const topRun = (p) => (p.workflowRuns || []).find((r) => !r.parentRunId) ?? p.workflowRuns?.[0];
check('4 demo projects completed', expected.slice(0, 4).every((n) => topRun(detail[n])?.status === 'completed'),
  expected.map((n) => `${n}: ${topRun(detail[n])?.status}`).join('; '));

const bookstore = byName['Online Bookstore'].id;
const files = ok(await call('GET', `/projects/${bookstore}/files`, { token: board }), 'files').files.map((f) => f.path);
save('bookstore-files.json', files);
check('Online Bookstore has its OOAD artifacts, code and tests',
  ['docs/use-cases.md', 'docs/class-diagram.puml', 'docs/traceability-matrix.md'].every((f) => files.includes(f)) && files.some((f) => f.startsWith('src/domain/')) && files.some((f) => f.startsWith('tests/')),
  `${files.length} files`);
const metrics = ok(await call('GET', `/ooad-metrics/project/${bookstore}`, { token: board }), 'metrics');
save('bookstore-metrics.json', metrics);
check('Online Bookstore: OOAD gate passed and acceptance tests executed',
  metrics.gatePassRate === 100 && metrics.traceability?.executed && metrics.traceability.testsFailed === 0,
  `gate ${metrics.gatePassRate}%, coverage ${metrics.testCoverage}%, tests ${metrics.traceability?.testsPassed} passed`);

const legacyQuality = ok(await call('GET', `/projects/${byName['Legacy Billing'].id}/code-quality`, { token: board }), 'code quality');
save('legacy-code-quality.json', legacyQuality);
const legacyReport = ok(await call('GET', `/projects/${byName['Legacy Billing'].id}/files/docs/code-quality.md`, { token: board }), 'report');
const legacyText = typeof legacyReport === 'string' ? legacyReport : legacyReport.content ?? JSON.stringify(legacyReport);
check('Legacy Billing: DEV refined the code before QA', /Refined: src\/domain\/entities\/Order\.ts/.test(legacyText), (legacyText.match(/Score before refinement: \d+/) || [''])[0]);

// The run view nests sub-workflow runs (analysis_design, build) under children
const unsafeRun = ok(await call('GET', `/workflows/runs/${topRun(detail['Unsafe Portal']).id}`, { token: board }), 'run');
save('unsafe-run.json', unsafeRun);
const stepsOf = (view) => [...(view.steps || []), ...(view.children || []).flatMap(stepsOf)];
const unsafeSteps = stepsOf(unsafeRun);
const devSteps = unsafeSteps.filter((s) => s.agentRole === 'DEV').length;
const qaSteps = unsafeSteps.filter((s) => s.agentRole === 'QA').length;
check('Unsafe Portal: QA sent the code back to DEV once', devSteps === 2 && qaSteps === 2, `${devSteps} DEV steps, ${qaSteps} QA reviews`);

// ---- 3. Live part of the demo -------------------------------------------------------------
const viewerCreate = await call('POST', '/projects', { token: viewer, body: { name: 'Viewer attempt', description: 'x', goal: 'x' } });
check('RBAC: the viewer cannot create a project', viewerCreate.status === 403);

const clinic = byName['Clinic Booking'].id;
const approvals = ok(await call('GET', `/approvals?projectId=${clinic}`, { token: board }), 'approvals');
const pending = approvals.find((a) => a.status === 'pending');
check('Clinic Booking waits for the board member\'s approval', !!pending);
if (pending) {
  check('viewer cannot answer the approval', (await call('POST', `/approvals/${pending.id}/approve`, { token: viewer })).status === 403);
  // The socket used to accept approval answers from anyone (no permission, assignee or audit check)
  const socket = io(WEB, { auth: { token: viewer }, transports: ['websocket'], reconnection: false });
  await new Promise((r) => socket.on('connect', r));
  const ack = await new Promise((r) => socket.emit('human:approval_response', { approvalId: pending.id, status: 'approved' }, r));
  socket.close();
  await sleep(1000);
  const stillPending = ok(await call('GET', `/approvals?projectId=${clinic}`, { token: board }), 'approvals').some((a) => a.id === pending.id);
  check('viewer cannot answer the approval over the WebSocket either', ack?.status === 'error' && stillPending, JSON.stringify(ack));
  ok(await call('POST', `/approvals/${pending.id}/approve`, { token: board, body: { comment: 'Approved during the demo' } }), 'approve');
  let status;
  for (let i = 0; i < 120 && status !== 'completed' && status !== 'failed'; i++) {
    await sleep(500);
    status = topRun(ok(await call('GET', `/projects/${clinic}`, { token: board }), 'clinic'))?.status;
  }
  check('after the approval the CEO closes Clinic Booking', status === 'completed', status);
}

const pdf = await call('GET', `/projects/${bookstore}/export?format=pdf`, { token: board });
if (pdf.status === 200) save('online-bookstore.pdf', pdf.data);
check('PDF export of a demo project', pdf.status === 200 && Buffer.isBuffer(pdf.data) && pdf.data.subarray(0, 4).toString() === '%PDF', `${pdf.data.length} bytes`);

const analytics = ok(await call('GET', '/analytics/agents?days=30', { token: board }), 'analytics');
save('agent-analytics.json', analytics);
const roles = (analytics.agents || analytics.roles || analytics.leaderboard || []).map((a) => a.role ?? a.agentRole);
check('agent analytics cover the 8 roles', ['CEO', 'BA', 'ARCHITECT', 'PM', 'DEV', 'QC', 'QA', 'MARKETING'].every((r) => roles.includes(r)), roles.join(', '));

const audit = ok(await call('GET', '/audit?pageSize=200', { token: await (async () => ok(await call('POST', '/auth/login', { body: { email: process.env.DEMO_ADMIN_EMAIL || 'admin@aicorp.com', password: process.env.DEMO_ADMIN_PASSWORD || 'admin123' } }), 'admin').accessToken)() }), 'audit');
const actions = new Set((audit.items || audit.entries || audit.data || audit).map((e) => e.action));
check('audit log records the demo (logins, project creation, approval)', ['auth.login', 'project.create', 'approval.approve'].every((a) => actions.has(a)), [...actions].slice(0, 12).join(', '));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
save('results.json', results);
process.exit(failed.length ? 1 : 0);
