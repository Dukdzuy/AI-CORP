// Scripted OpenAI-compatible LLM for the Phase 3 end-to-end run: answers by recognising each agent prompt
const http = require('http');
const fs = require('fs');
const path = require('path');
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));
const log = fs.createWriteStream(path.join(require('os').tmpdir(), 'mock-llm.log'), { flags: 'a' });
let planReviews = 0;

const sequence = JSON.stringify({
  participants: [{ name: 'Customer', kind: 'actor' }, { name: 'OrderController', kind: 'boundary' }, { name: 'OrderService', kind: 'control' }, { name: 'Order', kind: 'entity' }],
  messages: [
    { from: 'Customer', to: 'OrderController', label: 'placeOrder(cart)' },
    { from: 'OrderController', to: 'OrderService', label: 'placeOrder(cart)' },
    { from: 'OrderService', to: 'Order', label: 'create(items)' },
    { from: 'OrderService', to: 'OrderController', label: 'orderId', kind: 'reply' },
  ],
});

const code = [
  '<CODE filepath="src/domain/value-objects/Money.ts">',
  'export class Money {',
  '  constructor(readonly amount: number, readonly currency = "USD") {',
  '    if (amount < 0) throw new Error("Money cannot be negative");',
  '  }',
  '  add(other: Money): Money { return new Money(this.amount + other.amount, this.currency); }',
  '}',
  '</CODE>',
  '<CODE filepath="src/domain/entities/Order.ts">',
  'import { Money } from "../value-objects/Money";',
  'export type OrderStatus = "placed" | "paid" | "shipped" | "cancelled";',
  'export class Order {',
  '  status: OrderStatus = "placed";',
  '  constructor(readonly id: string, readonly items: Array<{ productId: string; price: Money }>) {}',
  '  get total(): Money { return this.items.reduce((sum, i) => sum.add(i.price), new Money(0)); }',
  '  // UC-002: an order can be cancelled until it ships',
  '  cancel(): void {',
  '    if (this.status === "shipped") throw new Error("Shipped orders cannot be cancelled");',
  '    this.status = "cancelled";',
  '  }',
  '}',
  '</CODE>',
  '<CODE filepath="src/application/services/OrderService.ts">',
  'import { Order } from "../../domain/entities/Order";',
  'import { Money } from "../../domain/value-objects/Money";',
  'export interface OrderRepository { save(order: Order): void; find(id: string): Order | undefined; }',
  'export class OrderService {',
  '  constructor(private readonly orders: OrderRepository) {}',
  '  // UC-001: Place Order',
  '  placeOrder(id: string, items: Array<{ productId: string; price: number }>): Order {',
  '    const order = new Order(id, items.map(i => ({ productId: i.productId, price: new Money(i.price) })));',
  '    this.orders.save(order);',
  '    return order;',
  '  }',
  '  // UC-002: Cancel Order',
  '  cancelOrder(id: string): Order {',
  '    const order = this.orders.find(id);',
  '    if (!order) throw new Error("Order not found");',
  '    order.cancel();',
  '    this.orders.save(order);',
  '    return order;',
  '  }',
  '}',
  '</CODE>',
].join('\n');

const tests = fx.useCaseData.useCases.slice(0, 4).map(uc => [
  `<CODE filepath="tests/${uc.id}.spec.ts">`,
  `describe('${uc.id}: ${uc.name}', () => {`,
  `  it('main flow', () => { expect(true).toBe(true); });`,
  `});`,
  `</CODE>`,
].join('\n')).join('\n');

function answer(user) {
  if (user.includes('A teammate asks a question')) {
    const m = /CURRENT USE CASE \(JSON\):\n([\s\S]*?)\nAnswer in/.exec(user);
    const uc = m ? JSON.parse(m[1]) : null;
    if (uc) uc.exceptionFlows = [...uc.exceptionFlows, 'Order already shipped: the system refuses the cancellation and offers a return instead'];
    return JSON.stringify({ answer: 'No. Once an order has shipped it cannot be cancelled; the customer starts a return instead.', useCase: uc });
  }
  if (user.includes('Generate structured use cases')) return JSON.stringify(fx.useCaseData);
  if (user.includes('extract a DDD domain model')) return JSON.stringify(fx.domainModel);
  if (user.includes('Select 3-5 design patterns')) return JSON.stringify({ patterns: fx.patterns });
  if (user.includes('Define the layered architecture')) return JSON.stringify(fx.architecture);
  if (user.includes('Design the sequence of interactions')) return sequence;
  if (user.includes('You are the CEO planning')) return '1. MVP: customers can browse, order and pay\n2. Operations: admins manage the catalog\n3. Launch: announcement and feedback';
  if (user.includes('You are the CEO closing')) return 'Close-out: the shop MVP (orders, cancellation, payments) was delivered against the approved OOAD design. Lesson: pair the Architect with DEV earlier.';
  if (user.includes('You are the Project Manager')) return fx.useCaseData.useCases.map((uc, i) => `${i + 1}. ${uc.id}: implement ${uc.name}`).join('\n');
  if (user.includes('propose an implementation plan')) {
    const plan = [
      '1. UC-001 Place Order: Order entity + Money value object (domain), OrderService.placeOrder (application), OrderRepository interface (domain port)',
      '2. UC-002 Cancel Order: Order.cancel() guards the status, OrderService.cancelOrder (application)',
      '3. UC-004 Pay Invoice: Payment entity inside the Order aggregate, PaymentGateway interface (Strategy) in the domain',
    ];
    if (user.includes('ARCHITECT FEEDBACK')) plan.push('4. Repository pattern: InMemoryOrderRepository in infrastructure implements the domain port');
    const question = user.includes('CLARIFICATIONS FROM BA') ? 'QUESTION: none' : 'QUESTION: UC-002: Can an order be cancelled after it has shipped?';
    return `${plan.join('\n')}\n${question}`;
  }
  if (user.includes('navigator in a pair') && user.includes("DEV'S IMPLEMENTATION PLAN")) {
    planReviews++;
    return planReviews === 1
      ? '1. The plan has no infrastructure layer: the Repository pattern from the design needs InMemoryOrderRepository implementing the domain port.\n2. The rest follows the domain model.\nDECISION: REJECT'
      : 'The revised plan covers UC-001, UC-002 and UC-004 and puts the repository in infrastructure.\nDECISION: ACCEPT';
  }
  if (user.includes('navigator in a pair')) return 'Domain classes import nothing from outer layers; UC comments are present.\nDECISION: ACCEPT';
  if (user.includes('You are implementing a software project')) return code;
  if (user.includes('Write Jest acceptance tests')) return tests;
  if (user.includes('You are reviewing code')) return '1. Layers respected\n2. Entities match the domain model\n3. UC comments present\nVERDICT: PASS';
  if (user.includes('Marketing Manager')) return 'Our new online shop lets customers order, cancel before shipping and pay securely.';
  if (user.includes('graded outcomes')) return 'Keep the infrastructure layer in the first plan; the Architect rejects plans without it.';
  return 'OK';
}

module.exports = { answer, code, tests };

// Started directly: serve; required (Phase 6 mock): only reuse the answers
if (require.main === module) http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"status":"ok"}'); }
    const json = body ? JSON.parse(body) : {};
    const user = (json.messages || []).filter(m => m.role === 'user').map(m => m.content).join('\n');
    const content = answer(user);
    log.write(`--- ${new Date().toISOString()} ${user.split('\n')[0].slice(0, 100)}\n`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'mock-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: json.model || 'mock',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: Math.ceil(user.length / 4), completion_tokens: Math.ceil(content.length / 4), total_tokens: Math.ceil((user.length + content.length) / 4) },
    }));
  });
}).listen(20128, '127.0.0.1', () => console.log('mock LLM on 20128'));
