'use client';

import dynamic from 'next/dynamic';
import { ProjectDecrypted, CanDoItemDecrypted } from '@/utils/api/types';

// Dynamic import of the drag and drop sidebar to prevent SSR issues
const ProjectSidebarWithDragDrop = dynamic(
  () => import('./project-sidebar-drag-drop'),
  { 
    ssr: false,
    loading: () => (
      <div className="bg-muted/30 border-r border-border h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Projects
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 space-y-1">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded-md mb-2"></div>
              <div className="h-6 bg-muted/60 rounded-md mb-1"></div>
              <div className="h-6 bg-muted/60 rounded-md mb-1"></div>
              <div className="h-6 bg-muted/60 rounded-md"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
);

interface ProjectSidebarDynamicProps {
  readonly projects: ProjectDecrypted[];
  readonly tasks?: CanDoItemDecrypted[];
  readonly selectedProjectId?: string;
  readonly onProjectSelect: (projectId?: string) => void;
  readonly onRecommendedSelect: () => void;
  readonly onAllTasksSelect: () => void;
  readonly onMyDaySelect: () => void;
  readonly onAddProject: (name: string, description?: string, color?: string, parentId?: string) => Promise<boolean>;
  readonly onUpdateProject: (id: string, updateData: any) => Promise<boolean>;
  readonly onDeleteProject: (id: string) => Promise<boolean>;
  readonly onBulkReorderProjects: (updates: Array<{ id: string; parentId?: string; displayOrder: number }>) => Promise<boolean>;
  readonly onUpdateProjectCollapsedState: (id: string, isCollapsed: boolean) => Promise<boolean>;
  readonly onTaskDrop?: (taskId: string, projectId: string) => void;
  readonly isLoading?: boolean;
  readonly itemCounts?: Record<string, number>;
  readonly isCollapsed?: boolean;
  readonly isRecommendedSelected?: boolean;
  readonly isAllTasksSelected?: boolean;
  readonly isMyDaySelected?: boolean;
}

export default function ProjectSidebarDynamic(props: ProjectSidebarDynamicProps) {
  return <ProjectSidebarWithDragDrop {...props} />;
}
