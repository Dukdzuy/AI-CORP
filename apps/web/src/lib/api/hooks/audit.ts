import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { downloadFile } from '../download';

export interface AuditEntryView {
  id: string;
  timestamp: string;
  actor: { type: string; userId?: string | null; label?: string | null; apiKeyId?: string | null; agentRole?: string | null };
  action: string;
  resourceType: string;
  resourceId: string | null;
  projectId: string | null;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMessage: string | null;
}

export interface AuditFilter {
  action?: string;
  userId?: string;
  resourceType?: string;
  projectId?: string;
  success?: 'true' | 'false';
  from?: string;
  to?: string;
  search?: string;
}

export interface SecurityAnomaly {
  rule: string;
  severity: 'warning' | 'critical';
  subject: string;
  count: number;
  firstAt: string;
  lastAt: string;
  message: string;
}

const clean = (f: AuditFilter) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>;

export const auditKeys = {
  all: ['audit'] as const,
  page: (filter: AuditFilter, page: number, pageSize: number) => [...auditKeys.all, 'page', filter, page, pageSize] as const,
  anomalies: (hours: number) => [...auditKeys.all, 'anomalies', hours] as const,
};

export const useAuditLog = (filter: AuditFilter, page: number, pageSize: number) =>
  useQuery({
    queryKey: auditKeys.page(filter, page, pageSize),
    queryFn: async () =>
      (await apiClient.get<{ items: AuditEntryView[]; total: number }>('/audit', { params: { ...clean(filter), page, pageSize } })).data,
    placeholderData: keepPreviousData,
  });

export const useAnomalies = (hours = 24) =>
  useQuery({
    queryKey: auditKeys.anomalies(hours),
    queryFn: async () => (await apiClient.get<SecurityAnomaly[]>('/audit/anomalies', { params: { hours } })).data,
    refetchInterval: 60_000,
  });

export const exportAuditCsv = (filter: AuditFilter) => downloadFile('/audit/export', clean(filter), 'audit-log.csv');
