// Drives the Phase 6 end-to-end run against a running API (http://localhost:3000) that uses
// the Phase 6 mock LLM (mock-llm.cjs in this folder, port 20128).
// Start the API with WEBHOOK_ALLOW_PRIVATE_NETWORKS=true (the receiver below is on localhost).
// Usage: node e2e.mjs [outDir]   → prints a log of every check; JSON answers go to outDir
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:3000/api';
const MOCK = 'http://127.0.0.1:20128';
const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const save = (file, data) => fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2));

async function call(method, p, { token, body } = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const ok = (r, label) => { if (r.status >= 300) throw new Error(`${label} -> ${r.status} ${JSON.stringify(r.data)}`); return r.data; };
const login = async (email, password) => ok(await call('POST', '/auth/login', { body: { email, password } }), `login ${email}`).accessToken;
const control = body => fetch(`${MOCK}/control`, { method: 'POST', body: JSON.stringify(body) });

// ---- webhook receiver --------------------------------------------------------------------
const received = [];
const receiver = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => { received.push({ event: req.headers['x-aicorp-event'], body: JSON.parse(body) }); res.writeHead(200).end('ok'); });
});
await new Promise(r => receiver.listen(4556, '127.0.0.1', r));

const admin = await login('admin@aicorp.com', 'admin123');
ok(await call('POST', '/integrations/webhooks', { token: admin, body: { url: 'http://127.0.0.1:4556/hook', events: ['agent.anomaly', 'workflow.failed'] } }), 'webhook');
await control({ failMarketing: false, reset: true });

async function runProject(name, description) {
  const project = ok(await call('POST', '/projects', {
    token: admin,
    body: { name, description, goal: 'Build an online shop where customers order, cancel and pay', templateId: 'ooad-software-project', templateParams: { humanApproval: false } },
  }), `create ${name}`);
  // The run's own status decides: a failing Marketing node is retried with backoff before the run fails
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const p = ok(await call('GET', `/projects/${project.id}`, { token: admin }), 'project');
    const run = (p.workflowRuns || []).find(r => !r.parentRunId) ?? p.workflowRuns?.[0];
    if (p.status === 'completed' || run?.status === 'completed') return { ...project, status: 'completed' };
    if (run?.status === 'failed') return { ...project, status: 'failed' };
  }
  throw new Error(`${name} did not finish`);
}

// ---- 1. History: projects of growing size -------------------------------------------------
const base = 'Customers browse a catalog, place orders, cancel them before shipping and pay invoices. ';
const sizes = [1, 2, 3, 4, 6, 8, 10, 12];
const projects = [];
for (const [i, n] of sizes.entries()) {
  const name = i === 3 ? 'Legacy Billing' : i === 5 ? 'Unsafe Portal' : `Shop ${i + 1}`;
  const p = await runProject(name, base.repeat(n));
  projects.push(p);
  console.log(`      ${name}: ${p.status}`);
}
check('8 projects completed through the OOAD workflow', projects.every(p => p.status === 'completed'));

// ---- 2. Estimation (Task 25) --------------------------------------------------------------
const model = ok(await call('GET', '/analytics/estimation', { token: admin }), 'estimation');
save('estimation-model.json', model);
const dev = model.roles.find(r => r.role === 'DEV');
check('the model is trained on the finished projects', model.trainingProjects === 8, `${model.trainingProjects} projects, ${model.roles.length} roles`);
check('roles with enough history use regression', dev.method === 'regression', `DEV ${dev.method}, LOO time error ${dev.evaluation.mapeDuration}`);
check('forecasts were stored at start and compared with the outcome', model.accuracy.length >= 6, `${model.accuracy.length} projects, mean |error| time ${model.meanAbsoluteDurationError}, cost ${model.meanAbsoluteCostError}`);

const last = projects[projects.length - 1];
const estimate = ok(await call('GET', `/projects/${last.id}/estimate`, { token: admin }), 'estimate');
save('project-estimate.json', estimate);
check('a project keeps its start and planned forecasts', estimate.history.map(h => h.stage).join() === 'start,planned', estimate.history.map(h => `${h.stage} ${h.durationMs} ms / $${h.cost}`).join(', '));
check('the finished project is compared with its first forecast', !!estimate.comparison, `time ${estimate.comparison?.durationError}, cost ${estimate.comparison?.costError}`);
const tasks = ok(await call('GET', `/tasks?projectId=${last.id}`, { token: admin }), 'tasks');
check('the PM\'s tasks carry an estimated cost', tasks.length > 0 && tasks.every(t => t.estimatedCost > 0), `${tasks.length} tasks at $${tasks[0]?.estimatedCost}`);
const first = ok(await call('GET', `/tasks?projectId=${projects[0].id}`, { token: admin }), 'tasks');
check('without history the first project has no estimate', first.every(t => t.estimatedCost === null));

// ---- 3. Code quality (Task 26) ------------------------------------------------------------
const legacy = projects[3];
const legacyQuality = ok(await call('GET', `/projects/${legacy.id}/code-quality`, { token: admin }), 'quality');
save('code-quality-legacy.json', legacyQuality);
check('Legacy Billing: the refined code is clean', legacyQuality.score >= 90 && legacyQuality.predictedQaVerdict === 'pass', `score ${legacyQuality.score}`);
const report = ok(await call('GET', `/projects/${legacy.id}/files/docs/code-quality.md`, { token: admin }), 'report');
const reportText = typeof report === 'string' ? report : report.content ?? JSON.stringify(report);
fs.writeFileSync(path.join(OUT, 'code-quality-legacy.md'), reportText);
check('the report says what the refinement changed', /Score before refinement: \d+\. Refined: src\/domain\/entities\/Order\.ts/.test(reportText), (reportText.match(/Score before refinement[^\n]*/) || [''])[0]);

const unsafe = projects[5];
const unsafePerf = ok(await call('GET', `/reports/performance?projectId=${unsafe.id}`, { token: admin }), 'perf');
const devRuns = unsafePerf.byRole.find(r => r.role === 'DEV')?.executions;
check('Unsafe Portal: QA rejected the unsafe code and DEV ran again', devRuns >= 2, `DEV ran ${devRuns}×`);
const unsafeQuality = ok(await call('GET', `/projects/${unsafe.id}/code-quality`, { token: admin }), 'quality');
check('Unsafe Portal ends with clean code', unsafeQuality.score >= 90, `score ${unsafeQuality.score}`);

// ---- 4. Analytics and anomalies (Task 24) -------------------------------------------------
let analytics = ok(await call('GET', '/analytics/agents?days=7', { token: admin }), 'analytics');
check('analytics cover the 8 roles', analytics.roles.length === 8, analytics.roles.map(r => `${r.rank}.${r.agentRole}`).join(' '));
const devRow = analytics.roles.find(r => r.agentRole === 'DEV');
check('DEV quality is the QA approval rate', devRow.quality.basis === 'QA reviews approved' && devRow.quality.value < 1, `${devRow.quality.value} over ${devRow.quality.samples} reviews`);
check('QA prediction accuracy is measured', analytics.qaPrediction.samples >= 8, JSON.stringify(analytics.qaPrediction));
check('no anomaly while everything works', analytics.anomalies.length === 0);

await control({ failMarketing: true });
const failed = [];
for (let i = 0; i < 3; i++) failed.push(await runProject(`Outage ${i + 1}`, base));
await control({ failMarketing: false });
check('3 runs fail at the Marketing step while the model is down', failed.every(p => p.status === 'failed'));
await sleep(2000);

analytics = ok(await call('GET', '/analytics/agents?days=7', { token: admin }), 'analytics');
save('agent-analytics.json', analytics);
const anomaly = analytics.anomalies.find(a => a.agentRole === 'MARKETING' && a.type === 'repeated_failures');
check('the repeated Marketing failures are an anomaly', !!anomaly, anomaly?.message);
const hook = received.filter(r => r.event === 'agent.anomaly');
check('the anomaly reached the webhook', hook.some(h => h.body.data.agentRole === 'MARKETING'), hook.map(h => `${h.body.data.agentRole}:${h.body.data.type}`).join(', '));
const audit = ok(await call('GET', '/audit?action=agent.anomaly', { token: admin }), 'audit');
check('the anomaly is in the audit log', audit.items.some(e => e.resourceId === 'MARKETING'), `${audit.items.length} entries`);
const failedHooks = received.filter(r => r.event === 'workflow.failed').length;
check('the failed runs were announced', failedHooks >= 3, `${failedHooks} workflow.failed deliveries`);
save('webhooks-received.json', received);

const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
fs.writeFileSync(path.join(OUT, 'projects.json'), JSON.stringify({ projects, failed }, null, 2));
receiver.close();
process.exit(passed === results.length ? 0 : 1);
