import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectWorkspace } from '../../workspace/project-workspace.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { EventBus } from '../../../domain/events/EventBus';
import { QualityGateEvaluatedEvent } from '../../../domain/events/QualityGateEvaluatedEvent';

export interface ChecklistItem {
  name: string;
  actual: any;
  expected: any;
  passed: boolean;
}

export interface QualityGateCriteria {
  minUseCases: number;
  minEntities: number;
  minPatterns: number;
  /** Files that must exist under the project's docs/ folder */
  requiredArtifacts: string[];
}

export const DEFAULT_OOAD_GATE_CRITERIA: QualityGateCriteria = {
  minUseCases: 5,
  minEntities: 3,
  minPatterns: 3,
  requiredArtifacts: ['use-cases.md', 'use-case-diagram.puml', 'domain-model.puml', 'class-diagram.puml', 'architecture-patterns.md'],
};

export interface QualityGateResult {
  passed: boolean;
  checklist: ChecklistItem[];
  score: number;
}

@Injectable()
export class QualityGateHandler {
  private readonly logger = new Logger(QualityGateHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: ProjectWorkspace,
    private readonly websocketGateway: AppWebSocketGateway,
    @Optional() private readonly eventBus?: EventBus
  ) {}

  async executeGate(
    projectId: string,
    gateId: string,
    criteria: QualityGateCriteria = DEFAULT_OOAD_GATE_CRITERIA
  ): Promise<QualityGateResult> {
    this.logger.log(`Executing quality gate ${gateId} for project ${projectId}`);

    // Load OOAD metadata from DB
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ooadMetadata: true }
    });

    const metadata = (project?.ooadMetadata as any) || {};

    // Build checklist
    const checklist: ChecklistItem[] = [
      {
        name: 'Use cases count',
        actual: metadata.useCases?.length || 0,
        expected: `>= ${criteria.minUseCases}`,
        passed: (metadata.useCases?.length || 0) >= criteria.minUseCases
      },
      {
        name: 'Domain entities count',
        actual: metadata.domainModel?.entities?.length || 0,
        expected: `>= ${criteria.minEntities}`,
        passed: (metadata.domainModel?.entities?.length || 0) >= criteria.minEntities
      },
      {
        name: 'Design patterns count',
        actual: metadata.patterns?.length || 0,
        expected: `>= ${criteria.minPatterns}`,
        passed: (metadata.patterns?.length || 0) >= criteria.minPatterns
      }
    ];

    // Note: Pattern justification length is already validated by PatternsSchema at creation time
    // No need to re-check here unless metadata was manually edited

    // Check required artifact files exist in the project workspace
    for (const artifact of criteria.requiredArtifacts) {
      let actual: string;
      let passed = false;
      try {
        passed = await this.workspace.exists(projectId, `docs/${artifact}`);
        actual = passed ? 'exists' : 'missing';
      } catch (err: any) {
        this.logger.warn(`Artifact check failed for ${artifact}: ${err.message}`);
        actual = `check failed (${err.message})`;
      }
      checklist.push({ name: `Artifact: ${artifact}`, actual, expected: 'exists', passed });
    }

    // Calculate results
    const passedCount = checklist.filter(item => item.passed).length;
    const totalCount = checklist.length;
    const score = Math.round((passedCount / totalCount) * 100);
    const allPassed = checklist.every(item => item.passed);

    // Persist gate result
    await this.prisma.qualityGateLog.create({
      data: {
        projectId,
        gateId,
        passed: allPassed,
        checklist: checklist as unknown as Prisma.InputJsonValue,
        timestamp: new Date()
      }
    });

    // Emit WebSocket event
    this.websocketGateway.sendToProject(projectId, {
      type: 'quality_gate_result',
      payload: {
        gateId,
        passed: allPassed,
        score,
        checklist
      }
    });

    this.logger.log(`Quality gate ${gateId} for project ${projectId}: ${allPassed ? 'PASSED' : 'FAILED'} (score: ${score}%)`);

    // Domain event: the learning handler grades the BA / Architect executions with it (Task 14)
    const failedChecks = checklist
      .filter(item => !item.passed)
      .map(item => `${item.name}: ${item.actual} (expected ${item.expected})`);
    await this.eventBus
      ?.publish(new QualityGateEvaluatedEvent(projectId, gateId, allPassed, score, failedChecks))
      .catch(err => this.logger.warn(`Failed to publish gate event: ${err?.message || err}`));

    return {
      passed: allPassed,
      checklist,
      score
    };
  }
}
