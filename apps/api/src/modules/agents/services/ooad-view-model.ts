import {
  Architecture,
  DomainModel,
  PatternItem,
  SequenceDiagram,
  UseCaseItem,
} from '../schemas/ooad.schema';

/**
 * Pure mapping functions that turn validated OOAD metadata (use cases, domain model,
 * architecture) into the view models consumed by the Handlebars templates in
 * templates/ooad. Kept free of Nest/IO dependencies so they can be unit tested.
 */

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function toPascalCase(value: string): string {
  const result = words(value)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  // Identifiers can't start with a digit
  return /^[0-9]/.test(result) ? `_${result}` : result;
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(value: string): string {
  return words(value).map(w => w.toLowerCase()).join('-');
}

/** Alias safe to use as a PlantUML element id */
export function toPumlId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '') || 'Unnamed';
}

const TS_TYPE_MAP: Record<string, string> = {
  string: 'string',
  text: 'string',
  char: 'string',
  uuid: 'string',
  guid: 'string',
  id: 'string',
  email: 'string',
  url: 'string',
  int: 'number',
  integer: 'number',
  long: 'number',
  short: 'number',
  float: 'number',
  double: 'number',
  decimal: 'number',
  number: 'number',
  bigdecimal: 'number',
  bool: 'boolean',
  boolean: 'boolean',
  date: 'Date',
  datetime: 'Date',
  timestamp: 'Date',
  localdate: 'Date',
  localdatetime: 'Date',
  instant: 'Date',
  any: 'unknown',
  object: 'unknown',
  json: 'Record<string, unknown>',
};

/** Map a loosely typed LLM attribute type ("int", "List<Order>", "Money") to TypeScript */
export function toTsType(rawType: string): string {
  const type = (rawType || '').trim();
  if (!type) return 'unknown';

  const generic = type.match(/^(?:List|Array|Set|Collection|IEnumerable)\s*<\s*(.+)\s*>$/i);
  if (generic) return `${toTsType(generic[1])}[]`;
  if (type.endsWith('[]')) return `${toTsType(type.slice(0, -2))}[]`;

  const mapped = TS_TYPE_MAP[type.toLowerCase()];
  if (mapped) return mapped;

  // Anything else is treated as a reference to another domain type
  return toPascalCase(type) || 'unknown';
}

/** Normalise an LLM parameter list ("orderId: UUID, qty: int") to TypeScript */
export function toTsParams(rawParams: string, types?: DomainTypes): string {
  return (rawParams || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const [name, ...type] = p.split(':');
      const rawType = type.join(':');
      const tsType = !type.length ? 'unknown' : types ? resolveTsType(rawType, types) : toTsType(rawType);
      return `${toCamelCase(name)}: ${tsType}`;
    })
    .join(', ');
}

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export interface UseCaseRef {
  id: string;
  name: string;
  methodName: string;
  handlerName: string;
}

export interface AttributeView {
  name: string;
  type: string;
  tsType: string;
}

export interface MethodView {
  name: string;
  params: string;
  returnType: string;
}

export interface ImportView {
  name: string;
  from: string;
}

export interface EntityView {
  name: string;
  className: string;
  varName: string;
  idType: string;
  idTsType: string;
  attributes: AttributeView[];
  methods: MethodView[];
  imports: ImportView[];
  useCases: UseCaseRef[];
  repositoryInterface: string;
  repositoryImpl: string;
  serviceName: string;
  controllerName: string;
}

export interface ValueObjectView {
  name: string;
  className: string;
  attributes: AttributeView[];
  imports: ImportView[];
}

export interface SkeletonFile {
  /** Path relative to the generated project's root */
  path: string;
  template: string;
  data: unknown;
}

function useCaseRef(uc: Pick<UseCaseItem, 'id' | 'name'>): UseCaseRef {
  return {
    id: uc.id,
    name: uc.name,
    methodName: toCamelCase(uc.name),
    handlerName: `handle${toPascalCase(uc.name)}`,
  };
}

function mentions(text: string, entityName: string): boolean {
  const haystack = text.toLowerCase();
  const needle = words(entityName).join(' ').toLowerCase();
  const compact = entityName.toLowerCase();
  return haystack.includes(needle) || haystack.includes(compact);
}

/** Use cases whose name or main flow mention the entity */
export function relatedUseCases(entityName: string, useCases: UseCaseItem[]): UseCaseItem[] {
  return useCases.filter(uc =>
    mentions(uc.name, entityName) || uc.mainFlow.some(step => mentions(step, entityName))
  );
}

/**
 * Assign each use case to exactly one owning entity (the first entity it mentions,
 * otherwise the first entity), so every use case gets a service method.
 */
export function assignUseCasesToEntities(
  domainModel: DomainModel,
  useCases: UseCaseItem[]
): Map<string, UseCaseItem[]> {
  const owners = new Map<string, UseCaseItem[]>(domainModel.entities.map(e => [e.name, []]));
  if (domainModel.entities.length === 0) return owners;

  for (const uc of useCases) {
    const byName = domainModel.entities.find(e => mentions(uc.name, e.name));
    const byFlow = domainModel.entities.find(e => uc.mainFlow.some(step => mentions(step, e.name)));
    const owner = (byName || byFlow || domainModel.entities[0]).name;
    owners.get(owner)!.push(uc);
  }
  return owners;
}

const BUILTIN_TS_TYPES = new Set(['string', 'number', 'boolean', 'Date', 'unknown', 'void', 'Record<string, unknown>']);

/** Domain type names the generated code can import, by layer folder */
interface DomainTypes {
  entities: Set<string>;
  valueObjects: Set<string>;
}

function domainTypes(domainModel: DomainModel): DomainTypes {
  return {
    entities: new Set(domainModel.entities.map(e => toPascalCase(e.name))),
    valueObjects: new Set(domainModel.valueObjects.map(vo => toPascalCase(vo.name))),
  };
}

/** Types that are neither built in nor part of the domain model become `unknown` so the skeleton compiles */
function resolveTsType(rawType: string, types: DomainTypes): string {
  const tsType = toTsType(rawType);
  const base = tsType.replace(/(\[\])+$/, '');
  const known = BUILTIN_TS_TYPES.has(base) || types.entities.has(base) || types.valueObjects.has(base);
  return known ? tsType : tsType.replace(base, 'unknown');
}

function attributeViews(attrs: { name: string; type: string }[], types: DomainTypes): AttributeView[] {
  return attrs
    .filter(a => a.name && a.name.toLowerCase() !== 'id')
    .map(a => ({ name: toCamelCase(a.name), type: a.type, tsType: resolveTsType(a.type, types) }));
}

/** Imports for referenced domain types; paths are relative to the importing file's layer folder */
function importsFor(
  attrs: AttributeView[],
  types: DomainTypes,
  self: string,
  folder: 'entities' | 'value-objects'
): ImportView[] {
  const used = new Map<string, string>();
  for (const attr of attrs) {
    const base = attr.tsType.replace(/(\[\])+$/, '');
    if (base === self || used.has(base)) continue;
    if (types.entities.has(base)) {
      used.set(base, folder === 'entities' ? `./${base}` : `../entities/${base}`);
    } else if (types.valueObjects.has(base)) {
      used.set(base, folder === 'value-objects' ? `./${base}` : `../value-objects/${base}`);
    }
  }
  return [...used.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, from]) => ({ name, from }));
}

export function buildEntityViews(domainModel: DomainModel, useCases: UseCaseItem[]): EntityView[] {
  const owners = assignUseCasesToEntities(domainModel, useCases);
  const types = domainTypes(domainModel);

  return domainModel.entities.map(entity => {
    const className = toPascalCase(entity.name);
    const attributes = attributeViews(entity.attributes, types);
    return {
      name: entity.name,
      className,
      varName: toCamelCase(entity.name),
      idType: entity.idType,
      idTsType: toTsType(entity.idType),
      attributes,
      methods: entity.methods.map(m => ({
        name: toCamelCase(m.name),
        params: toTsParams(m.params, types),
        returnType: !m.returnType || /^void$/i.test(m.returnType.trim()) ? 'void' : resolveTsType(m.returnType, types),
      })),
      imports: importsFor(attributes, types, className, 'entities'),
      useCases: (owners.get(entity.name) || []).map(useCaseRef),
      repositoryInterface: `I${className}Repository`,
      repositoryImpl: `InMemory${className}Repository`,
      serviceName: `${className}Service`,
      controllerName: `${className}Controller`,
    };
  });
}

export function buildValueObjectViews(domainModel: DomainModel): ValueObjectView[] {
  const types = domainTypes(domainModel);
  return domainModel.valueObjects.map(vo => {
    const className = toPascalCase(vo.name);
    const attributes = attributeViews(vo.attributes, types);
    return { name: vo.name, className, attributes, imports: importsFor(attributes, types, className, 'value-objects') };
  });
}

/** Data for use-case-template.md and use-case-diagram.puml */
export function buildUseCaseView(data: { actors: string[]; useCases: UseCaseItem[] }, projectName = 'System') {
  return {
    projectName,
    actors: data.actors.map(name => ({ name, id: toPumlId(name) })),
    useCases: data.useCases.map(uc => ({
      ...uc,
      alias: toPumlId(uc.id),
      actorId: toPumlId(uc.actor),
    })),
  };
}

/** Data for class-diagram.puml: one package per layer, wired by the dependency rule */
export function buildClassDiagramView(domainModel: DomainModel, useCases: UseCaseItem[], projectName = 'System') {
  const entities = buildEntityViews(domainModel, useCases);
  const known = new Set([
    ...domainModel.entities.map(e => e.name),
    ...domainModel.valueObjects.map(v => v.name),
  ]);
  return {
    projectName,
    entities,
    valueObjects: buildValueObjectViews(domainModel),
    relationships: domainModel.relationships
      .filter(r => known.has(r.from) && known.has(r.to))
      .map(r => ({ from: toPascalCase(r.from), to: toPascalCase(r.to), type: r.type, label: r.label })),
  };
}

const ARROWS: Record<string, string> = { sync: '->', async: '->>', reply: '-->' };

/** Normalise a sequence diagram (LLM or default) for sequence-diagram.puml */
export function buildSequenceView(useCase: UseCaseItem, diagram: SequenceDiagram) {
  const participants = [...diagram.participants];
  const names = new Set(participants.map(p => p.name));
  // Messages may reference participants the LLM forgot to declare
  for (const msg of diagram.messages) {
    for (const name of [msg.from, msg.to]) {
      if (!names.has(name)) {
        participants.push({ name, kind: 'participant' });
        names.add(name);
      }
    }
  }

  return {
    ucId: useCase.id,
    ucName: useCase.name,
    mainFlow: useCase.mainFlow,
    alternativeFlows: useCase.alternativeFlows,
    exceptionFlows: useCase.exceptionFlows,
    firstParticipant: toPumlId(participants[0].name),
    lastParticipant: toPumlId(participants[participants.length - 1].name),
    participants: participants.map(p => ({ name: p.name, kind: p.kind, id: toPumlId(p.name) })),
    messages: diagram.messages.map(m => ({
      from: toPumlId(m.from),
      to: toPumlId(m.to),
      label: m.label.replace(/\r?\n/g, ' '),
      arrow: ARROWS[m.kind] || '->',
    })),
  };
}

/**
 * Deterministic layered sequence (Actor → Controller → Service → Repository) used when
 * the LLM does not return a valid structured diagram.
 */
export function defaultSequenceDiagram(useCase: UseCaseItem, domainModel: DomainModel): SequenceDiagram {
  const owner = [...assignUseCasesToEntities(domainModel, [useCase]).entries()].find(([, ucs]) => ucs.length > 0);
  const entity = toPascalCase(owner ? owner[0] : 'Domain');
  const method = toCamelCase(useCase.name);
  const actor = useCase.actor;

  return {
    participants: [
      { name: actor, kind: 'actor' },
      { name: `${entity}Controller`, kind: 'boundary' },
      { name: `${entity}Service`, kind: 'control' },
      { name: entity, kind: 'entity' },
      { name: `I${entity}Repository`, kind: 'database' },
    ],
    messages: [
      { from: actor, to: `${entity}Controller`, label: useCase.name, kind: 'sync' },
      { from: `${entity}Controller`, to: `${entity}Service`, label: `${method}(request)`, kind: 'sync' },
      { from: `${entity}Service`, to: `I${entity}Repository`, label: 'findById(id)', kind: 'sync' },
      { from: `I${entity}Repository`, to: `${entity}Service`, label: entity, kind: 'reply' },
      { from: `${entity}Service`, to: entity, label: 'apply business rules', kind: 'sync' },
      { from: `${entity}Service`, to: `I${entity}Repository`, label: `save(${toCamelCase(entity)})`, kind: 'sync' },
      { from: `${entity}Service`, to: `${entity}Controller`, label: 'result', kind: 'reply' },
      { from: `${entity}Controller`, to: actor, label: 'response', kind: 'reply' },
    ],
  };
}

/** Every file of the layered code skeleton, paired with the template that renders it */
export function buildSkeletonFiles(
  domainModel: DomainModel,
  useCases: UseCaseItem[],
  architecture: Architecture,
  patterns: PatternItem[],
  projectName = 'Generated Project'
): SkeletonFile[] {
  const entities = buildEntityViews(domainModel, useCases);
  const valueObjects = buildValueObjectViews(domainModel);
  const files: SkeletonFile[] = [];

  for (const vo of valueObjects) {
    files.push({ path: `src/domain/value-objects/${vo.className}.ts`, template: 'skeleton/value-object.ts.hbs', data: vo });
  }
  for (const entity of entities) {
    files.push(
      { path: `src/domain/entities/${entity.className}.ts`, template: 'skeleton/entity.ts.hbs', data: entity },
      { path: `src/domain/repositories/${entity.repositoryInterface}.ts`, template: 'skeleton/repository.interface.ts.hbs', data: entity },
      { path: `src/application/services/${entity.serviceName}.ts`, template: 'skeleton/service.ts.hbs', data: entity },
      { path: `src/infrastructure/persistence/${entity.repositoryImpl}.ts`, template: 'skeleton/in-memory-repository.ts.hbs', data: entity },
      { path: `src/presentation/controllers/${entity.controllerName}.ts`, template: 'skeleton/controller.ts.hbs', data: entity },
    );
  }
  files.push(
    { path: 'src/composition-root.ts', template: 'skeleton/composition-root.ts.hbs', data: { entities } },
    {
      path: 'ARCHITECTURE.md',
      template: 'skeleton/ARCHITECTURE.md.hbs',
      data: { projectName, architecture, patterns, entities, valueObjects },
    },
  );
  return files;
}
