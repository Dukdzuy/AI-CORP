// Scripted OpenAI-compatible LLM for the Phase 6 end-to-end run.
// Reuses the Phase 3 answers and adds what Phase 6 needs to observe:
// - latency that grows with the prompt and a priced model name, so durations and costs vary
//   between projects (training data for the estimation model, Task 25)
// - "Legacy …" projects: DEV first writes code that breaks the layering and uses eval; the
//   refinement round fixes it (Task 26)
// - "Unsafe …" projects: the refinement does not help, QA rejects code with eval, the second
//   DEV attempt is clean (QA prediction accuracy, Task 24/26)
// - POST /control {"failMarketing": true}: Marketing calls fail, so runs fail (anomaly, Task 24);
//   {"reset": true} forgets earlier projects, so a rerun starts from the messy first attempt
const http = require('http');
const { answer, code } = require('../phase3-e2e/mock-llm.cjs');

const MESSY = [
  '<CODE filepath="src/domain/entities/Order.ts">',
  'import { OrderTable } from "../../infrastructure/persistence/OrderTable";',
  'const apiKey = "sk-live-0123456789abcdef";',
  'export class Order {',
  '  status = "placed";',
  '  constructor(readonly id: string, readonly total: number) {}',
  '  // UC-002',
  '  cancel(reason: string, user: any, force: boolean): void {',
  '    if (this.status === "shipped" && !force) throw new Error("shipped");',
  '    if (user && user.role === "admin" || force) { this.status = "cancelled"; }',
  '    else if (user && user.role === "support" && reason) { this.status = "cancelled"; }',
  '    else if (reason === "fraud" || reason === "duplicate" || reason === "customer") { this.status = "cancelled"; }',
  '    else if (this.total > 1000 && user ? user.vip : false) { this.status = "review"; }',
  '    else if (this.total < 0 || this.total > 1e6) { throw new Error("total"); }',
  '    eval("OrderTable.audit(this.id)");',
  '  }',
  '}',
  '</CODE>',
].join('\n');

const UNSAFE_MARK = '(portal draft)';
const implementCalls = new Map();
let failMarketing = false;

function phase6Answer(user) {
  const project = (/PROJECT: (.*)/.exec(user) || [])[1] || '';
  if (user.includes('Static analysis of the code you just wrote')) {
    // The refinement prompt has no PROJECT line: the Unsafe draft is recognised by its marker comment
    if (user.includes(UNSAFE_MARK) || !user.includes('src/domain/entities/Order.ts')) return MESSY.replace('// UC-002', `// UC-002 ${UNSAFE_MARK}`);
    return code.split('<CODE filepath="src/domain/value-objects/Money.ts">')[0] + code.slice(code.indexOf('<CODE filepath="src/domain/entities/Order.ts">'), code.indexOf('<CODE filepath="src/application'));
  }
  if (user.includes('You are implementing a software project')) {
    const n = (implementCalls.get(project) || 0) + 1;
    implementCalls.set(project, n);
    const draft = project.startsWith('Unsafe') ? MESSY.replace('// UC-002', `// UC-002 ${UNSAFE_MARK}`) : MESSY;
    if ((project.startsWith('Legacy') || project.startsWith('Unsafe')) && n === 1) return draft + '\n' + code.slice(code.indexOf('<CODE filepath="src/application'));
    return code;
  }
  if (user.includes('You are reviewing code')) {
    return user.includes('eval(') ? '1. Domain imports infrastructure\n2. eval() in the domain\nVERDICT: FAIL' : '1. Layers respected\n2. UC comments present\nVERDICT: PASS';
  }
  return answer(user);
}

// Started directly: serve the Phase 6 run; required (scripts/demo/demo-llm.cjs): reuse the server
function createServer({ delayMs = () => 0 } = {}) { return http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"status":"ok"}'); }
    const json = body ? JSON.parse(body) : {};
    if (req.url === '/control') {
      failMarketing = !!json.failMarketing;
      if (json.reset) implementCalls.clear();
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ failMarketing }));
    }
    const user = (json.messages || []).filter(m => m.role === 'user').map(m => m.content).join('\n');
    if (failMarketing && user.includes('Marketing Manager')) {
      res.writeHead(503, { 'content-type': 'application/json' });
      return res.end('{"error":{"message":"marketing model unavailable"}}');
    }
    const content = phase6Answer(user);
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'mock-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'claude-sonnet-4',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: Math.ceil(user.length / 4), completion_tokens: Math.ceil(content.length / 4), total_tokens: Math.ceil((user.length + content.length) / 4) },
      }));
    }, 20 + Math.round(user.length / 25) + delayMs(user));
  });
}); }

module.exports = { createServer, phase6Answer };

if (require.main === module) createServer().listen(20128, '127.0.0.1', () => console.log('phase 6 mock LLM on 20128'));
