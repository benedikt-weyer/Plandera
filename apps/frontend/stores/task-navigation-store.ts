import { create } from 'zustand';

interface TaskNavigationState {
  // Task navigation
  navigateToTaskId: string | null;
  highlightedTaskId: string | null;
  
  // Task actions
  setNavigateToTask: (taskId: string) => void;
  setHighlightedTask: (taskId: string | null) => void;
  clearTaskNavigation: () => void;
}

export const useTaskNavigation = create<TaskNavigationState>((set) => ({
  // Task state
  navigateToTaskId: null,
  highlightedTaskId: null,
  
  // Task actions
  setNavigateToTask: (taskId: string) => {
    set({ navigateToTaskId: taskId, highlightedTaskId: taskId });
  },
  
  setHighlightedTask: (taskId: string | null) => {
    set({ highlightedTaskId: taskId });
  },
  
  clearTaskNavigation: () => {
    // Only clear the navigation ID, keep the highlight for the animation
    set({ navigateToTaskId: null });
  },
}));
