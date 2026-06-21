import { create } from 'zustand';
import { Project } from '@ai-corp/shared-types';

interface ProjectState {
  activeProjectId: string | null;
  selectedProject: Project | null;
  setActiveProject: (id: string | null) => void;
  setSelectedProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  selectedProject: null,
  setActiveProject: (id) => set({ activeProjectId: id }),
  setSelectedProject: (project) => set({ selectedProject: project }),
}));
