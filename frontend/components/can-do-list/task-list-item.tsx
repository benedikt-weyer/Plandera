"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CanDoItemDecrypted, ProjectDecrypted } from "@/utils/api/types";
import { useState, useEffect, useRef } from "react";
import {
  Edit,
  Trash2,
  Clock,
  Zap,
  Calendar,
  Copy,
  Shield,
  AlertCircle,
  Lock,
  Sun,
  CheckCircle,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import EditTaskDialog from "./edit-task-dialog";
import BlockedTaskCompletionModal from "./blocked-task-completion-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  calculatePriority,
  getUrgencyColorClass,
  getPriorityDisplayText,
} from "@/utils/can-do-list/priority-utils";
import {
  formatDueDate,
  getDueDateColorClass,
} from "@/utils/can-do-list/due-date-utils";
import {
  isTaskActuallyBlocked,
  isTaskUnblocked,
} from "@/utils/can-do-list/task-blocking-utils";
import {
  useSettingsStore,
  useTaskClickBehavior,
} from "@/stores/settings-store";
import { useTranslation, useDateLocale } from "@/utils/context/LanguageContext";
import { useDraggable } from "@/lib/flexyDND";
import { useSwipeable } from "@/lib/easySwipe";
import { useTaskNavigation } from "@/stores/task-navigation-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DurationPresetPicker } from "./duration-preset-picker";

interface TaskListItemProps {
  readonly task: CanDoItemDecrypted;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (
    id: string,
    content: string,
    estimatedDuration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean,
    parentTaskId?: string,
  ) => Promise<void>;
  readonly onToggleMyDay?: (id: string) => Promise<void>;
  readonly onScheduleTask?: (taskId: string) => Promise<void>;
  readonly isScheduled?: boolean;
  readonly projects?: ProjectDecrypted[];
  readonly tasks?: CanDoItemDecrypted[];
  readonly showProjectName?: boolean;
  readonly calendarEvents?: any[];
  readonly onNavigateToEvent?: (eventId: string) => void;
  readonly onDeleteEvent?: (eventId: string) => Promise<void>;
}

export default function TaskListItem({
  task,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
  onToggleMyDay,
  onScheduleTask,
  isScheduled = false,
  projects = [],
  tasks = [],
  showProjectName = false,
  calendarEvents = [],
  onNavigateToEvent,
  onDeleteEvent,
}: TaskListItemProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const taskRef = useRef<HTMLDivElement>(null);

  // Get navigation state from store
  const {
    navigateToTaskId,
    highlightedTaskId,
    setHighlightedTask,
    clearTaskNavigation,
  } = useTaskNavigation();

  // Get user settings for task click behavior
  const taskClickBehavior = useTaskClickBehavior();

  // FlexyDND for dragging tasks
  const { dragRef, isDraggable } = useDraggable({
    id: `task-${task.id}`,
    type: "task",
    data: {
      taskId: task.id,
      taskContent: task.content,
      durationMinutes: task.duration_minutes || 60,
      task: task,
    },
    disabled: task.completed,
  });

  // EasySwipe for mobile swipe gestures
  const { ref: swipeRef, swipeOffset = 0 } = useSwipeable(
    {
      onSwipeRight: () => {
        // Swipe right to complete
        if (!task.completed) {
          handleToggleCompleteClick();
        }
      },
      onSwipeLeft: () => {
        // Swipe left to delete
        onDeleteTask(task.id);
      },
    },
    {
      threshold: 80,
      direction: "horizontal",
      lockAfterFirstDirection: true, // Lock to left or right after first swipe direction is determined
      trackSwipeOffset: true, // Track swipe offset for visual feedback
    },
  );

  const clampedOffset = Math.max(-100, Math.min(100, swipeOffset));
  const swipeThreshold = 80; // Must match the threshold in useSwipeable config
  const willTriggerAction = Math.abs(swipeOffset) >= swipeThreshold;

  // Handle navigation to this task
  useEffect(() => {
    if (navigateToTaskId === task.id && taskRef.current) {
      // Scroll to the task
      taskRef.current.scrollIntoView({ behavior: "smooth", block: "center" });

      // Clear navigation state after scrolling
      // The highlight will remain for the animation duration
      clearTaskNavigation();
    }
  }, [navigateToTaskId, task.id, clearTaskNavigation]);

  // Handle highlighting animation
  useEffect(() => {
    if (highlightedTaskId === task.id) {
      // Remove highlight after 2 seconds
      const timer = setTimeout(() => {
        setHighlightedTask(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [highlightedTaskId, task.id, setHighlightedTask]);

  // Format duration for display
  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleSave = async (
    id: string,
    content: string,
    estimatedDuration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean,
    parentTaskId?: string,
  ) => {
    setIsUpdating(true);
    try {
      await onUpdateTask(
        id,
        content,
        estimatedDuration,
        projectId,
        impact,
        urgency,
        dueDate,
        blockedBy,
        myDay,
        parentTaskId,
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickDurationUpdate = async (duration?: number) => {
    setIsUpdating(true);
    try {
      await onUpdateTask(
        task.id,
        task.content,
        duration,
        task.project_id ?? undefined,
        task.impact ?? undefined,
        task.urgency ?? undefined,
        task.due_date ? new Date(task.due_date) : undefined,
        task.blocked_by ?? undefined,
        task.my_day ?? undefined,
        task.parent_task_id ?? undefined,
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseDialog = () => {
    setIsEditDialogOpen(false);
  };

  const handleCompleteTaskChain = async (taskIds: string[]) => {
    try {
      // Complete all tasks in the chain
      for (const taskId of taskIds) {
        await onToggleComplete(taskId, true);
      }
      toast.success(
        `Completed ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      console.error("Error completing task chain:", error);
      toast.error("Failed to complete tasks");
    }
  };

  // Check if task is blocked and find the blocking task
  const isBlocked =
    task.blocked_by && !task.completed && isTaskActuallyBlocked(task, tasks);
  const isUnblocked =
    task.blocked_by && !task.completed && isTaskUnblocked(task, tasks);
  const blockingTask = task.blocked_by
    ? tasks.find((t) => t.id === task.blocked_by)
    : null;

  // Check if task is blocking other tasks and find the blocked tasks
  const blockedTasks = tasks.filter(
    (t) => t.blocked_by === task.id && !t.completed,
  );
  const isBlocking = blockedTasks.length > 0 && !task.completed;

  // Get project name if task has a project
  const projectName = task.project_id
    ? projects.find((p) => p.id === task.project_id)?.name
    : null;
  const projectColor = task.project_id
    ? projects.find((p) => p.id === task.project_id)?.color
    : null;

  const handleToggleCompleteClick = async () => {
    if (!task.completed) {
      // Check if task is blocked before completing
      if (isBlocked) {
        setIsBlockedModalOpen(true);
        return;
      }

      // If marking as complete, trigger animation first
      setIsAnimatingOut(true);
      // Wait for animation to complete, then actually toggle
      setTimeout(async () => {
        await onToggleComplete(task.id, !task.completed);
      }, 300); // Match animation duration
    } else {
      // If marking as incomplete, toggle immediately
      await onToggleComplete(task.id, !task.completed);
    }
  };

  const handleToggleCompleteKeyDown = async (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      await handleToggleCompleteClick();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(task.content);
      toast.success("Task content copied to clipboard");
    } catch (error) {
      console.error("Failed to copy task content:", error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = task.content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success("Task content copied to clipboard");
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
        toast.error("Failed to copy task content");
      }
      document.body.removeChild(textArea);
    }
  };

  // Find linked event for this task
  const linkedEvent = calendarEvents.find((event) => event.task_id === task.id);
  const linkedEventTitle = linkedEvent?.title || null;

  // Handle navigation to linked event
  const handleNavigateToEvent =
    linkedEvent && onNavigateToEvent
      ? () => {
          setIsEditDialogOpen(false);
          onNavigateToEvent(linkedEvent.id);
        }
      : undefined;

  // Handle deletion of linked event
  const handleDeleteLinkedEvent =
    linkedEvent && onDeleteEvent
      ? async () => {
          try {
            await onDeleteEvent(linkedEvent.id);
            toast.success("Linked event deleted");
          } catch (error) {
            console.error("Failed to delete linked event:", error);
            toast.error("Failed to delete linked event");
          }
        }
      : undefined;

  return (
    <>
      {/* Outer container for background indicators */}
      <div
        ref={(node) => {
          (dragRef as any).current = node;
          (swipeRef as any).current = node;
        }}
        className="relative overflow-hidden rounded-md"
      >
        {/* Background swipe indicators - fixed position, fill entire space */}
        {swipeOffset > 0 && (
          <div
            className={`absolute inset-y-0 left-0 flex items-center justify-start pl-4 rounded-l-md z-0 ${
              willTriggerAction ? "bg-green-600" : "bg-green-500/30"
            }`}
            style={{
              width: `${Math.abs(clampedOffset)}px`,
              transition: "background-color 0.15s ease-out",
            }}
          >
            <CheckCircle
              className={`text-white ${
                willTriggerAction ? "h-6 w-6" : "h-5 w-5"
              }`}
              strokeWidth={willTriggerAction ? 2.5 : 2}
              style={{ transition: "all 0.15s ease-out" }}
            />
          </div>
        )}
        {swipeOffset < 0 && (
          <div
            className={`absolute inset-y-0 right-0 flex items-center justify-end pr-4 rounded-r-md z-0 ${
              willTriggerAction ? "bg-red-600" : "bg-red-500/30"
            }`}
            style={{
              width: `${Math.abs(clampedOffset)}px`,
              transition: "background-color 0.15s ease-out",
            }}
          >
            <Trash2
              className={`text-white ${
                willTriggerAction ? "h-6 w-6" : "h-5 w-5"
              }`}
              strokeWidth={willTriggerAction ? 2.5 : 2}
              style={{ transition: "all 0.15s ease-out" }}
            />
          </div>
        )}

        {/* Inner container - this moves with swipe */}
        <div
          ref={taskRef}
          data-task-id={task.id}
          data-swipe-offset={clampedOffset}
          className={`flex border ${
            isDraggable
              ? "cursor-grab active:cursor-grabbing"
              : "cursor-default"
          } ${
            task.completed
              ? "bg-muted"
              : isBlocked
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50"
                : isUnblocked
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50"
                  : "bg-background"
          } ${isAnimatingOut ? "task-fade-out" : "task-fade-in"} ${
            highlightedTaskId === task.id ? "task-highlight-flash" : ""
          }`}
          style={{
            position: "relative",
            left: `${clampedOffset}px`,
            transition: swipeOffset === 0 ? "left 0.2s ease-out" : "none",
            zIndex: 10,
          }}
        >
          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Task name row */}
            <div className="flex items-center space-x-3 p-3 md:p-3 py-4 md:py-3">
              {/* Checkbox with generous clickable area */}
              <div
                className="flex items-center justify-center cursor-pointer -ml-2 -my-2 py-2 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCompleteClick();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  handleToggleCompleteKeyDown(e);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Mark "${task.content}" as ${task.completed ? "incomplete" : "complete"}`}
              >
                <Checkbox
                  checked={task.completed}
                  id={`task-${task.id}`}
                  onCheckedChange={handleToggleCompleteClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <span
                className={`flex-1 min-w-0 ${taskClickBehavior === "edit" ? "cursor-pointer" : "cursor-default"} ${
                  task.completed ? "line-through text-muted-foreground" : ""
                }`}
                onClick={taskClickBehavior === "edit" ? handleEdit : undefined}
                onKeyDown={
                  taskClickBehavior === "edit"
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleEdit();
                        }
                      }
                    : undefined
                }
                role={taskClickBehavior === "edit" ? "button" : undefined}
                tabIndex={taskClickBehavior === "edit" ? 0 : undefined}
              >
                <span className="block line-clamp-2 md:truncate">
                  {task.content}
                </span>
              </span>
              {/* Show blocked indicator on the same line for mobile */}
              {isBlocked && (
                <div className="md:hidden flex items-center">
                  <Shield className="h-4 w-4 text-red-500 dark:text-red-400" />
                </div>
              )}
              {/* Show unblocked indicator on the same line for mobile */}
              {isUnblocked && (
                <div className="md:hidden flex items-center">
                  <Shield className="h-4 w-4 text-green-500 dark:text-green-400" />
                </div>
              )}
              {/* Show blocking indicator on the same line for mobile */}
              {isBlocking && (
                <div className="md:hidden flex items-center">
                  <Lock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </div>
              )}
            </div>

            {/* Badges row - only show on mobile when there are badges */}
            {(task.duration_minutes ||
              task.due_date ||
              isBlocked ||
              isUnblocked ||
              isBlocking ||
              (showProjectName && projectName)) && (
              <div className="md:hidden flex items-center space-x-1 pl-12 pr-3 pb-3">
                {isBlocked && (
                  <span className="text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 px-2 py-[2px] rounded-sm flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Blocked
                    {blockingTask
                      ? ` by "${blockingTask.content.substring(0, 20)}${blockingTask.content.length > 20 ? "..." : ""}"`
                      : ""}
                  </span>
                )}
                {isUnblocked && (
                  <span className="text-xs text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/50 px-2 py-[2px] rounded-sm flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Unblocked
                    {blockingTask
                      ? ` (was blocked by "${blockingTask.content.substring(0, 15)}${blockingTask.content.length > 15 ? "..." : ""}")`
                      : ""}
                  </span>
                )}
                {isBlocking && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 px-2 py-[2px] rounded-sm flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Blocking {blockedTasks.length} task
                          {blockedTasks.length === 1 ? "" : "s"}
                        </span>
                      </TooltipTrigger>
                      <TooltipPrimitive.Portal>
                        <TooltipContent
                          side="bottom"
                          className="max-w-xs !bg-white dark:!bg-slate-950 border"
                          style={{ zIndex: 999999 }}
                        >
                          <div className="space-y-1">
                            <div className="font-medium">Blocked tasks:</div>
                            {blockedTasks.map((blockedTask) => (
                              <div key={blockedTask.id} className="text-sm">
                                • {blockedTask.content}
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </TooltipPrimitive.Portal>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {showProjectName && projectName && (
                  <span
                    className="text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 border"
                    style={{
                      borderColor: projectColor || "#6b7280",
                      color: projectColor || "#6b7280",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: projectColor || "#6b7280" }}
                    />
                    {projectName}
                  </span>
                )}
                {task.duration_minutes && (
                  <span className="text-xs text-background bg-muted-foreground px-2 py-[2px] rounded-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(task.duration_minutes)}
                  </span>
                )}
                {(() => {
                  // Use actual impact and urgency values from task
                  const priority = calculatePriority(task.impact, task.urgency);
                  const priorityText = getPriorityDisplayText(priority);
                  const urgencyForColor = task.urgency || task.impact || 0;

                  if (priorityText && priority) {
                    return (
                      <span
                        className={`text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getUrgencyColorClass(urgencyForColor)}`}
                      >
                        <Zap className="h-3 w-3" />
                        {priorityText}
                      </span>
                    );
                  }
                  return null;
                })()}
                {task.due_date && (
                  <span
                    className={`text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getDueDateColorClass(new Date(task.due_date))}`}
                  >
                    <Calendar className="h-3 w-3" />
                    {formatDueDate(new Date(task.due_date), t, dateLocale)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons - vertically centered */}
          <div className="flex items-center space-x-1 pr-2 self-center">
            {/* Mobile: 3-dot menu */}
            <div className="md:hidden flex items-center gap-1">
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <DurationPresetPicker
                  disabled={isUpdating}
                  selectedDuration={task.duration_minutes ?? undefined}
                  onSelectDuration={(minutes) =>
                    handleQuickDurationUpdate(minutes)
                  }
                  onClearDuration={() => handleQuickDurationUpdate(undefined)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 text-muted-foreground hover:text-foreground"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {onScheduleTask && !isScheduled && (
                    <DropdownMenuItem onClick={() => onScheduleTask(task.id)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule to calendar
                    </DropdownMenuItem>
                  )}
                  {isScheduled && (
                    <DropdownMenuItem disabled className="text-green-600">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Task is scheduled
                    </DropdownMenuItem>
                  )}
                  {onToggleMyDay && (
                    <DropdownMenuItem onClick={() => onToggleMyDay(task.id)}>
                      <Sun
                        className={`h-4 w-4 mr-2 ${task.my_day ? "text-amber-500" : ""}`}
                      />
                      {task.my_day ? "Remove from My Day" : "Add to My Day"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy task content
                  </DropdownMenuItem>
                  {taskClickBehavior === "complete" && (
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onDeleteTask(task.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop: All buttons visible */}
            <div className="hidden md:flex items-center space-x-1">
              {isBlocked && (
                <span className="ml-2 text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 px-2 py-[2px] rounded-sm flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Blocked
                  {blockingTask
                    ? ` by "${blockingTask.content.substring(0, 15)}${blockingTask.content.length > 15 ? "..." : ""}"`
                    : ""}
                </span>
              )}
              {isUnblocked && (
                <span className="ml-2 text-xs text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/50 px-2 py-[2px] rounded-sm flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Unblocked
                  {blockingTask
                    ? ` (was blocked by "${blockingTask.content.substring(0, 12)}${blockingTask.content.length > 12 ? "..." : ""}")`
                    : ""}
                </span>
              )}
              {isBlocking && (
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="ml-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 px-2 py-[2px] rounded-sm flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Blocks {blockedTasks.length} task
                        {blockedTasks.length === 1 ? "" : "s"}
                      </span>
                    </TooltipTrigger>
                    <TooltipPrimitive.Portal>
                      <TooltipContent
                        side="bottom"
                        className="max-w-xs !bg-white dark:!bg-slate-950 border"
                        style={{ zIndex: 999999 }}
                      >
                        <div className="space-y-1">
                          <div className="font-medium">Blocked tasks:</div>
                          {blockedTasks.map((blockedTask) => (
                            <div key={blockedTask.id} className="text-sm">
                              • {blockedTask.content}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </TooltipPrimitive.Portal>
                  </Tooltip>
                </TooltipProvider>
              )}
              {showProjectName && projectName && (
                <span
                  className="ml-2 text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 border"
                  style={{
                    borderColor: projectColor || "#6b7280",
                    color: projectColor || "#6b7280",
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: projectColor || "#6b7280" }}
                  />
                  {projectName}
                </span>
              )}
              {task.duration_minutes && (
                <span className="ml-2 text-xs text-background bg-muted-foreground px-2 py-[2px] rounded-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(task.duration_minutes)}
                </span>
              )}
              {(() => {
                // Use actual impact and urgency values from task
                const priority = calculatePriority(task.impact, task.urgency);
                const priorityText = getPriorityDisplayText(priority);
                const urgencyForColor = task.urgency || task.impact || 0;

                if (priorityText && priority) {
                  return (
                    <span
                      className={`ml-2 text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getUrgencyColorClass(urgencyForColor)}`}
                    >
                      <Zap className="h-3 w-3" />
                      {priorityText}
                    </span>
                  );
                }
                return null;
              })()}
              {task.due_date && (
                <span
                  className={`ml-2 text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getDueDateColorClass(new Date(task.due_date))}`}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDueDate(new Date(task.due_date), t, dateLocale)}
                </span>
              )}
            </div>

            {/* Desktop: Action buttons */}
            <div className="hidden md:flex items-center space-x-1">
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <DurationPresetPicker
                  disabled={isUpdating}
                  selectedDuration={task.duration_minutes ?? undefined}
                  onSelectDuration={(minutes) =>
                    handleQuickDurationUpdate(minutes)
                  }
                  onClearDuration={() => handleQuickDurationUpdate(undefined)}
                />
              </div>
              {onScheduleTask && !isScheduled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScheduleTask(task.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground p-2"
                  title="Schedule to next free slot"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="sr-only">Schedule to calendar</span>
                </Button>
              )}
              {isScheduled && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-green-600 p-2 cursor-default opacity-100"
                  title="Task is scheduled"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="sr-only">Task is scheduled</span>
                </Button>
              )}
              {onToggleMyDay && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleMyDay(task.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`p-2 ${task.my_day ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground"}`}
                  title={task.my_day ? "Remove from My Day" : "Add to My Day"}
                >
                  <Sun className="h-4 w-4" />
                  <span className="sr-only">
                    {task.my_day ? "Remove from My Day" : "Add to My Day"}
                  </span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy task content</span>
              </Button>
              {/* Only show edit button when task click behavior is set to complete */}
              {taskClickBehavior === "complete" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground p-2"
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteTask(task.id)}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-destructive hover:text-destructive/80 p-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <EditTaskDialog
        task={task}
        isOpen={isEditDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        isLoading={isUpdating}
        projects={projects}
        tasks={tasks}
        linkedEventTitle={linkedEventTitle}
        onNavigateToEvent={handleNavigateToEvent}
        onDeleteLinkedEvent={handleDeleteLinkedEvent}
      />

      <BlockedTaskCompletionModal
        isOpen={isBlockedModalOpen}
        onClose={() => setIsBlockedModalOpen(false)}
        task={task}
        allTasks={tasks}
        projects={projects}
        onCompleteChain={handleCompleteTaskChain}
      />
    </>
  );
}
