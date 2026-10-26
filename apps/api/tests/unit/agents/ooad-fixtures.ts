import {
  ArchitectureSchema,
  DomainModelSchema,
  PatternsSchema,
  UseCaseDataSchema,
} from '../../../src/modules/agents/schemas/ooad.schema';

/** Shared OOAD metadata fixture: a small shop with orders, products and payments */
const step = (n: number) => Array.from({ length: n }, (_, i) => `Step ${i + 1}`);
const uc = (id: string, name: string, priority: 'High' | 'Medium' | 'Low', flow: string[]) => ({
  id,
  name,
  actor: 'Customer',
  priority,
  preConditions: ['Customer is logged in'],
  postConditions: ['Data is saved'],
  mainFlow: flow,
  alternativeFlows: ['Customer cancels'],
  exceptionFlows: ['Payment gateway unavailable'],
});

export const useCaseData = UseCaseDataSchema.parse({
  actors: ['Customer', 'Store Admin'],
  useCases: [
    uc('UC-001', 'Place Order', 'High', ['Customer opens the cart', ...step(4)]),
    uc('UC-002', 'Cancel Order', 'High', step(5)),
    uc('UC-003', 'Add Product', 'Medium', ['Admin creates a product', ...step(4)]),
    uc('UC-004', 'Pay Invoice', 'High', ['Customer pays the payment', ...step(4)]),
    uc('UC-005', 'Browse Catalog', 'Low', step(5)),
  ],
});

export const domainModel = DomainModelSchema.parse({
  entities: [
    {
      name: 'Order',
      attributes: [
        { name: 'status', type: 'String' },
        { name: 'total', type: 'Money' },
        { name: 'items', type: 'List<Product>' },
        { name: 'created at', type: 'DateTime' },
      ],
      methods: [{ name: 'cancel', params: 'reason: String', returnType: 'void' }],
    },
    { name: 'Product', idType: 'UUID', attributes: [{ name: 'price', type: 'decimal' }] },
    { name: 'Payment', attributes: [{ name: 'amount', type: 'Money' }] },
  ],
  valueObjects: [{ name: 'Money', attributes: [{ name: 'amount', type: 'decimal' }, { name: 'currency', type: 'string' }] }],
  aggregates: [{ root: 'Order', children: ['Payment'] }],
  relationships: [
    { from: 'Order', to: 'Product', type: '"1" *-- "many"', label: 'contains' },
    { from: 'Payment', to: 'Order', type: '-->', label: 'pays' },
  ],
});

export const architecture = ArchitectureSchema.parse({
  style: 'Clean Architecture',
  layers: [
    { name: 'Domain', responsibilities: 'Entities', components: ['Order'], dependencies: 'None' },
    { name: 'Application', responsibilities: 'Use cases', components: ['OrderService'], dependencies: 'Domain' },
    { name: 'Infrastructure', responsibilities: 'Persistence', components: ['InMemoryOrderRepository'], dependencies: 'Domain' },
  ],
});

export const patterns = PatternsSchema.parse({
  patterns: ['Repository', 'Strategy', 'Factory'].map(name => ({
    name,
    type: 'Enterprise',
    justification: `${name} keeps responsibilities separated so the domain stays independent of infrastructure.`,
    location: 'src/domain',
    benefit: 'Testability and loose coupling',
  })),
}).patterns;
