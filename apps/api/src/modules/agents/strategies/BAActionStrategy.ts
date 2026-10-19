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
import { UseCaseDataSchema, UseCaseData } from '../schemas/ooad.schema';
import { OOADSchemaValidationError } from '../errors/OOADSchemaValidationError';

@Injectable()
export class BAActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(BAActionStrategy.name);

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
      ? `\n\nRelevant requirements patterns:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectContext?.description || '';

    const systemPrompt = `You are a Business Analyst. Generate structured use cases in JSON format following the OOAD methodology.`;

    const prompt = `You are a Business Analyst. Generate structured use cases in JSON format.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}
${memoryContext}

Generate a JSON object with this EXACT structure:
{
  "actors": ["Actor1", "Actor2", ...],
  "useCases": [
    {
      "id": "UC-001",
      "name": "Use case name",
      "actor": "Actor name",
      "priority": "High" | "Medium" | "Low",
      "preConditions": ["condition 1", "condition 2"],
      "postConditions": ["condition 1", "condition 2"],
      "mainFlow": ["step 1", "step 2", "step 3", "step 4", "step 5", ...],
      "alternativeFlows": ["alt flow 1", "alt flow 2"],
      "exceptionFlows": ["exception 1", "exception 2"]
    }
  ]
}

Requirements:
- Minimum 5 use cases
- Each use case must have at least 5 steps in mainFlow
- IDs must follow format UC-001, UC-002, etc.
- Priority must be one of: High, Medium, Low

Output ONLY valid JSON, no additional text.`;

    // Fetch latest model config
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/openrouter/free', fallbackProvider: 'opencode' };
    const actualModelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.BA, modelConfig);
    const provider = this.llmFactory.getProvider(actualModelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: actualModelConfig.model,
      maxTokens: 3000,
      response_format: { type: 'json_object' } as any
    });

    // Parse and validate JSON
    let useCaseData: UseCaseData;
    try {
      const jsonContent = this.extractJSON(result.content || '');
      useCaseData = UseCaseDataSchema.parse(jsonContent);
    } catch (error: any) {
      this.logger.error(`OOAD Schema validation failed: ${error.message}`);
      throw new OOADSchemaValidationError('UseCaseData', error.errors || [error.message]);
    }

    // Generate PlantUML use case diagram
    const useCaseDiagram = this.generateUseCaseDiagram(useCaseData);

    // Render use cases markdown
    const useCasesMd = await this.templateService.render('use-case-template.md', useCaseData);

    // Write files to sandbox
    const projectId = context.projectId || 'unknown';
    const docsPath = `projects/${projectId}/docs`;

    try {
      // Create docs directory
      await this.sandboxExecutor.executeInSandbox('custom_command', `mkdir -p ${docsPath}`, {
        maxMemoryMB: 64,
        maxCPUPercent: 10,
        maxDiskMB: 10,
        timeout: 5000
      });

      // Write use-cases.md
      const writeMdCmd = `cat > ${docsPath}/use-cases.md << 'HEREDOC_EOF'\n${useCasesMd}\nHEREDOC_EOF`;
      await this.sandboxExecutor.executeInSandbox('custom_command', writeMdCmd, {
        maxMemoryMB: 128,
        maxCPUPercent: 20,
        maxDiskMB: 50,
        timeout: 10000
      });

      // Write use-case-diagram.puml
      const writePumlCmd = `cat > ${docsPath}/use-case-diagram.puml << 'HEREDOC_EOF'\n${useCaseDiagram}\nHEREDOC_EOF`;
      await this.sandboxExecutor.executeInSandbox('custom_command', writePumlCmd, {
        maxMemoryMB: 128,
        maxCPUPercent: 20,
        maxDiskMB: 50,
        timeout: 10000
      });

      this.logger.log(`BA wrote OOAD artifacts to ${docsPath}`);
    } catch (err: any) {
      this.logger.error(`Failed to write OOAD artifacts: ${err.message}`);
      throw new Error(`BA Agent failed to write artifacts: ${err.message}`);
    }

    // Persist to database (serialize to ensure Prisma Json compatibility)
    if (projectId !== 'unknown') {
      const metadataToSave = JSON.parse(JSON.stringify({
        actors: useCaseData.actors,
        useCases: useCaseData.useCases
      }));
      
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          ooadMetadata: metadataToSave
        }
      });
      this.logger.log(`Saved OOAD metadata to project ${projectId}`);
    }

    // Save memory
    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.BA);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.BA,
        'requirements_analysis',
        `Generated ${useCaseData.useCases.length} use cases for: ${goal}`,
        { importance: 7, projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.BA,
        agentRole: AgentRole.BA,
        taskId: context.taskId || 'none',
        actionType: 'generateUseCases',
        toolName: 'llm+template',
        parameters: { goal, useCaseCount: useCaseData.useCases.length }
      }
    });

    return {
      success: true,
      output: {
        action: 'generateUseCases',
        output: useCasesMd,
        useCases: useCaseData.useCases,
        actors: useCaseData.actors,
        filesWritten: [`${docsPath}/use-cases.md`, `${docsPath}/use-case-diagram.puml`]
      },
      errors: []
    };
  }

  private extractJSON(content: string): any {
    // Try to parse as-is first
    try {
      return JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      // Try to find JSON object
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        return JSON.parse(objMatch[0]);
      }
      throw new Error('No valid JSON found in LLM response');
    }
  }

  private generateUseCaseDiagram(data: UseCaseData): string {
    let puml = '@startuml\ntitle Use Case Diagram\nleft to right direction\n\n';

    // Add actors
    data.actors.forEach(actor => {
      const actorId = actor.replace(/\s/g, '').replace(/[^a-zA-Z0-9]/g, '');
      puml += `actor "${actor}" as ${actorId}\n`;
    });

    puml += '\nrectangle System {\n';

    // Add use cases
    data.useCases.forEach(uc => {
      const ucId = uc.id.replace(/-/g, '');
      puml += `  usecase "${uc.name}" as ${ucId}\n`;
    });

    puml += '}\n\n';

    // Add relationships
    data.useCases.forEach(uc => {
      const ucId = uc.id.replace(/-/g, '');
      const actorId = uc.actor.replace(/\s/g, '').replace(/[^a-zA-Z0-9]/g, '');
      puml += `${actorId} --> ${ucId}\n`;
    });

    puml += '@enduml';
    return puml;
  }
}
