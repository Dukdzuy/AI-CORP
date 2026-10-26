import { useQuery } from '@tanstack/react-query';
import { QualityGateChecklistItem } from '@ai-corp/shared-types';
import { apiClient } from '../client';

export type ArtifactKind = 'markdown' | 'plantuml' | 'code' | 'json' | 'text';

export interface ArtifactFile {
  path: string;
  size: number;
  kind: ArtifactKind;
  modifiedAt: string;
}

export interface ArtifactContent extends ArtifactFile {
  content: string;
}

export interface QualityGateRecord {
  id: string;
  gateId: string;
  passed: boolean;
  score: number;
  checklist: QualityGateChecklistItem[];
  timestamp: string;
}

export interface OoadProjectMetrics {
  projectId: string;
  projectName: string;
  useCaseCount: number;
  entityCount: number;
  patternCount: number;
  gatePassRate: number;
  lastGateScore: number | null;
  testCoverage: number | null;
  traceability?: {
    executed: boolean;
    passingCount: number | null;
    failingCount: number;
    totalCount: number;
    missingUseCases: string[];
    failingUseCases: string[];
    testsPassed: number;
    testsFailed: number;
    generatedAt: string | null;
  } | null;
}

export const artifactKeys = {
  all: ['artifacts'] as const,
  files: (projectId: string) => [...artifactKeys.all, 'files', projectId] as const,
  file: (projectId: string, path: string) => [...artifactKeys.all, 'file', projectId, path] as const,
  gates: (projectId: string) => [...artifactKeys.all, 'gates', projectId] as const,
  metrics: (projectId: string) => [...artifactKeys.all, 'metrics', projectId] as const,
};

/** Encode each path segment, keep the slashes (GET /projects/:id/files/*path) */
export const encodeFilePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

export const useProjectFiles = (projectId: string | null) =>
  useQuery({
    queryKey: artifactKeys.files(projectId!),
    queryFn: async () => (await apiClient.get<{ files: ArtifactFile[]; totalSize: number }>(`/projects/${projectId}/files`)).data,
    enabled: !!projectId,
  });

export const useProjectFile = (projectId: string | null, path: string | null) =>
  useQuery({
    queryKey: artifactKeys.file(projectId!, path!),
    queryFn: async () => (await apiClient.get<ArtifactContent>(`/projects/${projectId}/files/${encodeFilePath(path!)}`)).data,
    enabled: !!projectId && !!path,
  });

export const useQualityGates = (projectId: string | null) =>
  useQuery({
    queryKey: artifactKeys.gates(projectId!),
    queryFn: async () => (await apiClient.get<QualityGateRecord[]>(`/projects/${projectId}/quality-gates`)).data,
    enabled: !!projectId,
  });

export const useOoadMetrics = (projectId: string | null) =>
  useQuery({
    queryKey: artifactKeys.metrics(projectId!),
    queryFn: async () => {
      const { data } = await apiClient.get<OoadProjectMetrics | { error: string }>(`/ooad-metrics/project/${projectId}`);
      return 'error' in data ? null : data;
    },
    enabled: !!projectId,
  });

/** Download the project zip (the request needs the JWT header, so a plain link would not work) */
export const downloadProjectArchive = async (projectId: string, fallbackName = 'project.zip'): Promise<void> => {
  const response = await apiClient.get<Blob>(`/projects/${projectId}/archive`, { responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] || '');
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
