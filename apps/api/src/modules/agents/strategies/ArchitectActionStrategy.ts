import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { OOADArtifactService } from '../services/ooad-artifact.service';
import { defaultSequenceDiagram } from '../services/ooad-view-model';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DomainModelSchema,
  PatternsSchema,
  ArchitectureSchema,
  SequenceDiagramSchema,
  DomainModel,
  Patterns,
  Architecture,
  SequenceDiagram,
  UseCaseData,
  UseCaseItem
} from '../schemas/ooad.schema';
import { OOADSchemaValidationError } from '../errors/OOADSchemaValidationError';

@Injectable()
export class ArchitectActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(ArchitectActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly ooadArtifacts: OOADArtifactService,
    private readonly prisma: PrismaService
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant architecture patterns:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectContext?.description || '';
    const projectId = context.projectId || 'unknown';

    // Load use cases from DB
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ooadMetadata: true }
    });

    const ooadMetadata = (project?.ooadMetadata as any) || {};
    const useCases = (ooadMetadata.useCases || []) as UseCaseData['useCases'];

    if (!useCases || useCases.length === 0) {
      const errorMsg = 'BA Agent has not completed use case analysis. Cannot proceed with architecture design. ' +
                       'This is a workflow dependency - ensure BA agent runs before Architect.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const systemPrompt = `You are a Software Architect specializing in OOAD and DDD. Generate structured architecture artifacts in JSON format.`;

    // Fetch model config once
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    const actualModelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.ARCHITECT, modelConfig);
    const provider = this.llmFactory.getProvider(actualModelConfig);

    // Call 1: Domain Model
    const domainModel = await this.generateDomainModel(provider, actualModelConfig.model, goal, description, useCases, memoryContext);

    // Call 2: Design Patterns
    const patterns = await this.generatePatterns(provider, actualModelConfig.model, goal, description, useCases, domainModel, memoryContext);

    // Call 3: Architecture Layers
    const architecture = await this.generateArchitecture(provider, actualModelConfig.model, goal, description, useCases, domainModel, patterns, memoryContext);

    // Call 4-6: Sequence Diagrams for top 3 high-priority use cases
    const highPriorityUCs = useCases.filter(uc => uc.priority === 'High').slice(0, 3);
    const sequences: { useCase: UseCaseItem; diagram: SequenceDiagram }[] = [];

    for (const uc of highPriorityUCs) {
      const diagram = await this.generateSequenceDiagram(provider, actualModelConfig.model, uc, domainModel);
      sequences.push({ useCase: uc, diagram });
    }

    // Render design docs and the layered code skeleton from the OOAD templates
    const projectName = context.projectContext?.name;
    const designInput = { projectName, useCases, domainModel, architecture, patterns: patterns.patterns };
    const designFiles = await this.ooadArtifacts.renderDesignArtifacts({ ...designInput, sequences });
    const skeletonFiles = await this.ooadArtifacts.renderSkeleton(designInput);
    const architectureMd = designFiles.find(f => f.path === 'docs/architecture-patterns.md')?.content || '';

    let filesWritten: string[];
    try {
      filesWritten = await this.ooadArtifacts.writeFiles(projectId, [...designFiles, ...skeletonFiles]);
      this.logger.log(`Architect wrote OOAD artifacts and code skeleton for project ${projectId}`);
    } catch (err: any) {
      this.logger.error(`Failed to write OOAD artifacts: ${err.message}`);
      throw new Error(`Architect failed to write artifacts: ${err.message}`);
    }

    // Persist to database (serialize to ensure Prisma Json compatibility)
    const metadataToSave = JSON.parse(JSON.stringify({
      ...ooadMetadata,
      domainModel,
      patterns: patterns.patterns,
      architecture,
      sequenceDiagrams: sequences.map(seq => ({ ucId: seq.useCase.id, ...seq.diagram })),
      skeletonFiles: skeletonFiles.map(f => f.path)
    }));
    
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ooadMetadata: metadataToSave
      }
    });
    this.logger.log(`Saved architecture OOAD metadata to project ${projectId}`);

    // Save memory
    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.ARCHITECT);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.ARCHITECT,
        'architecture_patterns',
        `Designed architecture: ${domainModel.entities.length} entities, ${patterns.patterns.length} patterns`,
        { importance: 9, projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.ARCHITECT,
        agentRole: AgentRole.ARCHITECT,
        taskId: context.taskId || 'none',
        actionType: 'designArchitecture',
        toolName: 'llm+template',
        parameters: { goal, entityCount: domainModel.entities.length, patternCount: patterns.patterns.length }
      }
    });

    return {
      success: true,
      output: {
        action: 'designArchitecture',
        output: architectureMd,
        domainModel,
        patterns: patterns.patterns,
        architecture,
        skeletonFiles: skeletonFiles.map(f => f.path),
        filesWritten
      },
      errors: []
    };
  }

  private async generateDomainModel(provider: any, model: string, goal: string, description: string, useCases: any[], memoryContext: string): Promise<DomainModel> {
    const prompt = `Analyze the use cases and extract a DDD domain model.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}
${memoryContext}

USE CASES:
${JSON.stringify(useCases, null, 2)}

Generate a JSON object with this structure:
{
  "entities": [
    {
      "name": "EntityName",
      "idType": "UUID",
      "attributes": [{"name": "attr", "type": "string"}],
      "methods": [{"name": "method", "params": "param: type", "returnType": "void"}]
    }
  ],
  "valueObjects": [
    {
      "name": "ValueObjectName",
      "attributes": [{"name": "attr", "type": "type"}]
    }
  ],
  "aggregates": [
    {"root": "EntityName", "children": ["ChildEntity"]}
  ],
  "relationships": [
    {"from": "Entity1", "to": "Entity2", "type": "--", "label": "has"}
  ]
}

Requirements:
- Minimum 3 entities
- Identify value objects and aggregates
- Relationship types: -- (association), *-- (composition), <|-- (inheritance)

Output ONLY valid JSON.`;

    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are a DDD expert. Generate domain models in JSON.' },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 2500,
      response_format: { type: 'json_object' } as any
    });

    try {
      const jsonContent = this.extractJSON(result.content || '');
      return DomainModelSchema.parse(jsonContent);
    } catch (error: any) {
      this.logger.error(`Domain model validation failed: ${error.message}`);
      throw new OOADSchemaValidationError('DomainModel', error.errors || [error.message]);
    }
  }

  private async generatePatterns(provider: any, model: string, goal: string, description: string, useCases: any[], domainModel: DomainModel, memoryContext: string): Promise<Patterns> {
    const prompt = `Select 3-5 design patterns for this system.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}
${memoryContext}

DOMAIN MODEL ENTITIES: ${domainModel.entities.map(e => e.name).join(', ')}

Generate a JSON object:
{
  "patterns": [
    {
      "name": "Pattern Name",
      "type": "Creational" | "Structural" | "Behavioral" | "Enterprise",
      "justification": "Why this pattern is needed (min 50 chars)",
      "location": "Where in codebase (e.g., src/domain/repositories)",
      "benefit": "What problem it solves (min 20 chars)"
    }
  ]
}

Consider patterns like: Repository, Factory, Strategy, Observer, Facade, Adapter, etc.
Requirements: 3-5 patterns, justification min 50 chars, benefit min 20 chars.

Output ONLY valid JSON.`;

    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are a design patterns expert. Generate pattern selections in JSON.' },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 2000,
      response_format: { type: 'json_object' } as any
    });

    try {
      const jsonContent = this.extractJSON(result.content || '');
      return PatternsSchema.parse(jsonContent);
    } catch (error: any) {
      this.logger.error(`Patterns validation failed: ${error.message}`);
      throw new OOADSchemaValidationError('Patterns', error.errors || [error.message]);
    }
  }

  private async generateArchitecture(provider: any, model: string, goal: string, description: string, useCases: any[], domainModel: DomainModel, patterns: Patterns, memoryContext: string): Promise<Architecture> {
    const prompt = `Define the layered architecture for this system.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}

ENTITIES: ${domainModel.entities.map(e => e.name).join(', ')}
PATTERNS: ${patterns.patterns.map(p => p.name).join(', ')}

Generate a JSON object:
{
  "style": "Layered Architecture" | "Hexagonal" | "Clean Architecture",
  "layers": [
    {
      "name": "Domain Layer",
      "responsibilities": "Business logic, entities, value objects",
      "components": ["Entity1", "Entity2"],
      "dependencies": "None (no external dependencies)"
    },
    {
      "name": "Application Layer",
      "responsibilities": "Use case orchestration, application services",
      "components": ["UseCase1Service", "UseCase2Service"],
      "dependencies": "Depends on Domain Layer"
    },
    {
      "name": "Infrastructure Layer",
      "responsibilities": "DB, external APIs, frameworks",
      "components": ["Repository implementations", "API clients"],
      "dependencies": "Depends on Domain and Application"
    }
  ]
}

Requirements: Minimum 3 layers.
Output ONLY valid JSON.`;

    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are an architecture expert. Generate layered architecture in JSON.' },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 1500,
      response_format: { type: 'json_object' } as any
    });

    try {
      const jsonContent = this.extractJSON(result.content || '');
      return ArchitectureSchema.parse(jsonContent);
    } catch (error: any) {
      this.logger.error(`Architecture validation failed: ${error.message}`);
      throw new OOADSchemaValidationError('Architecture', error.errors || [error.message]);
    }
  }

  /**
   * Ask the LLM for a structured sequence diagram (validated by SequenceDiagramSchema and
   * rendered through sequence-diagram.puml). Falls back to the layered default
   * Actor → Controller → Service → Repository so one weak answer can't fail the design.
   */
  private async generateSequenceDiagram(provider: any, model: string, useCase: UseCaseItem, domainModel: DomainModel): Promise<SequenceDiagram> {
    const entities = domainModel.entities.map(e => e.name).join(', ');
    const prompt = `Design the sequence of interactions for this use case in a layered architecture.

USE CASE: ${useCase.name} (${useCase.id})
ACTOR: ${useCase.actor}
MAIN FLOW:
${useCase.mainFlow.map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n')}

DOMAIN ENTITIES: ${entities}

Use participants from these layers, in this order:
- the actor (kind "actor")
- a controller, e.g. "OrderController" (kind "boundary")
- an application service, e.g. "OrderService" (kind "control")
- domain entities from the list above (kind "entity")
- repository interfaces, e.g. "IOrderRepository" (kind "database")

Generate a JSON object:
{
  "participants": [{"name": "Customer", "kind": "actor"}, {"name": "OrderController", "kind": "boundary"}],
  "messages": [
    {"from": "Customer", "to": "OrderController", "label": "placeOrder(items)", "kind": "sync"},
    {"from": "OrderController", "to": "Customer", "label": "orderId", "kind": "reply"}
  ]
}

Requirements: at least 2 participants and 3 messages; kind of a message is "sync", "async" or "reply".
Output ONLY valid JSON.`;

    try {
      const result = await provider.chat({
        messages: [
          { role: 'system', content: 'You are a UML expert. Generate sequence diagrams as JSON.' },
          { role: 'user', content: prompt }
        ],
        model,
        maxTokens: 1500,
        response_format: { type: 'json_object' } as any
      });
      return SequenceDiagramSchema.parse(this.extractJSON(result.content || ''));
    } catch (error: any) {
      this.logger.warn(`Sequence diagram for ${useCase.id} invalid, using layered default: ${error.message}`);
      return defaultSequenceDiagram(useCase, domainModel);
    }
  }

  private extractJSON(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        return JSON.parse(objMatch[0]);
      }
      throw new Error('No valid JSON found in LLM response');
    }
  }
}
