import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

/** Phase 6 (Tasks 24–26): mirrors of the API's analytics, estimation and code-quality views */

export interface QualityScore { value: number | null; basis: string; samples: number }
export interface AgentMetrics {
  agentRole: string;
  executionCount: number;
  completed: number;
  failed: number;
  successRate: number | null;
  avgDurationMs: number;
  p95DurationMs: number;
  retries: number;
  totalCost: number;
  costPerExecution: number | null;
  costPerSuccess: number | null;
  quality: QualityScore;
}
export interface AgentRow extends AgentMetrics {
  previous: AgentMetrics;
  trend: { successRateDelta: number | null; avgDurationChange: number | null; costPerExecutionChange: number | null; qualityDelta: number | null };
  rank: number;
  recentOutcomes: Array<'completed' | 'failed'>;
}
export interface DailyPoint { date: string; role: string; executions: number; successRate: number | null }
export interface HeatmapCell { weekday: number; hour: number; count: number }
export interface AgentAnomaly { type: string; agentRole: string; severity: 'medium' | 'high'; message: string; value: number; threshold: number }
export interface AgentAnalytics {
  period: { start: string; end: string; previousStart: string };
  generatedAt: string;
  roles: AgentRow[];
  daily: DailyPoint[];
  heatmap: HeatmapCell[];
  qaPrediction: { samples: number; truePass: number; trueFail: number; falsePass: number; falseFail: number; accuracy: number | null };
  anomalies: AgentAnomaly[];
}

export interface RoleForecast { role: string; durationMs: number; cost: number; method: 'regression' | 'median'; samples: number }
export interface Forecast {
  durationMs: number;
  cost: number;
  confidence: 'low' | 'medium' | 'high';
  byRole: RoleForecast[];
  features: { descriptionLength: number; useCaseCount: number };
  imputed: string[];
  unknownRoles: string[];
  trainingProjects: number;
}
export interface ForecastComparison {
  predictedDurationMs: number;
  actualDurationMs: number;
  predictedCost: number;
  actualCost: number;
  durationError: number | null;
  costError: number | null;
}
export interface ProjectEstimate {
  projectId: string;
  current: Forecast;
  history: Array<{ id: string; stage: string; createdAt: string; durationMs: number; cost: number; confidence: string }>;
  actual: { durationMs: number; cost: number; finished: boolean };
  comparison: (ForecastComparison & { stage: string }) | null;
}
export interface EstimationModelView {
  trainingProjects: number;
  minRegressionSamples: number;
  roles: Array<{ role: string; samples: number; method: string; evaluation: { maeDurationMs: number | null; mapeDuration: number | null; maeCost: number | null; mapeCost: number | null } }>;
  accuracy: Array<ForecastComparison & { projectId: string; projectName: string; stage: string }>;
  meanAbsoluteDurationError: number | null;
  meanAbsoluteCostError: number | null;
}

export interface CodeFinding { kind: string; rule: string; line: number; message: string }
export interface FileAssessment { path: string; score: number; loc: number; maxComplexity: number; maintainabilityIndex: number; findings: CodeFinding[] }
export interface CodeQualityAssessment {
  score: number | null;
  files: FileAssessment[];
  totals: Record<string, number>;
  predictedQaVerdict: 'pass' | 'fail' | null;
  reasons: string[];
  threshold: number;
}

export const useAgentAnalytics = (days: number, projectId?: string) =>
  useQuery({
    queryKey: ['analytics', 'agents', days, projectId ?? null],
    queryFn: async () => (await apiClient.get<AgentAnalytics>('/analytics/agents', { params: { days, ...(projectId ? { projectId } : {}) } })).data,
  });

export const useEstimationModel = () =>
  useQuery({ queryKey: ['analytics', 'estimation'], queryFn: async () => (await apiClient.get<EstimationModelView>('/analytics/estimation')).data });

export const useProjectEstimate = (projectId: string) =>
  useQuery({ queryKey: ['estimate', projectId], queryFn: async () => (await apiClient.get<ProjectEstimate>(`/projects/${projectId}/estimate`)).data });

export const useCodeQuality = (projectId: string) =>
  useQuery({ queryKey: ['code-quality', projectId], queryFn: async () => (await apiClient.get<CodeQualityAssessment>(`/projects/${projectId}/code-quality`)).data });
