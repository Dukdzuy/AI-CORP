import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  useCaseCount: number;
  entityCount: number;
  patternCount: number;
  gatePassRate: number;
  lastGateScore: number | null;
  testCoverage: number | null;
}

export interface AggregateMetrics {
  totalProjects: number;
  avgUseCases: number;
  avgEntities: number;
  avgPatterns: number;
  avgGatePassRate: number;
  avgTestCoverage: number;
}

@Injectable()
export class OoadMetricsService {
  private readonly logger = new Logger(OoadMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ooadMetadata: true,
        qualityGateLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });

    if (!project) {
      return null;
    }

    const metadata = (project.ooadMetadata as any) || {};
    const useCaseCount = metadata.useCases?.length || 0;
    const entityCount = metadata.domainModel?.entities?.length || 0;
    const patternCount = metadata.patterns?.length || 0;

    // Calculate gate pass rate
    const gateLogs = project.qualityGateLogs;
    const gatePassRate = gateLogs.length > 0
      ? (gateLogs.filter(log => log.passed).length / gateLogs.length) * 100
      : 0;

    const lastGateScore = gateLogs.length > 0 && gateLogs[0].checklist
      ? this.calculateScore(gateLogs[0].checklist as any)
      : null;

    // Extract test coverage from ooadMetadata (persisted by QA Agent)
    const testCoverage = metadata.testCoverage !== undefined && metadata.testCoverage !== null
      ? Math.round(metadata.testCoverage)
      : null;

    return {
      projectId: project.id,
      projectName: project.name,
      useCaseCount,
      entityCount,
      patternCount,
      gatePassRate: Math.round(gatePassRate),
      lastGateScore,
      testCoverage
    };
  }

  async getAllProjectsMetrics(): Promise<ProjectMetrics[]> {
    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        ooadMetadata: true,
        qualityGateLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });

    return projects.map(project => {
      const metadata = (project.ooadMetadata as any) || {};
      const useCaseCount = metadata.useCases?.length || 0;
      const entityCount = metadata.domainModel?.entities?.length || 0;
      const patternCount = metadata.patterns?.length || 0;

      const gateLogs = project.qualityGateLogs;
      const gatePassRate = gateLogs.length > 0
        ? (gateLogs.filter(log => log.passed).length / gateLogs.length) * 100
        : 0;

      const lastGateScore = gateLogs.length > 0 && gateLogs[0].checklist
        ? this.calculateScore(gateLogs[0].checklist as any)
        : null;

      return {
        projectId: project.id,
        projectName: project.name,
        useCaseCount,
        entityCount,
        patternCount,
        gatePassRate: Math.round(gatePassRate),
        lastGateScore,
        testCoverage: metadata.testCoverage !== undefined && metadata.testCoverage !== null
          ? Math.round(metadata.testCoverage)
          : null
      };
    });
  }

  async getAggregateMetrics(): Promise<AggregateMetrics> {
    const allMetrics = await this.getAllProjectsMetrics();

    if (allMetrics.length === 0) {
      return {
        totalProjects: 0,
        avgUseCases: 0,
        avgEntities: 0,
        avgPatterns: 0,
        avgGatePassRate: 0,
        avgTestCoverage: 0
      };
    }

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;

    return {
      totalProjects: allMetrics.length,
      avgUseCases: Math.round(avg(allMetrics.map(m => m.useCaseCount))),
      avgEntities: Math.round(avg(allMetrics.map(m => m.entityCount))),
      avgPatterns: Math.round(avg(allMetrics.map(m => m.patternCount))),
      avgGatePassRate: Math.round(avg(allMetrics.map(m => m.gatePassRate))),
      avgTestCoverage: Math.round(avg(allMetrics.map(m => m.testCoverage || 0)))
    };
  }

  async getLeaderboard(metric: 'testCoverage' | 'gatePassRate' | 'useCaseCount', limit = 10): Promise<ProjectMetrics[]> {
    const allMetrics = await this.getAllProjectsMetrics();

    const sortedMetrics = allMetrics.sort((a, b) => {
      const aVal = a[metric] || 0;
      const bVal = b[metric] || 0;
      return bVal - aVal;
    });

    return sortedMetrics.slice(0, limit);
  }

  private calculateScore(checklist: any[]): number {
    if (!Array.isArray(checklist) || checklist.length === 0) {
      return 0;
    }
    const passedCount = checklist.filter(item => item.passed).length;
    return Math.round((passedCount / checklist.length) * 100);
  }
}
