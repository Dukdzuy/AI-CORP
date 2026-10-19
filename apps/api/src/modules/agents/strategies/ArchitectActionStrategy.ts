import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { TemplateService } from '../services/template.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SandboxExecutor } from '../../tools/sandbox.executor';
import {
  DomainModelSchema,
  PatternsSchema,
  ArchitectureSchema,
  DomainModel,
  Patterns,
  Architecture,
  UseCaseData
} from '../schemas/ooad.schema';
import { OOADSchemaValidationError } from '../errors/OOADSchemaValidationError';

@Injectable()
export class ArchitectActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(ArchitectActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly templateService: TemplateService,
    private readonly prisma: PrismaService,
    private readonly sandboxExecutor: SandboxExecutor
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
    const sequenceDiagrams: { ucId: string; diagram: string }[] = [];

    for (const uc of highPriorityUCs) {
      const diagram = await this.generateSequenceDiagram(provider, actualModelConfig.model, uc, domainModel);
      sequenceDiagrams.push({ ucId: uc.id, diagram });
    }

    // Generate artifacts
    const domainModelPuml = this.generateDomainModelPuml(domainModel);
    const architectureMd = await this.templateService.render('architecture-patterns-template.md', {
      architecture,
      patterns: patterns.patterns
    });

    // Write files to sandbox
    const docsPath = `projects/${projectId}/docs`;
    const filesWritten: string[] = [];

    try {
      await this.sandboxExecutor.executeInSandbox('custom_command', `mkdir -p ${docsPath}`, {
        maxMemoryMB: 64,
        maxCPUPercent: 10,
        maxDiskMB: 10,
        timeout: 5000
      });

      // Write domain-model.puml
      await this.writeFile(`${docsPath}/domain-model.puml`, domainModelPuml);
      filesWritten.push(`${docsPath}/domain-model.puml`);

      // Write architecture-patterns.md
      await this.writeFile(`${docsPath}/architecture-patterns.md`, architectureMd);
      filesWritten.push(`${docsPath}/architecture-patterns.md`);

      // Write sequence diagrams
      for (const seq of sequenceDiagrams) {
        const filename = `${docsPath}/sequence-${seq.ucId}.puml`;
        await this.writeFile(filename, seq.diagram);
        filesWritten.push(filename);
      }

      this.logger.log(`Architect wrote OOAD artifacts to ${docsPath}`);
    } catch (err: any) {
      this.logger.error(`Failed to write OOAD artifacts: ${err.message}`);
      throw new Error(`Architect failed to write artifacts: ${err.message}`);
    }

    // Persist to database (serialize to ensure Prisma Json compatibility)
    const metadataToSave = JSON.parse(JSON.stringify({
      ...ooadMetadata,
      domainModel,
      patterns: patterns.patterns,
      architecture
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

  private async generateSequenceDiagram(provider: any, model: string, useCase: any, domainModel: DomainModel): Promise<string> {
    const entities = domainModel.entities.map(e => e.name).join(', ');
    const prompt = `Generate a PlantUML sequence diagram for this use case.

USE CASE: ${useCase.name} (${useCase.id})
MAIN FLOW:
${useCase.mainFlow.map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n')}

ENTITIES: ${entities}

Generate a PlantUML sequence diagram showing interactions between:
- Actor (${useCase.actor})
- System components
- Domain entities (${entities})

Output valid PlantUML syntax starting with @startuml and ending with @enduml.
Include participant declarations and message arrows.`;

    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are a UML expert. Generate PlantUML sequence diagrams.' },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 1500
    });

    let content = result.content || '';
    
    // Extract PlantUML if in code block
    const pumlMatch = content.match(/```(?:plantuml)?\s*([\s\S]*?)\s*```/);
    if (pumlMatch) {
      content = pumlMatch[1];
    }

    // Ensure it starts and ends properly
    if (!content.includes('@startuml')) {
      content = '@startuml\n' + content;
    }
    if (!content.includes('@enduml')) {
      content = content + '\n@enduml';
    }

    return content;
  }

  private generateDomainModelPuml(model: DomainModel): string {
    let puml = '@startuml\ntitle Domain Model\n\n';

    // Entities
    model.entities.forEach(entity => {
      puml += `class ${entity.name} <<Entity>> {\n`;
      puml += `  - id: ${entity.idType}\n`;
      entity.attributes.forEach(attr => {
        puml += `  - ${attr.name}: ${attr.type}\n`;
      });
      if (entity.methods.length > 0) {
        puml += '  --\n';
        entity.methods.forEach(method => {
          puml += `  + ${method.name}(${method.params}): ${method.returnType}\n`;
        });
      }
      puml += '}\n\n';
    });

    // Value Objects
    model.valueObjects.forEach(vo => {
      puml += `class ${vo.name} <<Value Object>> {\n`;
      vo.attributes.forEach(attr => {
        puml += `  - ${attr.name}: ${attr.type}\n`;
      });
      puml += '}\n\n';
    });

    // Relationships
    model.relationships.forEach(rel => {
      puml += `${rel.from} ${rel.type} ${rel.to}`;
      if (rel.label) {
        puml += ` : ${rel.label}`;
      }
      puml += '\n';
    });

    puml += '@enduml';
    return puml;
  }

  private async writeFile(filepath: string, content: string): Promise<void> {
    const writeCmd = `cat > "${filepath}" << 'HEREDOC_EOF'\n${content}\nHEREDOC_EOF`;
    await this.sandboxExecutor.executeInSandbox('custom_command', writeCmd, {
      maxMemoryMB: 128,
      maxCPUPercent: 20,
      maxDiskMB: 50,
      timeout: 10000
    });
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
