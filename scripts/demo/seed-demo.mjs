// Prepares the thesis demo (Phase 7, Task 31): demo accounts and projects at different stages,
// created through the public API like a user would, so every screen has something to show.
//
//   node scripts/demo/seed-demo.mjs [apiUrl]        (default http://localhost:3000/api)
//
// Needs a running API whose LLM is scripts/demo/demo-llm.cjs (or a real gateway) and the
// seeded admin (DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD, default admin@aicorp.com / admin123).
// Safe to rerun: existing accounts are reused and projects that already exist are skipped.
// Exit code 1 if a project ends in an unexpected state.

const API = (process.argv[2] || process.env.DEMO_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const ADMIN = { email: process.env.DEMO_ADMIN_EMAIL || 'admin@aicorp.com', password: process.env.DEMO_ADMIN_PASSWORD || 'admin123' };
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'demo-2026';
const GOAL = 'Deliver an analysed, designed, implemented and tested system following OOAD';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const ok = (r, label) => {
  if (r.status >= 300) throw new Error(`${label} -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
};
const login = async ({ email, password }) => ok(await call('POST', '/auth/login', { body: { email, password } }), `login ${email}`).accessToken;

async function account(admin, name, email, role) {
  const r = await call('POST', '/auth/register', { body: { name, email, password: DEMO_PASSWORD } });
  if (r.status !== 201 && r.status !== 409) throw new Error(`register ${email}: ${r.status} ${JSON.stringify(r.data)}`);
  if (role !== 'board_member') {
    const users = ok(await call('GET', '/users', { token: admin }), 'users');
    const user = users.find((u) => u.email === email);
    if (user.role !== role) ok(await call('PATCH', `/users/${user.id}/role`, { token: admin, body: { role } }), `role ${email}`);
  }
  return { email, password: DEMO_PASSWORD, role };
}

/** Waits until the top-level run completes, fails or stops at a human approval */
async function settle(token, projectId) {
  for (let i = 0; i < 600; i++) {
    const project = ok(await call('GET', `/projects/${projectId}`, { token }), 'project');
    const run = (project.workflowRuns || []).find((r) => !r.parentRunId) ?? project.workflowRuns?.[0];
    if (run && ['completed', 'failed', 'cancelled'].includes(run.status)) return run.status;
    const approvals = ok(await call('GET', `/approvals?projectId=${projectId}`, { token }), 'approvals');
    if (approvals.some((a) => a.status === 'pending')) return 'awaiting approval';
    await sleep(1000);
  }
  return 'timeout';
}

// The scripted LLM remembers which projects it already answered (Legacy/Unsafe get messy code
// only the first time): forget them, so a fresh database shows the refinement again
const LLM = process.env.DEMO_LLM_URL || 'http://127.0.0.1:20128';
await fetch(`${LLM}/control`, { method: 'POST', body: JSON.stringify({ reset: true }) }).catch(() => {
  console.log(`(scripted LLM not reachable at ${LLM}; restart it before seeding a fresh database)`);
});

const admin = await login(ADMIN);
const accounts = [
  await account(admin, 'Minh (board member)', 'board@aicorp.demo', 'board_member'),
  await account(admin, 'Lan (viewer)', 'viewer@aicorp.demo', 'viewer'),
];
const board = await login(accounts[0]);

// Each project shows a different part of the platform; the scripted LLM recognises the
// "Legacy" and "Unsafe" prefixes (refinement by DEV, rejection by QA)
const projects = [
  {
    name: 'Online Bookstore',
    description: 'Customers browse books, place orders, cancel an order before it ships and pay online. Staff manage the catalogue and stock.',
    templateId: 'ooad-software-project',
    templateParams: { humanApproval: false, announcement: true },
    expect: 'completed',
    shows: 'Full OOAD workflow: use cases, domain model, UML, layered code, acceptance tests, traceability, marketing',
  },
  {
    name: 'Legacy Billing',
    description: 'Accountants issue invoices for orders, cancel invoices with a reason and record payments. Overdue invoices are listed every morning.',
    templateId: 'ooad-software-project',
    templateParams: { humanApproval: false },
    expect: 'completed',
    shows: 'Code quality: the first code breaks the layering and uses eval, DEV refines it once before QA',
  },
  {
    name: 'Unsafe Portal',
    description: 'Partners submit purchase orders through a portal, follow their status and cancel them before approval.',
    templateId: 'ooad-software-project',
    templateParams: { humanApproval: false },
    expect: 'completed',
    shows: 'QA rejects the code (eval in the domain), the workflow loops back to DEV, the second attempt passes',
  },
  {
    name: 'Library Loans (design)',
    description: 'Members borrow and return books, reserve a book that is on loan and pay late fees. Librarians manage members.',
    templateId: 'ooad-design-only',
    templateParams: { humanApproval: false },
    expect: 'completed',
    shows: 'Analysis and design only: use cases, domain model and diagrams passed through the OOAD gate',
  },
  {
    name: 'Clinic Booking',
    description: 'Patients book, move and cancel appointments with a doctor; doctors publish their weekly schedule; reception confirms arrivals.',
    templateId: 'ooad-software-project',
    templateParams: { humanApproval: true },
    expect: 'awaiting approval',
    shows: 'Waits for the board member\'s approval: approve it live, then the CEO closes the project',
  },
];

const existing = ok(await call('GET', '/projects', { token: board }), 'projects');
const rows = [];
let failed = 0;
for (const spec of projects) {
  const found = existing.find((p) => p.name === spec.name);
  const project = found ?? ok(await call('POST', '/projects', {
    token: board,
    body: { name: spec.name, description: spec.description, goal: GOAL, templateId: spec.templateId, templateParams: spec.templateParams },
  }), `create ${spec.name}`);
  const state = await settle(board, project.id);
  const asExpected = state === spec.expect || (found && state === 'completed');
  if (!asExpected) failed++;
  rows.push({ project: spec.name, id: project.id, state, expected: spec.expect, shows: spec.shows });
  console.log(`${asExpected ? 'OK  ' : 'FAIL'}  ${spec.name.padEnd(24)} ${state.padEnd(18)} ${found ? '(already there)' : ''}`);
}

console.log('\nAccounts (password for both: ' + DEMO_PASSWORD + ')');
for (const a of accounts) console.log(`  ${a.role.padEnd(13)} ${a.email}`);
console.log('\nProjects');
for (const r of rows) console.log(`  ${r.project.padEnd(24)} ${r.state.padEnd(18)} ${r.shows}`);
if (process.env.DEMO_SUMMARY_JSON) {
  const fs = await import('node:fs');
  fs.writeFileSync(process.env.DEMO_SUMMARY_JSON, JSON.stringify({ accounts, projects: rows }, null, 2));
}
process.exit(failed ? 1 : 0);
