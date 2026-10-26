/**
 * Project export (Phase 5, Task 23)
 *
 * `ProjectExportSnapshot` is everything an export contains, gathered once by the
 * application service; each `IProjectExporter` renders it in one format. Adding a format
 * means adding an exporter, not changing the service.
 *
 * @pattern Strategy (one exporter per format), Registry
 */
import { ExportFormat } from '@ai-corp/shared-types';
import { CostReport } from './CostReport';
import { PerformanceReport } from './PerformanceReport';

export interface ProjectExportSnapshot {
  exportedAt: string;
  exportedBy: string;
  project: {
    id: string;
    name: string;
    description: string;
    goal: string;
    status: string;
    budget: number | null;
    costAccrued: number;
    createdAt: string;
    owner: string;
  };
  milestones: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignedAgent: string | null;
    milestone: string | null;
    actualCost: number;
    createdAt: string;
    updatedAt: string;
  }>;
  workflowRuns: Array<{ id: string; definition: string; status: string; startedAt: string; completedAt: string | null; steps: number }>;
  qualityGates: Array<{ gateId: string; passed: boolean; at: string }>;
  ooad: { useCases: number; traceabilityCoverage: number | null; artifacts: number };
  cost: CostReport;
  performance: PerformanceReport;
}

export interface ExportedFile {
  content: Buffer;
  contentType: string;
  fileName: string;
}

export interface IProjectExporter {
  readonly format: ExportFormat;
  export(snapshot: ProjectExportSnapshot): Promise<ExportedFile>;
}

export const PROJECT_EXPORTERS = Symbol('PROJECT_EXPORTERS');

/** File-system-safe base name from the project name */
export function exportBaseName(snapshot: ProjectExportSnapshot): string {
  const slug = snapshot.project.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 50);
  return `${slug || 'project'}-${snapshot.exportedAt.slice(0, 10)}`;
}
