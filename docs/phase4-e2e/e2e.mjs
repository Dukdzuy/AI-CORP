// Drives the Phase 4 end-to-end run against a running API (http://localhost:3000)
const API = 'http://localhost:3000/api';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let token;
async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return data;
}
async function login() {
  const r = await call('POST', '/auth/login', { email: 'admin@aicorp.com', password: 'admin123' });
  token = r.accessToken;
  return token;
}
async function runOf(projectId) {
  const p = await call('GET', `/projects/${projectId}`);
  return p.workflowRuns?.[0];
}
async function waitRun(projectId, statuses, timeoutMs = 120000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const run = await runOf(projectId);
    if (run && statuses.includes(run.status)) return run;
    if (Date.now() > end) throw new Error(`timeout: run ${run?.status} at ${run?.currentNodeId}`);
    await sleep(500);
  }
}


// Usage: node e2e.mjs template        → create a project from the OOAD template, wait for the approval pause, print the run tree
//        node e2e.mjs rollback <projectId> <runId> <nodeId>  → roll back to the snapshot before <nodeId>, resume, approve, wait
//        node e2e.mjs failing         → create a REST API project (stop the mock LLM first), wait for the failure
//        node e2e.mjs recover <projectId> <runId>            → roll back 1 step, resume, wait (start the mock LLM first)
const [mode, ...args] = process.argv.slice(2);
await login();
const show = (t, d = 0) => {
  console.log(`${'  '.repeat(d)}[${t.run.workflowDefId}@${t.run.workflowDefVersion} ${t.run.status}] ${t.steps.map(s => `${s.nodeId}:${s.status}`).join(', ')}`);
  t.children.forEach(c => show(c, d + 1));
};
if (mode === 'template') {
  const project = await call('POST', '/projects', {
    name: 'Online Shop (template)', description: 'Orders, products and payments',
    goal: 'Online shop with orders, products and payments for small businesses',
    templateId: 'ooad-software-project', templateParams: { parallelMarketing: true },
  });
  const run = await waitRun(project.id, ['paused', 'failed', 'completed']);
  show(await call('GET', `/workflows/runs/${run.id}`));
  console.log('snapshots', (await call('GET', `/workflows/runs/${run.id}/snapshots`)).map(s => `#${s.sequence} ${s.nodeId}`).join(', '));
  console.log({ projectId: project.id, runId: run.id });
} else if (mode === 'rollback') {
  const [projectId, runId, nodeId] = args;
  const snapshot = (await call('GET', `/workflows/runs/${runId}/snapshots`)).find(s => s.nodeId === nodeId);
  console.log((await call('POST', `/workflows/runs/${runId}/rollback`, { snapshotId: snapshot.id })).message);
  await call('POST', `/workflows/runs/${runId}/resume`);
  await waitRun(projectId, ['paused', 'failed', 'completed']);
  const [approval] = await call('GET', `/approvals?projectId=${projectId}`);
  if (approval) await call('POST', `/approvals/${approval.id}/approve`, { comment: 'ok' });
  console.log('final', (await waitRun(projectId, ['completed', 'failed'])).status);
  show(await call('GET', `/workflows/runs/${runId}`));
} else if (mode === 'failing') {
  const project = await call('POST', '/projects', {
    name: 'Inventory API', description: 'Backend only', goal: 'REST API backend for warehouse inventory and stock movements',
    templateId: 'rest-api-backend', templateParams: { database: 'MongoDB' },
  });
  const run = await waitRun(project.id, ['failed', 'completed', 'paused'], 180000);
  show(await call('GET', `/workflows/runs/${run.id}`));
  console.log({ projectId: project.id, runId: run.id });
} else if (mode === 'recover') {
  const [projectId, runId] = args;
  console.log((await call('POST', `/workflows/runs/${runId}/rollback`, { steps: 1 })).message);
  await call('POST', `/workflows/runs/${runId}/resume`);
  console.log('final', (await waitRun(projectId, ['completed', 'failed', 'paused'])).status);
  show(await call('GET', `/workflows/runs/${runId}`));
}
