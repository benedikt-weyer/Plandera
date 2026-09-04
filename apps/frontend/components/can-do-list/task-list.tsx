'use client';

import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import TaskListItem from './task-list-item';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDroppable } from '@/lib/flexyDND';
import type { DragData, DragPosition } from '@/lib/flexyDND';

// Helper to organize tasks hierarchically
interface TaskWithDepth extends CanDoItemDecrypted {
  depth: number;
}

function organizeTasksHierarchically(tasks: CanDoItemDecrypted[], showCompleted: boolean = false): TaskWithDepth[] {
  const result: TaskWithDepth[] = [];
  
  const addTaskAndChildren = (taskId: string | undefined, depth: number, processed: Set<string>, parentCompleted: boolean = false) => {
    // Find children of this task and sort by display_order
    const children = tasks
      .filter(t => t.parent_task_id === taskId)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    children.forEach(task => {
      // Prevent infinite loops
      if (processed.has(task.id)) return;
      processed.add(task.id);
      
      // Show subtasks if:
      // 1. Parent is not completed (so we can see completed subtasks under active parent)
      // 2. OR the subtask itself is not completed
      // 3. OR we're showing all completed tasks
      const shouldShow = !parentCompleted || !task.completed || showCompleted;
      
      if (shouldShow) {
        // Add the task with its depth
        result.push({ ...task, depth });
        
        // Recursively add its children (max depth is 3, so max nesting is 2)
        if (depth < 2) {
          addTaskAndChildren(task.id, depth + 1, processed, task.completed);
        }
      }
    });
  };
  
  // Start with root level tasks (no parent)
  addTaskAndChildren(undefined, 0, new Set(), false);
  
  return result;
}

// Droppable task item wrapper component
interface DroppableTaskItemProps {
  task: TaskWithDepth;
  index: number;
  hierarchicalTasks: TaskWithDepth[];
  allTasks: CanDoItemDecrypted[];
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean, parentTaskId?: string) => Promise<void>;
  onToggleMyDay?: (id: string) => Promise<void>;
  onScheduleTask?: (taskId: string) => Promise<void>;
  isScheduled: boolean;
  projects: ProjectDecrypted[];
  showProjectName: boolean;
  calendarEvents?: any[];
  onNavigateToEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onReorderTasks?: (sourceIndex: number, destinationIndex: number, projectId?: string) => Promise<boolean>;
  currentProjectId?: string;
}

function DroppableTaskItem({
  task,
  index,
  hierarchicalTasks,
  allTasks,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
  onToggleMyDay,
  onScheduleTask,
  isScheduled,
  projects,
  showProjectName,
  calendarEvents,
  onNavigateToEvent,
  onDeleteEvent,
  onReorderTasks,
  currentProjectId,
}: DroppableTaskItemProps) {
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'subtask' | null>(null);

  const handleDrop = useCallback(async (dragData: DragData, position: DragPosition) => {
    if (dragData.type !== 'task') return;
    
    const draggedTaskId = dragData.data.taskId;
    const draggedTask = dragData.data.task;
    
    // Don't drop on itself
    if (draggedTaskId === task.id) {
      setDropPosition(null);
      return;
    }

    // Determine drop position based on mouse Y relative to element
    const element = dropZoneRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const relativeY = position.y - rect.top;
    const height = rect.height;
    
    // Check if dropping in the center zone (middle 40% for subtask creation)
    const centerZoneStart = height * 0.3;
    const centerZoneEnd = height * 0.7;
    const isInCenterZone = relativeY >= centerZoneStart && relativeY <= centerZoneEnd;
    
    if (isInCenterZone && task.depth < 2) {
      // Make it a subtask
      console.log('Making subtask:', draggedTaskId, 'of', task.id);
      await onUpdateTask(
        draggedTaskId,
        draggedTask.content,
        draggedTask.duration_minutes,
        draggedTask.project_id,
        draggedTask.impact,
        draggedTask.urgency,
        draggedTask.due_date ? new Date(draggedTask.due_date) : undefined,
        draggedTask.blocked_by,
        draggedTask.my_day,
        task.id // Set as parent
      );
    } else {
      // Reorder - move task to be a sibling of target task
      const isAbove = relativeY < centerZoneStart;
      const targetParentId = task.parent_task_id;
      
      console.log('Reordering task:', {
        draggedTaskId,
        draggedTaskParent: draggedTask.parent_task_id,
        targetTaskId: task.id,
        targetParentId,
        isAbove,
      });
      
      // If changing parent level, update that first
      if (draggedTask.parent_task_id !== targetParentId) {
        console.log('Changing parent from', draggedTask.parent_task_id, 'to', targetParentId);
        await onUpdateTask(
          draggedTaskId,
          draggedTask.content,
          draggedTask.duration_minutes,
          draggedTask.project_id,
          draggedTask.impact,
          draggedTask.urgency,
          draggedTask.due_date ? new Date(draggedTask.due_date) : undefined,
          draggedTask.blocked_by,
          draggedTask.my_day,
          targetParentId
        );
      }
      
      // Use onReorderTasks to position it correctly
      if (onReorderTasks) {
        // IMPORTANT: onReorderTasks filters by project OR all non-completed tasks
        // Match the service filter exactly:
        // const tasks = projectId 
        //   ? allTasks.filter(task => task.project_id === projectId && !task.completed)
        //   : allTasks.filter(task => !task.completed);
        
        const filteredTasks = currentProjectId 
          ? allTasks.filter(t => t.project_id === currentProjectId && !t.completed)
          : allTasks.filter(t => !t.completed);
        
        const sourceIndex = filteredTasks.findIndex(t => t.id === draggedTaskId);
        const targetIndex = filteredTasks.findIndex(t => t.id === task.id);
        
        if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
          let destinationIndex = isAbove ? targetIndex : targetIndex + 1;
          
          // Adjust destination if source is before target
          if (sourceIndex < destinationIndex) {
            destinationIndex--;
          }
          
          await onReorderTasks(sourceIndex, destinationIndex, currentProjectId);
        }
      }
    }
    
    setDropPosition(null);
  }, [task, index, onUpdateTask, onReorderTasks, currentProjectId]);

  const handleDragOver = useCallback((dragData: DragData, position: DragPosition) => {
    if (dragData.type !== 'task' || dragData.data.taskId === task.id) {
      setDropPosition(null);
      return;
    }

    const element = dropZoneRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const relativeY = position.y - rect.top;
    const height = rect.height;
    
    // Define zones: top 30%, center 40%, bottom 30%
    const centerZoneStart = height * 0.3;
    const centerZoneEnd = height * 0.7;
    const isInCenterZone = relativeY >= centerZoneStart && relativeY <= centerZoneEnd;
    
    if (isInCenterZone && task.depth < 2) {
      setDropPosition('subtask');
    } else {
      const isAbove = relativeY < centerZoneStart;
      setDropPosition(isAbove ? 'above' : 'below');
    }
  }, [task]);

  const handleDragLeave = useCallback(() => {
    setDropPosition(null);
  }, []);

  const { dropRef } = useDroppable({
    id: `task-drop-${task.id}`,
    accept: 'task',
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
  });

  return (
    <div
      ref={(el) => {
        dropZoneRef.current = el;
        (dropRef as any).current = el;
      }}
      className="relative"
    >
      {/* Drop indicator above */}
      {dropPosition === 'above' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}
      
      {/* Drop indicator for subtask (center highlight) */}
      {dropPosition === 'subtask' && (
        <div className="absolute inset-0 bg-green-500/20 border-2 border-green-500 rounded z-10 pointer-events-none" />
      )}
      
      <TaskListItem
        task={task}
        onToggleComplete={onToggleComplete}
        onDeleteTask={onDeleteTask}
        onUpdateTask={onUpdateTask}
        onToggleMyDay={onToggleMyDay}
        onScheduleTask={onScheduleTask}
        isScheduled={isScheduled}
        projects={projects}
        tasks={allTasks}
        showProjectName={showProjectName}
        calendarEvents={calendarEvents}
        onNavigateToEvent={onNavigateToEvent}
        onDeleteEvent={onDeleteEvent}
      />
      
      {/* Drop indicator below */}
      {dropPosition === 'below' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
      )}
    </div>
  );
}

interface TaskListProps {
  tasks: CanDoItemDecrypted[];
  allTasks?: CanDoItemDecrypted[]; // All tasks for blocking relationships
  isLoading?: boolean;
  searchQuery?: string;
  selectedProjectId?: string | null;
  showProjectName?: boolean;
  showCompleted?: boolean;
  projects?: ProjectDecrypted[];
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean, parentTaskId?: string) => Promise<void>;
  onToggleMyDay?: (id: string) => Promise<void>;
  onScheduleTask?: (taskId: string) => Promise<void>;
  isTaskScheduled?: (taskId: string) => boolean;
  onReorderTasks?: (sourceIndex: number, destinationIndex: number, projectId?: string) => Promise<boolean>;
  currentProjectId?: string;
  calendarEvents?: any[];
  onNavigateToEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
}

export default function TaskList({ 
  tasks, 
  allTasks,
  isLoading, 
  onToggleComplete, 
  onDeleteTask, 
  onUpdateTask, 
  onToggleMyDay,
  onScheduleTask,
  isTaskScheduled,
  onReorderTasks,
  projects = [],
  currentProjectId,
  showProjectName = false,
  showCompleted = false,
  calendarEvents,
  onNavigateToEvent,
  onDeleteEvent
}: TaskListProps) {
  // Organize tasks hierarchically with depth information
  const hierarchicalTasks = useMemo(() => {
    return organizeTasksHierarchically(tasks, showCompleted);
  }, [tasks, showCompleted]);

  if (isLoading || hierarchicalTasks.length === 0) return null;

  return (
    <ul className="space-y-2">
      {hierarchicalTasks.map((task, index) => {
        // Calculate left margin for indentation (24px per level)
        const indentStyle = { marginLeft: `${task.depth * 24}px` };

        return (
          <li key={task.id} className="relative" style={indentStyle}>
            <DroppableTaskItem
              task={task}
              index={index}
              hierarchicalTasks={hierarchicalTasks}
              allTasks={allTasks ?? tasks}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
              onUpdateTask={onUpdateTask}
              onToggleMyDay={onToggleMyDay}
              onScheduleTask={onScheduleTask}
              isScheduled={isTaskScheduled ? isTaskScheduled(task.id) : false}
              projects={projects}
              showProjectName={showProjectName}
              calendarEvents={calendarEvents}
              onNavigateToEvent={onNavigateToEvent}
              onDeleteEvent={onDeleteEvent}
              onReorderTasks={onReorderTasks}
              currentProjectId={currentProjectId}
            />
          </li>
        );
      })}
    </ul>
  );
}
