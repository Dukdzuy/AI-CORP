import * as path from 'path';
import { TemplateService } from '../../../src/modules/agents/services/template.service';
import { OOADArtifactService } from '../../../src/modules/agents/services/ooad-artifact.service';
import {
  defaultSequenceDiagram,
  toCamelCase,
  toPascalCase,
  toTsParams,
  toTsType,
} from '../../../src/modules/agents/services/ooad-view-model';
import { architecture, domainModel, patterns, useCaseData } from './ooad-fixtures';

describe('OOAD view model helpers', () => {
  it('normalises names and types for generated TypeScript', () => {
    expect(toPascalCase('order line item')).toBe('OrderLineItem');
    expect(toCamelCase('Place Order')).toBe('placeOrder');
    expect(toTsType('List<Order>')).toBe('Order[]');
    expect(toTsType('UUID')).toBe('string');
    expect(toTsType('DateTime')).toBe('Date');
    expect(toTsParams('order id: UUID, qty: int, note')).toBe('orderId: string, qty: number, note: unknown');
  });

  it('builds a layered default sequence diagram for the owning entity', () => {
    const diagram = defaultSequenceDiagram(useCaseData.useCases[0], domainModel);
    expect(diagram.participants.map(p => p.name)).toEqual([
      'Customer', 'OrderController', 'OrderService', 'Order', 'IOrderRepository',
    ]);
  });
});

describe('OOADArtifactService', () => {
  process.env.OOAD_TEMPLATES_PATH = path.join(__dirname, '../../../src/modules/agents/templates/ooad');
  const templates = new TemplateService();
  const executeInSandbox = jest.fn().mockResolvedValue({ output: '', exitCode: 0 });
  const service = new OOADArtifactService(templates, { executeInSandbox } as any);
  const designInput = { projectName: 'Shop', useCases: useCaseData.useCases, domainModel, architecture, patterns };

  it('renders use case docs in the format the QA traceability parser reads', async () => {
    const [md, puml] = await service.renderUseCaseArtifacts(useCaseData, 'Shop');
    expect(md.path).toBe('docs/use-cases.md');
    expect(md.content).toContain('## Use Case: Place Order');
    expect(md.content).toContain('| **ID** | UC-001 |');
    expect(puml.content).toContain('actor "Store Admin" as StoreAdmin');
    expect(puml.content).toContain('Customer --> UC001');
  });

  it('renders domain, class and sequence diagrams without HTML escaping', async () => {
    const sequences = [{ useCase: useCaseData.useCases[0], diagram: defaultSequenceDiagram(useCaseData.useCases[0], domainModel) }];
    const files = await service.renderDesignArtifacts({ ...designInput, sequences });
    const byPath = Object.fromEntries(files.map(f => [f.path, f.content]));

    expect(Object.keys(byPath)).toEqual([
      'docs/domain-model.puml',
      'docs/class-diagram.puml',
      'docs/architecture-patterns.md',
      'docs/sequence-UC-001.puml',
    ]);
    for (const content of Object.values(byPath)) {
      expect(content).not.toMatch(/&lt;|&gt;|&quot;|&#x/);
    }
    expect(byPath['docs/domain-model.puml']).toContain('Order "1" *-- "many" Product : contains');
    expect(byPath['docs/class-diagram.puml']).toContain('IOrderRepository <|.. InMemoryOrderRepository');
    expect(byPath['docs/class-diagram.puml']).toContain('+ placeOrder(input): Promise<unknown>');
    expect(byPath['docs/sequence-UC-001.puml']).toContain('OrderService -> IOrderRepository : findById(id)');
    expect(byPath['docs/architecture-patterns.md']).toContain('**Clean Architecture**');
  });

  it('generates a layered skeleton with one service method per use case', async () => {
    const files = await service.renderSkeleton(designInput);
    const paths = files.map(f => f.path);

    expect(paths).toEqual(expect.arrayContaining([
      'src/domain/value-objects/Money.ts',
      'src/domain/entities/Order.ts',
      'src/domain/repositories/IOrderRepository.ts',
      'src/application/services/OrderService.ts',
      'src/infrastructure/persistence/InMemoryOrderRepository.ts',
      'src/presentation/controllers/OrderController.ts',
      'src/composition-root.ts',
      'ARCHITECTURE.md',
    ]));

    const content = (p: string) => files.find(f => f.path === p)!.content;
    expect(content('src/domain/entities/Order.ts')).toContain("import { Money } from '../value-objects/Money';");
    expect(content('src/domain/entities/Order.ts')).toContain("import { Product } from './Product';");
    expect(content('src/domain/entities/Order.ts')).toContain('private _items: Product[],');
    expect(content('src/application/services/OrderService.ts')).toMatch(/\/\/ UC-001: Place Order\n\s+async placeOrder/);
    expect(content('src/application/services/PaymentService.ts')).toContain('// UC-004: Pay Invoice');

    // Domain layer must not depend on outer layers
    for (const file of files.filter(f => f.path.startsWith('src/domain/'))) {
      expect(file.content).not.toMatch(/from '\.\.\/\.\.\/(application|infrastructure|presentation)/);
    }
  });

  it('writes files under the project root', async () => {
    const written = await service.writeFiles('p1', [{ path: 'docs/a.md', content: 'x' }]);
    expect(written).toEqual(['projects/p1/docs/a.md']);
    expect(executeInSandbox.mock.calls[0][1]).toContain('cat > "projects/p1/docs/a.md"');
  });

  it('builds the Dev implementation context from persisted metadata', async () => {
    expect(await service.buildImplementationContext({}, 'Shop')).toBeNull();

    const context = await service.buildImplementationContext(
      { actors: useCaseData.actors, useCases: useCaseData.useCases, domainModel, architecture, patterns },
      'Shop'
    );
    expect(context).toContain('==== OOAD DESIGN (MUST FOLLOW) ====');
    expect(context).toContain('- src/application/services/OrderService.ts');
    expect(context).toContain('=== CLASS DIAGRAM ===');
  });
});
