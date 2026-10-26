import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  permissions: string[];
}

export interface RoleMatrix {
  permissions: string[];
  roles: Array<{ role: string; permissions: string[] }>;
}

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
  roles: () => [...userKeys.all, 'roles'] as const,
};

export const useUsers = () =>
  useQuery({ queryKey: userKeys.list(), queryFn: async () => (await apiClient.get<ManagedUser[]>('/users')).data });

export const useRoleMatrix = () =>
  useQuery({ queryKey: userKeys.roles(), queryFn: async () => (await apiClient.get<RoleMatrix>('/users/roles')).data, staleTime: Infinity });

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => (await apiClient.patch<ManagedUser>(`/users/${id}/role`, { role })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.list() }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => (await apiClient.patch<ManagedUser>(`/users/${id}/active`, { isActive })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.list() }),
  });
}
