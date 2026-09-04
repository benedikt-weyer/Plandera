'use client';

import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import { getRecommendedTasks, getRecommendationReason, calculateRecommendationScore } from '@/utils/can-do-list/recommendation-utils';
import { formatDueDate, getDueDateColorClass } from '@/utils/can-do-list/due-date-utils';
import { calculatePriority, getUrgencyColorClass, getPriorityDisplayText } from '@/utils/can-do-list/priority-utils';
import { Clock, Calendar, Zap, AlertTriangle, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';
import TaskListItem from './task-list-item';
import Fuse from 'fuse.js';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/utils/context/LanguageContext';

interface RecommendedTaskListProps {
  tasks: CanDoItemDecrypted[];
  projects: ProjectDecrypted[];
  isLoading?: boolean;
  searchQuery?: string;
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean, parentTaskId?: string) => Promise<void>;
  onToggleMyDay?: (id: string) => Promise<void>;
  onScheduleTask?: (taskId: string) => Promise<void>;
  isTaskScheduled?: (taskId: string) => boolean;
  calendarEvents?: any[];
  onNavigateToEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onAutoplanTasks?: (tasks: CanDoItemDecrypted[]) => void;
}

export default function RecommendedTaskList({
  tasks,
  projects,
  isLoading = false,
  searchQuery = '',
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
  onToggleMyDay,
  onScheduleTask,
  isTaskScheduled,
  calendarEvents = [],
  onNavigateToEvent,
  onDeleteEvent,
  onAutoplanTasks,
}: RecommendedTaskListProps) {
  const { t } = useTranslation();
  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'content', weight: 0.7 },
      { name: 'projectName', weight: 0.3 }
    ],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 1
  };

  // Get recommended tasks and apply search filter
  const filteredRecommendedTasks = useMemo(() => {
    const recommendedTasks = getRecommendedTasks(tasks, 20);
    
    // Apply search filter if search query exists
    if (searchQuery.trim()) {
      // Add project names and original index to tasks for search
      const searchableTasks = recommendedTasks.map((task, originalIndex) => ({
        ...task,
        projectName: task.project_id 
          ? projects.find(p => p.id === task.project_id)?.name || ''
          : 'Inbox',
        originalIndex: originalIndex // Preserve original ranking position
      }));

      const fuse = new Fuse(searchableTasks, fuseOptions);
      const searchResults = fuse.search(searchQuery.trim());
      return searchResults.map(result => result.item);
    }

    // If no search, add original index to all tasks
    return recommendedTasks.map((task, originalIndex) => ({
      ...task,
      originalIndex: originalIndex
    }));
  }, [tasks, projects, searchQuery]);
  
  // Get project name for a task
  const getProjectName = (task: CanDoItemDecrypted): string => {
    if (!task.project_id) return 'Inbox';
    const project = projects.find(p => p.id === task.project_id);
    return project?.name || 'Unknown Project';
  };
  
  // Get project color for a task
  const getProjectColor = (task: CanDoItemDecrypted): string => {
    if (!task.project_id) return '#6b7280'; // gray-500 for inbox
    const project = projects.find(p => p.id === task.project_id);
    return project?.color || '#6b7280';
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-md"></div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredRecommendedTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {searchQuery.trim() ? 'No Matching Recommended Tasks' : 'No Recommended Tasks'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {searchQuery.trim() 
            ? 'No recommended tasks match your search criteria.'
            : 'Add impact, urgency ratings, or due dates to your tasks to see personalized recommendations here.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Recommended Tasks</h2>
          <span className="text-sm text-muted-foreground">
            ({filteredRecommendedTasks.length} tasks)
          </span>
        </div>
        {onAutoplanTasks ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAutoplanTasks(filteredRecommendedTasks)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {t("tasks.autoplanTasks")}
          </Button>
        ) : null}
      </div>
      
      <div className="text-sm text-muted-foreground mb-4">
        Tasks ranked by impact, urgency, and due dates. Focus on these for maximum impact.
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredRecommendedTasks.map((task: CanDoItemDecrypted & { originalIndex?: number }, index: number) => {
          const score = calculateRecommendationScore(task, tasks);
          const reason = getRecommendationReason(task, tasks);
          const rankNumber = (task.originalIndex ?? index) + 1; // Use original index if available
          
          return (
            <div key={task.id} className="relative">
              {/* Priority rank indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md" 
                   style={{ 
                     backgroundColor: score >= 25 ? '#ef4444' : 
                                    score >= 20 ? '#f97316' : 
                                    score >= 15 ? '#eab308' : '#6b7280' 
                   }} />
              
              {/* Task item with custom styling */}
              <div className="ml-2 relative">
                {/* Rank badge */}
                <div className="absolute -top-1 -left-1 z-10">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    rankNumber === 1 ? "bg-amber-500 text-white" :
                    rankNumber === 2 ? "bg-gray-400 text-white" :
                    rankNumber === 3 ? "bg-amber-600 text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {rankNumber}
                  </div>
                </div>
                
                {/* Task content */}
                <div className="pl-4">
                  <TaskListItem
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                    onToggleMyDay={onToggleMyDay}
                    onScheduleTask={onScheduleTask}
                    isScheduled={isTaskScheduled ? isTaskScheduled(task.id) : false}
                    projects={projects}
                    tasks={tasks}
                    calendarEvents={calendarEvents}
                    onNavigateToEvent={onNavigateToEvent}
                    onDeleteEvent={onDeleteEvent}
                  />
                  
                  {/* Additional info for recommended view */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getProjectColor(task) }}
                      />
                      <span>{getProjectName(task)}</span>
                    </div>
                    <span>•</span>
                    <span>Score: {score}</span>
                    <span>•</span>
                    <span>{reason}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredRecommendedTasks.length === 20 && (
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Showing top 20 recommendations
          </p>
        </div>
      )}
    </div>
  );
} 
