import { z } from 'zod';

// Use Case Schema
export const UseCaseItemSchema = z.object({
  id: z.string().regex(/^UC-\d{3}$/, 'Use case ID must follow format UC-XXX'),
  name: z.string().min(3, 'Use case name must be at least 3 characters'),
  actor: z.string().min(1, 'Actor is required'),
  priority: z.enum(['High', 'Medium', 'Low']),
  preConditions: z.array(z.string()).min(1, 'At least one precondition required'),
  postConditions: z.array(z.string()).min(1, 'At least one postcondition required'),
  mainFlow: z.array(z.string()).min(5, 'Main flow must have at least 5 steps'),
  alternativeFlows: z.array(z.string()).min(1, 'At least one alternative flow required'),
  exceptionFlows: z.array(z.string()).min(1, 'At least one exception flow required'),
});

export const UseCaseDataSchema = z.object({
  actors: z.array(z.string()).min(1, 'At least one actor required'),
  useCases: z.array(UseCaseItemSchema).min(5, 'At least 5 use cases required'),
});

// Domain Model Schema
export const EntitySchema = z.object({
  name: z.string().min(1),
  idType: z.string().default('UUID'),
  attributes: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    })
  ),
  methods: z.array(
    z.object({
      name: z.string(),
      params: z.string(),
      returnType: z.string(),
    })
  ).default([]),
});

export const ValueObjectSchema = z.object({
  name: z.string(),
  attributes: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    })
  ),
});

export const AggregateSchema = z.object({
  root: z.string(),
  children: z.array(z.string()),
});

export const RelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(), // '--', '*--', '<|--', etc.
  label: z.string().optional(),
});

export const DomainModelSchema = z.object({
  entities: z.array(EntitySchema).min(3, 'At least 3 entities required'),
  valueObjects: z.array(ValueObjectSchema).default([]),
  aggregates: z.array(AggregateSchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
});

// Design Patterns Schema
export const PatternItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Creational', 'Structural', 'Behavioral', 'Enterprise']),
  justification: z.string().min(50, 'Justification must be at least 50 characters'),
  location: z.string().min(1, 'Location is required'),
  benefit: z.string().min(20, 'Benefit must be at least 20 characters'),
});

export const PatternsSchema = z.object({
  patterns: z.array(PatternItemSchema).min(3, 'At least 3 patterns required').max(5, 'Maximum 5 patterns allowed'),
});

// Architecture Schema
export const ArchitectureLayerSchema = z.object({
  name: z.string(),
  responsibilities: z.string(),
  components: z.array(z.string()),
  dependencies: z.string(),
});

export const ArchitectureSchema = z.object({
  style: z.string().min(1),
  layers: z.array(ArchitectureLayerSchema).min(3),
});

// Sequence Diagram Schema (one per high-priority use case)
export const SequenceParticipantSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['actor', 'boundary', 'control', 'entity', 'database', 'participant']).default('participant'),
});

export const SequenceMessageSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['sync', 'async', 'reply']).default('sync'),
});

export const SequenceDiagramSchema = z.object({
  participants: z.array(SequenceParticipantSchema).min(2, 'At least 2 participants required'),
  messages: z.array(SequenceMessageSchema).min(3, 'At least 3 messages required'),
});

// TypeScript types
export type UseCaseItem = z.infer<typeof UseCaseItemSchema>;
export type UseCaseData = z.infer<typeof UseCaseDataSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type ValueObject = z.infer<typeof ValueObjectSchema>;
export type Aggregate = z.infer<typeof AggregateSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type DomainModel = z.infer<typeof DomainModelSchema>;
export type PatternItem = z.infer<typeof PatternItemSchema>;
export type Patterns = z.infer<typeof PatternsSchema>;
export type ArchitectureLayer = z.infer<typeof ArchitectureLayerSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type SequenceParticipant = z.infer<typeof SequenceParticipantSchema>;
export type SequenceMessage = z.infer<typeof SequenceMessageSchema>;
export type SequenceDiagram = z.infer<typeof SequenceDiagramSchema>;
