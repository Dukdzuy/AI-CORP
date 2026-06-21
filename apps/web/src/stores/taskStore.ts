import { create } from 'zustand';
import { Task, TaskStatus } from '@ai-corp/shared-types';

interface TaskState {
  selectedTaskId: string | null;
  statusFilter: TaskStatus | 'ALL';
  setSelectedTaskId: (id: string | null) => void;
  setStatusFilter: (status: TaskStatus | 'ALL') => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  selectedTaskId: null,
  statusFilter: 'ALL',
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setStatusFilter: (status) => set({ statusFilter: status }),
}));
