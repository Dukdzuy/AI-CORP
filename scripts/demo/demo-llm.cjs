// Scripted OpenAI-compatible LLM for the thesis demo (Phase 7, Task 31).
// The same answers as the Phase 6 end-to-end run (docs/phase6-e2e/mock-llm.cjs): a complete
// OOAD project for any description, messy first code for "Legacy …" projects (DEV refines
// it), a QA rejection for "Unsafe …" projects, and POST /control {"failMarketing": true}.
// Each answer is held back DEMO_LLM_DELAY_MS (default 400 ms) so the Virtual Office shows
// every agent thinking. Usage: node scripts/demo/demo-llm.cjs
const { createServer } = require('../../docs/phase6-e2e/mock-llm.cjs');

const host = process.env.DEMO_LLM_HOST || '127.0.0.1';
const port = Number(process.env.DEMO_LLM_PORT || 20128);
const delay = Number(process.env.DEMO_LLM_DELAY_MS ?? 400);

createServer({ delayMs: () => delay }).listen(port, host, () =>
  console.log(`demo LLM on http://${host}:${port}/v1 (delay ${delay} ms)`),
);
