import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SandboxExecutor } from '../../tools/sandbox.executor';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';

export interface ChecklistItem {
  name: string;
  actual: any;
  expected: any;
  passed: boolean;
}

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
    private readonly sandboxExecutor: SandboxExecutor,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async executeGate(
    projectId: string,
    gateId: string,
    criteria: {
      minUseCases: number;
      minEntities: number;
      minPatterns: number;
      requiredArtifacts: string[];
    }
  ): Promise<QualityGateResult> {
    this.logger.log(`Executing quality gate ${gateId} for project ${projectId}`);

    const docsPath = `projects/${projectId}/docs`;

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

    // Check required artifact files exist
    for (const artifact of criteria.requiredArtifacts) {
      const checkFileCommand = `test -f ${docsPath}/${artifact} && echo "exists" || echo "missing"`;
      try {
        const result = await this.sandboxExecutor.executeInSandbox('custom_command', checkFileCommand, {
          maxMemoryMB: 64,
          maxCPUPercent: 10,
          maxDiskMB: 10,
          timeout: 5000
        });
        const output = result.output.trim();
        const exists = output === 'exists';
        const checkFailed = output !== 'exists' && output !== 'missing';
        
        checklist.push({
          name: `Artifact: ${artifact}`,
          actual: checkFailed ? 'check failed (sandbox error)' : (exists ? 'exists' : 'missing'),
          expected: 'exists',
          passed: exists
        });
      } catch (err: any) {
        this.logger.warn(`Sandbox command failed for artifact ${artifact}: ${err.message}`);
        checklist.push({
          name: `Artifact: ${artifact}`,
          actual: `check failed (${err.message})`,
          expected: 'exists',
          passed: false
        });
      }
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

    return {
      passed: allPassed,
      checklist,
      score
    };
  }
}
