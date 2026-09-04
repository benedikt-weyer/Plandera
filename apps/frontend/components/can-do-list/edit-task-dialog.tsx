'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import { DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronsUpDown, Link2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';
import { parseDurationInput, formatDurationInput } from '@/utils/can-do-list/duration-input-parser';
import { DatePicker } from '@/components/ui/date-picker';
import { useTranslation } from '@/utils/context/LanguageContext';

// Helper to build hierarchical project list
interface HierarchicalProject {
  id: string;
  name: string;
  color: string;
  level: number;
  parentId?: string;
}

function buildHierarchicalProjectList(projects: ProjectDecrypted[]): HierarchicalProject[] {
  const result: HierarchicalProject[] = [];
  
  const addProjectAndChildren = (parentId: string | undefined, level: number) => {
    const children = projects
      .filter(p => (p.parent_id ?? undefined) === parentId)
      .sort((a, b) => a.order - b.order);
    
    children.forEach(project => {
      result.push({
        id: project.id,
        name: project.name,
        color: project.color || '#6b7280',
        level,
        parentId: project.parent_id ?? undefined
      });
      
      // Recursively add children
      addProjectAndChildren(project.id, level + 1);
    });
  };
  
  // Start with root level projects (no parent)
  addProjectAndChildren(undefined, 0);
  
  return result;
}

// Predefined duration options in minutes
const PREDEFINED_DURATIONS = [
  { label: '5m', value: 5 },
  { label: '10m', value: 10 },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
] as const;

// Define schema for edit task validation
const editTaskSchema = z.object({
  content: z.string().min(1, { message: "Task content is required" }),
  estimatedDuration: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true;
      const parsed = parseDurationInput(val);
      return parsed.isValid;
    }, { message: 'Invalid format. Use formats like: 2h, 2h30, 2h40m, 40m, or 120' }),
  projectId: z.string().optional(),
  impact: z.number().int().min(0).max(10).optional(),
  urgency: z.number().int().min(0).max(10).optional(),
  dueDate: z.string().optional(),
  blockedBy: z.string().optional(),
  myDay: z.boolean().optional(),
  parentTaskId: z.string().optional()
});

type EditTaskFormValues = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
  readonly task: CanDoItemDecrypted | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean, parentTaskId?: string) => Promise<void>;
  readonly isLoading?: boolean;
  readonly projects?: ProjectDecrypted[];
  readonly tasks?: CanDoItemDecrypted[];
  readonly linkedEventTitle?: string | null;
  readonly onNavigateToEvent?: () => void;
  readonly onDeleteLinkedEvent?: () => Promise<void>;
}

export default function EditTaskDialog({ 
  task, 
  isOpen, 
  onClose, 
  onSave, 
  isLoading = false,
  projects = [],
  tasks = [],
  linkedEventTitle,
  onNavigateToEvent,
  onDeleteLinkedEvent
}: EditTaskDialogProps) {
  const { t } = useTranslation();
  const [blockedByOpen, setBlockedByOpen] = useState(false);
  const [parentTaskOpen, setParentTaskOpen] = useState(false);
  
  // Helper function to calculate nesting depth
  const getTaskNestingDepth = (taskId: string, tasks: CanDoItemDecrypted[]): number => {
    const findTask = tasks.find(t => t.id === taskId);
    if (!findTask || !findTask.parent_task_id) return 0;
    return 1 + getTaskNestingDepth(findTask.parent_task_id, tasks);
  };
  
  // Helper function to check if a task is a descendant of another task
  const isDescendant = (potentialDescendant: string, ancestor: string, tasks: CanDoItemDecrypted[]): boolean => {
    const findTask = tasks.find(t => t.id === potentialDescendant);
    if (!findTask || !findTask.parent_task_id) return false;
    if (findTask.parent_task_id === ancestor) return true;
    return isDescendant(findTask.parent_task_id, ancestor, tasks);
  };
  
  // Calculate current task's depth
  const currentTaskDepth = task ? getTaskNestingDepth(task.id, tasks) : 0;
  
  // Filter tasks that can be selected as parent (max nesting level is 3, so max depth is 2)
  const availableParentTasks = tasks.filter(t => {
    if (!task) return false;
    // Can't select self as parent
    if (t.id === task.id) return false;
    // Can't select completed tasks as parent
    if (t.completed) return false;
    // Can't select a descendant as parent (would create circular dependency)
    if (isDescendant(t.id, task.id, tasks)) return false;
    // Can't select a task that's already at depth 2 (would make this task depth 3, which is max)
    if (getTaskNestingDepth(t.id, tasks) >= 2) return false;
    return true;
  });
  
  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      content: '',
      estimatedDuration: '',
      blockedBy: '',
      myDay: false,
      parentTaskId: ''
    }
  });

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isOpen) {
      form.reset({
        content: task.content || '',
        estimatedDuration: formatDurationInput(task.duration_minutes),
        projectId: task.project_id ?? '',
        impact: task.impact ?? 0,
        urgency: task.urgency ?? 0,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
        blockedBy: task.blocked_by ?? '',
        myDay: task.my_day ?? false,
        parentTaskId: task.parent_task_id ?? ''
      });
    }
  }, [task, isOpen, form]);

  const onSubmit = async (values: EditTaskFormValues) => {
    if (!task) return;
    const duration = values.estimatedDuration ? parseDurationInput(values.estimatedDuration).minutes || undefined : undefined;
    const impact = values.impact;
    const urgency = values.urgency;
    const dueDate = values.dueDate ? new Date(values.dueDate + 'T00:00:00.000Z') : undefined;
    const blockedBy = values.blockedBy || undefined;
    const projectId = values.projectId || undefined; // Convert empty string to undefined
    const parentTaskId = values.parentTaskId || undefined; // Convert empty string to undefined
    
    // Safely handle content comparison with null/undefined checks
    const currentContent = (values.content || '').trim();
    const originalContent = (task.content || '').trim();
    
    if (
      currentContent === originalContent &&
      duration === task.duration_minutes &&
      projectId === task.project_id &&
      impact === task.impact &&
      urgency === task.urgency &&
      dueDate?.getTime() === (task.due_date ? new Date(task.due_date).getTime() : undefined) &&
      blockedBy === task.blocked_by &&
      values.myDay === task.my_day &&
      parentTaskId === task.parent_task_id
    ) {
      onClose();
      return;
    }
    await onSave(task.id, currentContent, duration, projectId, impact, urgency, dueDate, blockedBy, values.myDay, parentTaskId);
    onClose();
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      e.preventDefault();
      onClose();
    }
  };

  // Build hierarchical project list
  const hierarchicalProjects = buildHierarchicalProjectList(projects);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} modal={false}>
      <DialogContent className="sm:max-w-[425px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your can-do task here. Click save when you're done.
          </DialogDescription>
          {linkedEventTitle && (onNavigateToEvent || onDeleteLinkedEvent) ? (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-blue-900 dark:text-blue-100 font-medium flex-shrink-0">Linked Event:</span>
                  {onNavigateToEvent && (
                    <button
                      type="button"
                      onClick={onNavigateToEvent}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium truncate"
                    >
                      {linkedEventTitle}
                    </button>
                  )}
                  {!onNavigateToEvent && (
                    <span className="text-sm text-blue-900 dark:text-blue-100 truncate">{linkedEventTitle}</span>
                  )}
                </div>
                {onDeleteLinkedEvent && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteLinkedEvent}
                    className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
                    title="Delete linked event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Input
              id="content"
              autoFocus
              disabled={isLoading}
              {...form.register('content')}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-destructive">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedDuration">Estimated Duration</Label>
            <div className="space-y-3">
              {/* Predefined duration buttons */}
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_DURATIONS.map((duration) => (
                  <Button
                    key={duration.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => form.setValue('estimatedDuration', formatDurationInput(duration.value))}
                    className="text-xs"
                  >
                    {duration.label}
                  </Button>
                ))}
              </div>
              {/* Custom duration input */}
              <Input
                id="estimatedDuration"
                type="text"
                placeholder="e.g. 2h, 2h30, 2h40m, 40m, or 120"
                disabled={isLoading}
                {...form.register('estimatedDuration')}
              />
            </div>
            {form.formState.errors.estimatedDuration && (
              <p className="text-sm text-destructive">
                {form.formState.errors.estimatedDuration.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select 
              value={form.watch('projectId') ?? '__inbox__'} 
              onValueChange={(value) => form.setValue('projectId', value === '__inbox__' ? undefined : value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__inbox__">
                  <div className="flex items-center gap-2">
                    <span>{DEFAULT_PROJECT_NAME}</span>
                  </div>
                </SelectItem>
                {hierarchicalProjects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${project.level * 16}px` }}>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <DatePicker
              value={form.watch('dueDate')}
              onChange={(value) => form.setValue('dueDate', value)}
              disabled={isLoading}
              placeholder="Pick a due date"
            />
            {form.formState.errors.dueDate && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dueDate.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="blockedBy">Blocked By</Label>
            <Popover open={blockedByOpen} onOpenChange={setBlockedByOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={blockedByOpen}
                  className="w-full justify-between"
                  disabled={isLoading}
                >
                  {form.watch('blockedBy') ? 
                    tasks.find(t => t.id === form.watch('blockedBy'))?.content || 'Select a blocking task...' :
                    'Select a blocking task...'
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Search tasks..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No tasks found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="not blocked"
                        onSelect={() => {
                          form.setValue('blockedBy', undefined);
                          setBlockedByOpen(false);
                        }}
                      >
                        Not blocked
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            !form.watch('blockedBy') ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                      {tasks
                        .filter(t => t.id !== task?.id && !t.completed) // Don't show current task or completed tasks
                        .sort((a, b) => a.content.localeCompare(b.content))
                        .map(blockingTask => (
                          <CommandItem
                            key={blockingTask.id}
                            value={blockingTask.content}
                            onSelect={() => {
                              form.setValue('blockedBy', blockingTask.id);
                              setBlockedByOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-64">{blockingTask.content}</span>
                              {blockingTask.project_id && (
                                <span className="text-xs text-muted-foreground">
                                  ({projects.find(p => p.id === blockingTask.project_id)?.name || 'Unknown'})
                                </span>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                form.watch('blockedBy') === blockingTask.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))
                      }
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.formState.errors.blockedBy && (
              <p className="text-sm text-destructive">
                {form.formState.errors.blockedBy.message}
              </p>
            )}
          </div>

          {/* Parent Task Section */}
          <div className="space-y-2">
            <Label htmlFor="parentTask">{t('tasks.parentTask')}</Label>
            <Popover open={parentTaskOpen} onOpenChange={setParentTaskOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={parentTaskOpen}
                  className="w-full justify-between"
                  disabled={isLoading}
                >
                  {form.watch('parentTaskId') ? 
                    tasks.find(t => t.id === form.watch('parentTaskId'))?.content || t('tasks.selectParentTask') :
                    t('tasks.selectParentTask')
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Search tasks..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No tasks found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="no parent"
                        onSelect={() => {
                          form.setValue('parentTaskId', '');
                          setParentTaskOpen(false);
                        }}
                      >
                        {t('tasks.noParentTask')}
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            !form.watch('parentTaskId') ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                      {availableParentTasks
                        .sort((a, b) => a.content.localeCompare(b.content))
                        .map(parentTask => (
                          <CommandItem
                            key={parentTask.id}
                            value={parentTask.content}
                            onSelect={() => {
                              form.setValue('parentTaskId', parentTask.id);
                              setParentTaskOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-64">{parentTask.content}</span>
                              {parentTask.project_id && (
                                <span className="text-xs text-muted-foreground">
                                  ({projects.find(p => p.id === parentTask.project_id)?.name || 'Unknown'})
                                </span>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                form.watch('parentTaskId') === parentTask.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))
                      }
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.formState.errors.parentTaskId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.parentTaskId.message}
              </p>
            )}
          </div>

          {/* My Day Section */}
          <div className="flex items-center space-x-2">
            <input
              id="myDay"
              type="checkbox"
              disabled={isLoading}
              {...form.register('myDay')}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <Label htmlFor="myDay" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Add to My Day
            </Label>
          </div>

          {/* Priority Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="impact">Impact (1-10)</Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="impact"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  disabled={isLoading}
                  {...form.register('impact', { valueAsNumber: true })}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {form.watch('impact') || 0}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency (1-10)</Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="urgency"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  disabled={isLoading}
                  {...form.register('urgency', { valueAsNumber: true })}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {form.watch('urgency') || 0}
                </span>
              </div>
            </div>
            
            {/* Show calculated priority */}
            {(() => {
              const impact = form.watch('impact') || 0;
              const urgency = form.watch('urgency') || 0;
              if (impact > 0 || urgency > 0) {
                let priority;
                // If both values are provided, take the average
                if (impact > 0 && urgency > 0) {
                  priority = Math.round((impact + urgency) / 2);
                } else {
                  // If only one value is provided, use that value directly
                  priority = impact > 0 ? impact : urgency;
                }
                return (
                  <div className="text-sm text-muted-foreground">
                    Combined Priority: <span className="font-medium">P{priority}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
