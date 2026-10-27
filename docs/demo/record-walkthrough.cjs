// Records the backup demo video (Phase 7, Task 31): one pass through the demo screens with
// Playwright, no narration. Run it on a freshly seeded demo stack (scripts/demo/seed-demo.mjs):
// it approves "Clinic Booking" through the UI, so a second run needs a new seed.
//   node docs/demo/record-walkthrough.cjs [webUrl] [outDir]
// Env: DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD (audit log screen), DEMO_USER_PASSWORD.
// Writes <outDir>/walkthrough.webm and one PNG per scene; exit 1 if a scene fails.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const WEB = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'video'));
const PASSWORD = process.env.DEMO_USER_PASSWORD || 'demo-2026';
const ADMIN = { email: process.env.DEMO_ADMIN_EMAIL || 'admin@aicorp.com', password: process.env.DEMO_ADMIN_PASSWORD || 'admin123' };
const PAUSE = Number(process.env.SCENE_PAUSE_MS || 2500);

async function projectIds() {
  const login = await fetch(`${WEB}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'board@aicorp.demo', password: PASSWORD }),
  }).then((r) => r.json());
  const projects = await fetch(`${WEB}/api/projects`, { headers: { Authorization: `Bearer ${login.accessToken}` } }).then((r) => r.json());
  return Object.fromEntries(projects.map((p) => [p.name, p.id]));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ids = await projectIds();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let scene = 0;
  const shot = async (name) => {
    await page.waitForTimeout(PAUSE);
    await page.screenshot({ path: path.join(OUT, `${String(++scene).padStart(2, '0')}-${name}.png`) });
    console.log(`scene ${scene}: ${name}`);
  };
  const signIn = async (email, password) => {
    await page.goto(`${WEB}/auth`);
    await page.getByPlaceholder('Email').first().fill(email);
    await page.getByPlaceholder('Password').first().fill(password);
    await page.keyboard.press('Enter');
    await page.waitForURL(`${WEB}/`);
  };
  const openTab = async (projectName, tab) => {
    await page.goto(`${WEB}/projects/${ids[projectName]}`);
    await page.getByRole('tab', { name: tab }).click();
  };

  try {
    await signIn('board@aicorp.demo', PASSWORD);
    await shot('dashboard');
    await page.goto(`${WEB}/virtual-office`);
    await shot('virtual-office');
    await openTab('Online Bookstore', 'Artifacts');
    await shot('bookstore-artifacts');
    await page.mouse.wheel(0, 700);
    await shot('bookstore-files');
    await openTab('Legacy Billing', 'Reports');
    await page.waitForTimeout(1500);
    await page.getByText('Code quality (static analysis)').first().scrollIntoViewIfNeeded();
    await shot('legacy-code-quality');
    await openTab('Unsafe Portal', /Workflow Runs/);
    await shot('unsafe-workflow-runs');

    // Approve Clinic Booking in the UI: goes through POST /api/approvals/:id/approve
    await page.goto(`${WEB}/projects/${ids['Clinic Booking']}`);
    await shot('clinic-awaiting-approval');
    await page.getByRole('button', { name: 'Approve' }).first().click();
    let completed = false;
    for (let i = 0; i < 40 && !completed; i++) {
      await page.waitForTimeout(500);
      await page.reload();
      completed = (await page.locator('text=completed').count()) > 0;
    }
    await shot('clinic-completed');
    if (!completed) throw new Error('Clinic Booking did not complete after the approval');

    await page.goto(`${WEB}/analytics`);
    await shot('agent-analytics');

    await page.evaluate(() => localStorage.clear());
    await signIn('viewer@aicorp.demo', PASSWORD);
    await shot('viewer-dashboard');
    const viewerCanCreate = (await page.getByRole('button', { name: /New Project/ }).count()) > 0;
    if (viewerCanCreate) throw new Error('The viewer sees the New Project button');

    await page.evaluate(() => localStorage.clear());
    await signIn(ADMIN.email, ADMIN.password);
    await page.goto(`${WEB}/audit`);
    await shot('audit-log');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    const video = page.video();
    await context.close();
    if (video) fs.renameSync(await video.path(), path.join(OUT, 'walkthrough.webm'));
    await browser.close();
    if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);
  }
})();
