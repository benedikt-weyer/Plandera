'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CanDoListPageService } from './scheduler-task-service';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';
import { SchedulerPageService } from './scheduler-page-service';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { AuthGuard } from '@/components/auth/auth-guard';
import { CanDoItemDecrypted, ProjectDecrypted, RealtimeSubscription, RealtimeMessage } from '@/utils/api/types';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { CalendarMain } from '@/components/calendar/calendar-main';
import CanDoListMain from '@/components/can-do-list/can-do-list-main';
import { LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { cn } from '@/lib/shadcn-utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';
import { useSchedulerNav } from '@/contexts/scheduler-nav-context';
import { useTranslation } from '@/utils/context/LanguageContext';
import { FlexyDNDProvider } from '@/lib/flexyDND';
import { TaskDragPreview } from '@/components/calendar/TaskDragPreview';
import { useTaskNavigation } from '@/stores/task-navigation-store';
import { useCalendar } from '@/stores/calendar-store';
import { useWeekStartDay } from '@/stores/settings-store';


function SchedulerPageContent() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { setError } = useError();
  const { setSchedulerNavContent } = useSchedulerNav();
  const { t } = useTranslation();
  const { setNavigateToTask } = useTaskNavigation();
  const { navigateToEvent: navigateToEventInCalendar } = useCalendar();
  const weekStartsOn = useWeekStartDay();

  // Initialize scheduler service (only in browser)
  const [schedulerPageService] = useState(() => {
    if (typeof window !== 'undefined') {
      return new SchedulerPageService(getDecryptedBackend());
    }
    return null;
  });

  // Calendar state
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // Can-do list state
  const [tasks, setTasks] = useState<CanDoItemDecrypted[]>([]);
  const [projects, setProjects] = useState<ProjectDecrypted[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Initialize can-do list service (only in browser)
  const [canDoListPageService] = useState(() => {
    if (typeof window !== 'undefined') {
      return new CanDoListPageService(getDecryptedBackend());
    }
    return null;
  });

  // Store websocket subscriptions
  const subscriptionsRef = useRef<RealtimeSubscription[]>([]);

  // Load can-do list data when encryption key becomes available
  useEffect(() => {
    const loadCanDoListData = async () => {
      if (!canDoListPageService || !encryptionKey) {
        return;
      }

      try {
        setIsLoadingTasks(true);
        setIsLoadingProjects(true);
        
        // Load all tasks and projects together
        const { tasks, projects } = await canDoListPageService.loadCanDoListData();
        
        setTasks(tasks);
        setProjects(projects);
      } catch (error) {
        console.error('Failed to load can-do list data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setIsLoadingTasks(false);
        setIsLoadingProjects(false);
      }
    };

    loadCanDoListData();
  }, [encryptionKey, canDoListPageService, setError]);

  // Set up websocket subscriptions for real-time updates
  useEffect(() => {
    if (!canDoListPageService || !encryptionKey) return;

    const backend = getDecryptedBackend();
    
    // Subscribe to can-do list changes
    const canDoSubscription = backend.canDoList.subscribe((payload: RealtimeMessage<CanDoItemDecrypted>) => {
      console.log('Can-do item websocket message (scheduler):', payload);
      
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new) {
            setTasks(prev => {
              // Check if task already exists to avoid duplicates
              const exists = prev.some(task => task.id === payload.new!.id);
              if (!exists) {
                return [...prev, payload.new!];
              }
              return prev;
            });
          }
          break;
          
        case 'UPDATE':
          if (payload.new) {
            setTasks(prev => prev.map(task => 
              task.id === payload.new!.id ? payload.new! : task
            ));
          }
          break;
          
        case 'DELETE':
          if (payload.old) {
            setTasks(prev => prev.filter(task => task.id !== payload.old!.id));
          }
          break;
      }
    });

    // Subscribe to project changes
    const projectSubscription = backend.projects.subscribe((payload: RealtimeMessage<ProjectDecrypted>) => {
      console.log('Project websocket message (scheduler):', payload);
      
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new) {
            setProjects(prev => {
              // Check if project already exists to avoid duplicates
              const exists = prev.some(project => project.id === payload.new!.id);
              if (!exists) {
                return [...prev, payload.new!];
              }
              return prev;
            });
          }
          break;
          
        case 'UPDATE':
          if (payload.new) {
            setProjects(prev => prev.map(project => 
              project.id === payload.new!.id ? payload.new! : project
            ));
          }
          break;
          
        case 'DELETE':
          if (payload.old) {
            setProjects(prev => prev.filter(project => project.id !== payload.old!.id));
          }
          break;
      }
    });

    // Store subscriptions for cleanup
    subscriptionsRef.current = [canDoSubscription, projectSubscription];

    // Cleanup function
    return () => {
      subscriptionsRef.current.forEach(subscription => {
        subscription.unsubscribe();
      });
      subscriptionsRef.current = [];
    };
  }, [canDoListPageService, encryptionKey]);

  // Wrapper functions to match expected signatures
  const handleToggleComplete = async (id: string, completed: boolean): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedTask = await canDoListPageService.toggleTaskComplete(id, completed);
      
      // If marking as completed, also complete all subtasks
      if (completed) {
        // Find all subtasks recursively
        const findAllSubtasks = (parentId: string, allTasks: CanDoItemDecrypted[]): CanDoItemDecrypted[] => {
          const directChildren = allTasks.filter(t => t.parent_task_id === parentId);
          const allSubtasks = [...directChildren];
          
          directChildren.forEach(child => {
            allSubtasks.push(...findAllSubtasks(child.id, allTasks));
          });
          
          return allSubtasks;
        };
        
        const subtasks = findAllSubtasks(id, tasks);
        
        // Complete all subtasks
        for (const subtask of subtasks) {
          if (!subtask.completed) {
            await canDoListPageService.toggleTaskComplete(subtask.id, true);
          }
        }
        
        // Update all tasks at once
        setTasks(prev => prev.map(task => {
          if (task.id === id) return updatedTask;
          if (subtasks.find(st => st.id === task.id)) {
            return { ...task, completed: true };
          }
          return task;
        }));
      } else {
        // Just update the single task
        setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to toggle task complete:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
      return false;
    }
  };

  const handleDeleteTask = async (id: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      // Check if task has a linked event and delete it first
      const linkedEvent = calendarEvents.find(event => event.task_id === id);
      if (linkedEvent) {
        try {
          await handleDeleteEvent(linkedEvent.id);
        } catch (eventError) {
          console.error('Failed to delete linked event:', eventError);
          // Continue with task deletion even if event deletion fails
        }
      }
      
      await canDoListPageService.deleteTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
      return false;
    }
  };

  const handleUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean, parentTaskId?: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedTask = await canDoListPageService.updateTask(
        id, content, estimatedDuration, projectId, impact, urgency, dueDate, blockedBy, myDay, parentTaskId
      );
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
      return true;
    } catch (error) {
      console.error('Failed to update task:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
      return false;
    }
  };

  const handleTaskDropToProject = useCallback(async (taskId: string, projectId: string) => {
    if (!canDoListPageService) return;
    
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Update the task's project
      const updatedTask = await canDoListPageService.updateTask(
        taskId,
        task.content,
        task.duration_minutes,
        projectId,
        task.impact,
        task.urgency,
        task.due_date ? new Date(task.due_date) : undefined,
        task.blocked_by,
        task.my_day,
        task.parent_task_id
      );
      
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      const project = projects.find(p => p.id === projectId);
      toast.success(`Task moved to ${project?.name || 'project'}`);
    } catch (error) {
      console.error('Failed to move task to project:', error);
      toast.error('Failed to move task');
    }
  }, [canDoListPageService, tasks, projects]);

  const handleAddTask = async (
    content: string,
    duration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean,
    parentTaskId?: string
  ): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const { task, shouldRefreshProjects } = await canDoListPageService.createTask(
        content, duration, projectId, impact, urgency, dueDate, blockedBy, myDay, parentTaskId
      );
      
      // Prepend new task to the beginning of the list
      setTasks(prev => [task, ...prev]);
      
      if (shouldRefreshProjects) {
        const updatedProjects = await canDoListPageService.projectService.getProjects();
        setProjects(updatedProjects);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to add task:', error);
      setError(error instanceof Error ? error.message : 'Failed to add task');
      return false;
    }
  };

  const handleReorderTasks = async (sourceIndex: number, destinationIndex: number, projectId?: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const success = await canDoListPageService.reorderTasks(sourceIndex, destinationIndex, projectId);
      
      if (success) {
        // Refresh tasks to reflect new order
        const updatedTasks = await canDoListPageService.taskService.getTasks();
        setTasks(updatedTasks);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to reorder tasks');
      return false;
    }
  };

  // Project wrapper functions
  const handleAddProject = async (name: string, description?: string, color?: string, parentId?: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const { project } = await canDoListPageService.createProject(name, description, color, parentId);
      setProjects(prev => [...prev, project]);
      return true;
    } catch (error) {
      console.error('Failed to add project:', error);
      setError(error instanceof Error ? error.message : 'Failed to add project');
      return false;
    }
  };

  const handleUpdateProject = async (id: string, updateData: any): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedProject = await canDoListPageService.updateProject(id, updateData);
      setProjects(prev => prev.map(project => project.id === id ? updatedProject : project));
      return true;
    } catch (error) {
      console.error('Failed to update project:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
      return false;
    }
  };

  const handleDeleteProject = async (id: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const projectIdsToDelete = new Set<string>();
      const collectProjectIds = (projectId: string) => {
        projectIdsToDelete.add(projectId);
        const childProjects = projects.filter(project => project.parent_id === projectId);
        for (const childProject of childProjects) {
          collectProjectIds(childProject.id);
        }
      };
      collectProjectIds(id);

      const tasksInProjectTree = tasks.filter(task =>
        task.project_id ? projectIdsToDelete.has(task.project_id) : false
      );

      for (const task of tasksInProjectTree) {
        const linkedEvent = calendarEvents.find(event => event.task_id === task.id);
        if (linkedEvent) {
          const eventDeleted = await handleDeleteEvent(linkedEvent.id);
          if (!eventDeleted) {
            throw new Error('Failed to delete linked event');
          }
        }
      }

      await canDoListPageService.deleteProjectWithTasks(id);
      
      // Refresh both projects and tasks
      const [updatedProjects, updatedTasks] = await Promise.all([
        canDoListPageService.projectService.getProjects(),
        canDoListPageService.taskService.getTasks()
      ]);
      
      // Update state in a single batch to prevent UI inconsistencies
      setProjects(updatedProjects);
      setTasks(updatedTasks);
      
      // Clear any existing errors
      setError(null);
      
      return true;
    } catch (error) {
      console.error('Failed to delete project:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
      return false;
    }
  };

  const handleBulkReorderProjects = async (projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      await canDoListPageService.reorderProjects(projectUpdates);
      
      // Refresh projects to reflect new order
      const updatedProjects = await canDoListPageService.projectService.getProjects();
      setProjects(updatedProjects);
      
      return true;
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to reorder projects');
      return false;
    }
  };

  const handleUpdateProjectCollapsedState = async (id: string, isCollapsed: boolean): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedProject = await canDoListPageService.toggleProjectCollapse(id, isCollapsed);
      setProjects(prev => prev.map(project => project.id === id ? updatedProject : project));
      return true;
    } catch (error) {
      console.error('Failed to update project collapsed state:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
      return false;
    }
  };

  // Load functions for compatibility
  const loadTasks = async (): Promise<CanDoItemDecrypted[]> => {
    if (!canDoListPageService) return [];

    try {
      setIsLoadingTasks(true);
      const updatedTasks = await canDoListPageService.taskService.getTasks();
      setTasks(updatedTasks);
      return updatedTasks;
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tasks');
      return [];
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const loadProjects = async (): Promise<ProjectDecrypted[]> => {
    if (!canDoListPageService) return [];

    try {
      setIsLoadingProjects(true);
      const updatedProjects = await canDoListPageService.projectService.getProjects();
      setProjects(updatedProjects);
      return updatedProjects;
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to load projects');
      return [];
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Handle toggling My Day status for a task
  const handleToggleMyDay = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const newMyDayStatus = !task.my_day;
    await handleUpdateTask(
      id, 
      task.content, 
      task.duration_minutes, 
      task.project_id, 
      undefined, // impact 
      undefined, // urgency
      task.due_date ? new Date(task.due_date) : undefined, 
      task.blocked_by, 
      newMyDayStatus
    );
  };

  // Bulk delete completed tasks handler
  const handleBulkDeleteCompleted = async (projectId?: string): Promise<number> => {
    if (!canDoListPageService) return 0;

    try {
      const completedTasks = tasks.filter(task => 
        task.completed && (!projectId || task.project_id === projectId)
      );
      
      let deletedCount = 0;
      for (const task of completedTasks) {
        await canDoListPageService.deleteTask(task.id);
        deletedCount++;
      }
      
      // Refresh tasks
      const updatedTasks = await canDoListPageService.taskService.getTasks();
      setTasks(updatedTasks);
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to bulk delete completed tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete completed tasks');
      return 0;
    }
  };

  // Load calendar data
  useEffect(() => {
    const loadCalendarData = async () => {
      if (!schedulerPageService) {
        console.error('Scheduler page service not initialized');
        return;
      }

      try {
        setIsLoadingCalendar(true);
        
        // Load all calendar and event data together
        const { calendars, events } = await schedulerPageService.loadSchedulerData();
        setCalendars(calendars);
        setCalendarEvents(events);
        
        // Load ICS events
        const icsEventsData = await schedulerPageService.fetchAllICSEvents(calendars);
        setIcsEvents(icsEventsData);
      } catch (error) {
        console.error('Failed to load calendar data:', error);
        setError('Failed to load calendar data');
      } finally {
        setIsLoadingCalendar(false);
      }
    };
    
    loadCalendarData();
  }, [schedulerPageService, setError]);

  // Calendar handlers
  const handleCalendarToggle = useCallback(async (calendarId: string, isVisible: boolean): Promise<void> => {
    if (!schedulerPageService) return;
    
    // Optimistic update - update UI immediately
    const previousCalendars = calendars;
    setCalendars(prev => prev.map(cal => 
      cal.id === calendarId 
        ? { ...cal, is_visible: isVisible }
        : cal
    ));
    
    try {
      const updatedCalendar = await schedulerPageService.toggleCalendarVisibility(calendarId, isVisible);
      // Confirm the update with server response
      setCalendars(prev => prev.map(cal => 
        cal.id === calendarId 
          ? { ...cal, ...updatedCalendar }
          : cal
      ));
    } catch (error) {
      // Rollback on error
      console.error('Failed to toggle calendar visibility:', error);
      setCalendars(previousCalendars);
      toast.error('Failed to update calendar visibility');
    }
  }, [schedulerPageService, calendars]);

  const handleCalendarCreate = useCallback(async (name: string, color: string): Promise<Calendar> => {
    if (!schedulerPageService) throw new Error('Service not available');
    
    try {
      const { calendar, shouldRefreshEvents } = await schedulerPageService.createCalendar(name, color);
      setCalendars(prev => [...prev, calendar]);
      
      if (shouldRefreshEvents) {
        const { events } = await schedulerPageService.loadSchedulerData();
        setCalendarEvents(events);
      }
      
      return calendar;
    } catch (error) {
      setError('Failed to create calendar');
      throw error;
    }
  }, [schedulerPageService, setError]);

  const handleICSCalendarCreate = useCallback(async (name: string, color: string, icsUrl: string): Promise<Calendar> => {
    if (!schedulerPageService) throw new Error('Service not available');
    
    try {
      const { calendar, shouldRefreshEvents } = await schedulerPageService.createICSCalendar(name, color, icsUrl);
      setCalendars(prev => [...prev, calendar]);
      
      if (shouldRefreshEvents) {
        const icsEventsData = await schedulerPageService.fetchICSEventsForCalendar(calendar);
        setIcsEvents(prev => [...prev, ...icsEventsData]);
      }
      
      return calendar;
    } catch (error) {
      setError('Failed to create ICS calendar');
      throw error;
    }
  }, [schedulerPageService, setError]);

  const handleICSCalendarRefresh = useCallback(async (calendarId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const { events, calendar } = await schedulerPageService.refreshICSEventsForCalendar(calendarId, calendars);
      setCalendars(prev => prev.map(cal => cal.id === calendarId ? calendar : cal));
      
      // Update ICS events
      setIcsEvents(prev => [
        ...prev.filter(event => event.calendar_id !== calendarId),
        ...events
      ]);
    } catch (error) {
      setError('Failed to refresh ICS calendar');
    }
  }, [schedulerPageService, calendars, setError]);

  const handleCalendarEdit = useCallback(async (id: string, name: string, color: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const updatedCalendar = await schedulerPageService.editCalendar(id, name, color);
      setCalendars(prev => prev.map(cal => 
        cal.id === id 
          ? { ...cal, ...updatedCalendar }
          : cal
      ));
    } catch (error) {
      setError('Failed to update calendar');
    }
  }, [schedulerPageService, setError]);

  const handleCalendarDelete = useCallback(async (calendarId: string): Promise<string | undefined> => {
    if (!schedulerPageService) return undefined;
    
    try {
      const result = await schedulerPageService.deleteCalendarWithEvents(
        calendarId,
        calendars
      );
      
      // Remove calendar from state
      setCalendars(prev => prev.filter(cal => cal.id !== result.deletedCalendarId));
      
      // Remove events for deleted calendar from state
      setCalendarEvents(prev => prev.filter(event => !result.deletedEventIds.includes(event.id)));
      
      // Update default calendar if it changed
      if (result.newDefaultCalendar) {
        setCalendars(prev => prev.map(cal => 
          cal.id === result.newDefaultCalendar!.id 
            ? result.newDefaultCalendar! 
            : { ...cal, is_default: false }
        ));
      }
      
      return result.newDefaultCalendar?.id;
    } catch (error) {
      setError('Failed to delete calendar');
      return undefined;
    }
  }, [schedulerPageService, calendars, setError]);

  const handleSetDefaultCalendar = useCallback(async (calendarId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      await schedulerPageService.setDefaultCalendar(calendarId);
      // Update all calendars - unset previous default and set new one
      setCalendars(prev => prev.map(cal => ({
        ...cal,
        is_default: cal.id === calendarId
      })));
    } catch (error) {
      setError('Failed to set default calendar');
    }
  }, [schedulerPageService, setError]);

  const handleSubmitEvent = useCallback(async (values: any): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const { event, isUpdate } = await schedulerPageService.submitEvent(values);
      
      if (isUpdate) {
        setCalendarEvents(prev => prev.map(e => e.id === event.id ? event : e));
      } else {
        setCalendarEvents(prev => [...prev, event]);
      }
      
      return true;
    } catch (error) {
      setError('Failed to save event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const handleDeleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      await schedulerPageService.deleteEvent(eventId);
      setCalendarEvents(prev => prev.filter(event => event.id !== eventId));
      return true;
    } catch (error) {
      setError('Failed to delete event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const handleCloneEvent = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const clonedEvent = await schedulerPageService.cloneEvent(event);
      setCalendarEvents(prev => [...prev, clonedEvent]);
      return true;
    } catch (error) {
      setError('Failed to clone event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const handleCreateTaskFromEvent = useCallback(async (
    eventId: string,
    title: string,
    projectId: string | null,
  ): Promise<void> => {
    if (!canDoListPageService || !schedulerPageService) return;

    try {
      // 1. Create the task
      const task = await canDoListPageService.taskService.createTask({
        content: title,
        project_id: projectId ?? undefined,
      });
      setTasks(prev => [task, ...prev]);

      // 2. Link the task to the event, passing all existing event fields so the
      //    full encrypted blob is preserved on the backend (partial updates would
      //    overwrite the stored encrypted_data and lose all other fields on reload).
      const existingEvent = calendarEvents.find(e => e.id === eventId);
      schedulerPageService.eventOps.calendarEventsService.updateCalendarEvent(
        eventId,
        {
          ...(existingEvent && {
            title: existingEvent.title,
            description: existingEvent.description ?? undefined,
            location: existingEvent.location ?? undefined,
            calendarId: existingEvent.calendar_id,
            startTime: existingEvent.start_time,
            endTime: existingEvent.end_time,
            isAllDay: existingEvent.all_day ?? false,
            recurrenceRule: existingEvent.recurrence_rule ?? undefined,
          }),
          taskId: task.id,
        },
      ).catch(err => console.error('Failed to link task to event:', err));
      setCalendarEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, task_id: task.id } : e,
      ));

      toast.success('Task created and linked to event');
    } catch (error) {
      console.error('Failed to create task from event:', error);
      toast.error('Failed to create task');
    }
  }, [canDoListPageService, schedulerPageService, calendarEvents]);

  const onEventUpdate = useCallback(async (updatedEvent: CalendarEvent): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const updateData = {
        title: updatedEvent.title,
        description: updatedEvent.description,
        location: updatedEvent.location,
        calendarId: updatedEvent.calendar_id,
        startTime: new Date(updatedEvent.start_time),
        endTime: new Date(updatedEvent.end_time),
        isAllDay: updatedEvent.all_day,
        recurrenceRule: updatedEvent.recurrence_rule,
        recurrenceException: updatedEvent.recurrence_exception,
        isGroupEvent: updatedEvent.is_group_event,
        parentGroupEventId: updatedEvent.parent_group_event_id,
        taskId: updatedEvent.task_id,
      };
      const eventWithUpdates = await schedulerPageService.updateEvent(updatedEvent.id, updateData);
      
      // If this is a group event being moved, update all child events
      const updatedChildEvents: CalendarEvent[] = [];
      if (updatedEvent.is_group_event) {
        // Find the original event to calculate the time offset
        const originalEvent = calendarEvents.find(e => e.id === updatedEvent.id);
        if (originalEvent) {
          const originalStartTime = new Date(originalEvent.start_time).getTime();
          const newStartTime = new Date(updatedEvent.start_time).getTime();
          const timeOffset = newStartTime - originalStartTime;
          
          // Only update child events if the group event actually moved
          if (timeOffset !== 0) {
            // Find all child events
            const childEvents = calendarEvents.filter(e => e.parent_group_event_id === updatedEvent.id);
            
            // Update each child event with the same time offset
            for (const childEvent of childEvents) {
              const childStartTime = new Date(childEvent.start_time);
              const childEndTime = new Date(childEvent.end_time);
              
              const newChildStartTime = new Date(childStartTime.getTime() + timeOffset);
              const newChildEndTime = new Date(childEndTime.getTime() + timeOffset);
              
              const childUpdateData = {
                title: childEvent.title,
                description: childEvent.description,
                location: childEvent.location,
                calendarId: childEvent.calendar_id,
                startTime: newChildStartTime,
                endTime: newChildEndTime,
                isAllDay: childEvent.all_day,
                recurrenceRule: childEvent.recurrence_rule,
                recurrenceException: childEvent.recurrence_exception,
                isGroupEvent: childEvent.is_group_event,
                parentGroupEventId: childEvent.parent_group_event_id,
                taskId: childEvent.task_id,
              };
              
              const updatedChild = await schedulerPageService.updateEvent(childEvent.id, childUpdateData);
              updatedChildEvents.push(updatedChild);
            }
          }
        }
      }
      
      // Update state for the group event and all affected child events
      setCalendarEvents(prev => prev.map(event => {
        if (event.id === updatedEvent.id) {
          return eventWithUpdates;
        }
        const updatedChild = updatedChildEvents.find(child => child.id === event.id);
        if (updatedChild) {
          return updatedChild;
        }
        return event;
      }));
      return true;
    } catch (error) {
      console.error('Failed to update event:', error);
      setError('Failed to update event');
      return false;
    }
  }, [schedulerPageService, setError, calendarEvents]);

  const moveEventToCalendar = useCallback(async (eventId: string, targetCalendarId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const updatedEvent = await schedulerPageService.moveEventToCalendar(eventId, targetCalendarId);
      setCalendarEvents(prev => prev.map(event => event.id === eventId ? updatedEvent : event));
    } catch (error) {
      setError('Failed to move event');
    }
  }, [schedulerPageService, setError]);

  // Recurring event handlers
  const handleDeleteThisOccurrence = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const result = await schedulerPageService.deleteThisOccurrence(event, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to delete occurrence');
        return false;
      }
    } catch (error) {
      console.error('Failed to delete occurrence:', error);
      setError('Failed to delete occurrence');
      return false;
    }
  }, [schedulerPageService, calendarEvents, setError]);

  const handleDeleteThisAndFuture = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const result = await schedulerPageService.deleteThisAndFuture(event, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to delete this and future');
        return false;
      }
    } catch (error) {
      console.error('Failed to delete this and future:', error);
      setError('Failed to delete occurrences');
      return false;
    }
  }, [schedulerPageService, calendarEvents, setError]);

  const handleModifyThisOccurrence = useCallback(async (event: CalendarEvent, modifications: Partial<CalendarEvent>): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const result = await schedulerPageService.modifyThisOccurrence(event, modifications, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to modify occurrence');
        return false;
      }
    } catch (error) {
      console.error('Failed to modify occurrence:', error);
      setError('Failed to modify occurrence');
      return false;
    }
  }, [schedulerPageService, calendarEvents, setError]);

  const handleModifyThisAndFuture = useCallback(async (event: CalendarEvent, modifications: Partial<CalendarEvent>): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const result = await schedulerPageService.modifyThisAndFuture(event, modifications, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to modify this and future');
        return false;
      }
    } catch (error) {
      console.error('Failed to modify this and future:', error);
      setError('Failed to modify occurrences');
      return false;
    }
  }, [schedulerPageService, calendarEvents, setError]);

  const handleModifyAllInSeries = useCallback(async (event: CalendarEvent, modifications: Partial<CalendarEvent>): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const result = await schedulerPageService.modifyAllInSeries(event, modifications, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to modify series');
        return false;
      }
    } catch (error) {
      console.error('Failed to modify series:', error);
      setError('Failed to modify series');
      return false;
    }
  }, [schedulerPageService, calendarEvents, setError]);

  // View state for showing/hiding panels (persisted in localStorage)
  const [showTaskList, setShowTaskList, isTaskListHydrated] = useLocalStorage('scheduler-show-task-list', true);
  const [showCalendar, setShowCalendar, isCalendarHydrated] = useLocalStorage('scheduler-show-calendar', true);
  
  // Ensure on mobile only one panel is active (default to calendar if both are active)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Wait until localStorage values are loaded before applying mobile logic
    if (!isTaskListHydrated || !isCalendarHydrated) return;
    
    const checkMobileState = () => {
      if (window.innerWidth < 768 && showTaskList && showCalendar) {
        // On mobile, if both are active, default to calendar only
        setShowTaskList(false);
        setShowCalendar(true);
      }
    };
    
    // Check on mount
    checkMobileState();
    
    // Check on window resize
    window.addEventListener('resize', checkMobileState);
    return () => window.removeEventListener('resize', checkMobileState);
  }, [showTaskList, showCalendar, setShowTaskList, setShowCalendar, isTaskListHydrated, isCalendarHydrated]);
  
  // Handlers for toggling view panels (with constraint that at least one must be visible)
  const handleToggleTaskList = useCallback(() => {
    // Only allow toggling off if calendar is visible
    if (showTaskList && showCalendar) {
      setShowTaskList(false);
    } else if (!showTaskList) {
      setShowTaskList(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskList, showCalendar]);

  const handleToggleCalendar = useCallback(() => {
    // Only allow toggling off if task list is visible
    if (showCalendar && showTaskList) {
      setShowCalendar(false);
    } else if (!showCalendar) {
      setShowCalendar(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalendar, showTaskList]);

  // Set scheduler navigation in navbar using useEffect to handle mount/unmount
  useEffect(() => {
    setSchedulerNavContent(
      <ButtonGroup>
        <Button
          variant={showTaskList ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (window.innerWidth < 768) {
              setShowTaskList(true);
              setShowCalendar(false);
            } else {
              handleToggleTaskList();
            }
          }}
          className="flex items-center gap-2"
        >
          <LayoutList className="h-4 w-4" />
          <span>{t('tasks.canDoList')}</span>
        </Button>
        <ButtonGroupSeparator />
        <Button
          variant={showCalendar ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (window.innerWidth < 768) {
              setShowCalendar(true);
              setShowTaskList(false);
            } else {
              handleToggleCalendar();
            }
          }}
          className="flex items-center gap-2"
        >
          <CalendarIcon className="h-4 w-4" />
          <span>{t('calendar.calendar')}</span>
        </Button>
      </ButtonGroup>
    );

    return () => {
      setSchedulerNavContent(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskList, showCalendar]);

  // Get default calendar for creating events from tasks
  const defaultCalendar = calendars.find((cal: Calendar) => cal.is_default) || calendars[0];

  // Wrapper functions to match CanDoListMain expected signatures (return boolean)
  const wrappedHandleToggleCompleteBoolean = async (id: string, completed: boolean): Promise<boolean> => {
    return await handleToggleComplete(id, completed);
  };

  const wrappedHandleDeleteTaskBoolean = async (id: string): Promise<boolean> => {
    return await handleDeleteTask(id);
  };

  const wrappedHandleUpdateTaskBoolean = async (
    id: string,
    content?: string,
    duration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean,
    parentTaskId?: string
  ): Promise<boolean> => {
    if (content !== undefined) {
      return await handleUpdateTask(id, content, duration, projectId, impact, urgency, dueDate, blockedBy, myDay, parentTaskId);
    }
    return false;
  };

  // Wrapper functions for mobile view (return void)
  const wrappedHandleToggleCompleteVoid = async (id: string, completed: boolean): Promise<void> => {
    await handleToggleComplete(id, completed);
  };

  const wrappedHandleDeleteTaskVoid = async (id: string): Promise<void> => {
    await handleDeleteTask(id);
  };

  const wrappedHandleUpdateTaskVoid = async (
    id: string,
    content: string,
    estimatedDuration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean
  ): Promise<void> => {
    await handleUpdateTask(id, content, estimatedDuration, projectId, impact, urgency, dueDate, blockedBy, myDay);
  };

  const wrappedLoadTasks = async (): Promise<void> => {
    await loadTasks();
  };

  const wrappedLoadProjects = async (): Promise<void> => {
    await loadProjects();
  };

  // Handler for scheduling a task to the next free slot
  const handleScheduleTask = async (taskId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        toast.error('Task not found');
        return;
      }
      
      // Use task duration or default to 60 minutes (1 hour)
      const durationMinutes = task.duration_minutes || 60;
      
      // Find the next free slot
      const freeSlot = await schedulerPageService.findNextFreeSlot(durationMinutes, calendars);
      
      if (!freeSlot) {
        toast.error('No free slot found in the next 7 days');
        return;
      }
      
      // Get default calendar
      const defaultCalendar = calendars.find(cal => cal.is_default) || calendars[0];
      if (!defaultCalendar) {
        toast.error('No calendar available');
        return;
      }
      
      // Create calendar event
      // Format dates in local timezone to avoid UTC conversion issues
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const eventData = {
        id: 'new',
        title: task.content,
        description: `Task scheduled from Can-Do List${task.project_id ? `\nProject: ${projects.find(p => p.id === task.project_id)?.name || ''}` : ''}`,
        calendarId: defaultCalendar.id,
        isAllDay: false,
        startDate: formatLocalDate(freeSlot.start),
        startTime: `${freeSlot.start.getHours().toString().padStart(2, '0')}:${freeSlot.start.getMinutes().toString().padStart(2, '0')}`,
        endDate: formatLocalDate(freeSlot.end),
        endTime: `${freeSlot.end.getHours().toString().padStart(2, '0')}:${freeSlot.end.getMinutes().toString().padStart(2, '0')}`,
        recurrenceFrequency: 'none' as const,
        recurrenceInterval: 1,
        isGroupEvent: false,
        taskId: task.id // Link the event to the task
      };
      
      const success = await handleSubmitEvent(eventData);
      if (success) {
        toast.success(`Task scheduled for ${freeSlot.start.toLocaleDateString()} at ${freeSlot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      } else {
        toast.error('Failed to schedule task');
      }
    } catch (error) {
      console.error('Error scheduling task:', error);
      toast.error('Failed to schedule task');
    }
  };

  // Handle task drop onto calendar
  const handleTaskDrop = async (taskId: string, startTime: Date, durationMinutes: number): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) {
        toast.error('Task not found');
        return;
      }
      
      // Get default calendar
      const defaultCalendar = calendars.find(cal => cal.is_default) || calendars[0];
      
      if (!defaultCalendar) {
        toast.error('No calendar available');
        return;
      }
      
      // Create calendar event from task
      const newEvent = await schedulerPageService.createEventFromTask(task, defaultCalendar.id, startTime);
      
      // Update state with new event
      setCalendarEvents([...calendarEvents, newEvent]);
      toast.success(`Scheduled: ${task.content}`);
    } catch (error) {
      console.error('Error scheduling task:', error);
      toast.error('Failed to schedule task');
    }
  };

  // Handle navigation from task to event
  const handleNavigateToEvent = (eventId: string) => {
    // Open the calendar if closed
    if (!showCalendar) {
      setShowCalendar(true);
    }
    
    // Find the event
    const event = calendarEvents.find(e => e.id === eventId);
    if (event) {
      // Navigate to the event using the store
      navigateToEventInCalendar(eventId, new Date(event.start_time), weekStartsOn);
    }
  };

  // Handle deletion of linked event
  const handleDeleteEventFromTask = async (eventId: string): Promise<void> => {
    try {
      await handleDeleteEvent(eventId);
      toast.success('Event deleted');
      } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
      }
  };

  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading encryption key...</p>
        </div>
      </div>
    );
  }

  if (!encryptionKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Encryption key not available</p>
          <p>Please refresh the page and try again.</p>
        </div>
      </div>
    );
  }

    // Create wrapper functions to match expected signatures
  const handleSubmitEventWrapper = async (eventData: any): Promise<void> => {
    const result = await handleSubmitEvent(eventData);
    // Convert result to void
  };

  const handleDeleteEventWrapper = async (id: string): Promise<void> => {
    const result = await handleDeleteEvent(id);
    // Convert result to void
  };

  return (
    <div className="flex flex-col h-full w-full">

      {/* Main Content Area - Unified for Mobile and Desktop */}
      <div className="flex flex-1 overflow-hidden">
        {/* Can-Do List */}
        {showTaskList && (
          <div className={cn(
            "h-full overflow-hidden",
            // Desktop: transition and width based on calendar visibility
            "md:transition-all md:duration-300",
            showCalendar ? "w-full md:w-1/2" : "w-full md:flex-1"
          )}>
            <CanDoListMain
              tasks={tasks}
                projects={projects}
              isLoadingTasks={isLoadingTasks}
              isLoadingProjects={isLoadingProjects}
              isLoadingKey={isLoadingKey}
              encryptionKey={encryptionKey}
              calendarEvents={calendarEvents}
              handleAddTask={handleAddTask}
              handleUpdateTask={wrappedHandleUpdateTaskBoolean}
              handleToggleComplete={wrappedHandleToggleCompleteBoolean}
              handleDeleteTask={wrappedHandleDeleteTaskBoolean}
              handleBulkDeleteCompleted={handleBulkDeleteCompleted}
              handleReorderTasks={handleReorderTasks}
              loadTasks={wrappedLoadTasks}
              handleScheduleTask={handleScheduleTask}
              handleAddProject={handleAddProject}
              handleUpdateProject={handleUpdateProject}
              handleDeleteProject={handleDeleteProject}
              handleBulkReorderProjects={handleBulkReorderProjects}
              handleUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
              handleTaskDropToProject={handleTaskDropToProject}
              loadProjects={wrappedLoadProjects}
              onNavigateToEvent={handleNavigateToEvent}
              onDeleteEvent={handleDeleteEventFromTask}
              containerClassName="flex w-full h-full"
            />
          </div>
        )}

        {/* Calendar */}
        {showCalendar && (
          <div className={cn(
            "h-full overflow-hidden",
            showTaskList ? "w-full md:flex-1" : "w-full"
          )}>
            <CalendarMain
              calendars={calendars}
              events={calendarEvents}
              icsEvents={icsEvents}
              isLoading={isLoadingCalendar}
              tasks={tasks}
              projects={projects}
              onNavigateToTask={(taskId) => {
                // Open the task list if closed
                if (!showTaskList) {
                  setShowTaskList(true);
                }
                // Set the task to navigate to in the store
                setNavigateToTask(taskId);
              }}
              onCalendarToggle={handleCalendarToggle}
              onCalendarCreate={handleCalendarCreate}
              onICSCalendarCreate={handleICSCalendarCreate}
              onICSCalendarRefresh={handleICSCalendarRefresh}
              onCalendarEdit={handleCalendarEdit}
              onCalendarDelete={handleCalendarDelete}
              onSetDefaultCalendar={handleSetDefaultCalendar}
              onSubmitEvent={handleSubmitEvent}
              onDeleteEvent={handleDeleteEvent}
              onCloneEvent={handleCloneEvent}
              onEventUpdate={onEventUpdate}
              moveEventToCalendar={moveEventToCalendar}
              onTaskSchedule={handleTaskDrop}
              onDeleteThisOccurrence={handleDeleteThisOccurrence}
              onDeleteThisAndFuture={handleDeleteThisAndFuture}
              onModifyThisOccurrence={handleModifyThisOccurrence}
              onModifyThisAndFuture={handleModifyThisAndFuture}
              onModifyAllInSeries={handleModifyAllInSeries}
              onRefreshICSCalendar={handleICSCalendarRefresh}
              isICSEvent={(event: CalendarEvent) => schedulerPageService?.isICSEvent(event, calendars) || false}
              isReadOnlyCalendar={(calendarId: string) => schedulerPageService?.isReadOnlyCalendar(calendarId, calendars) || false}
              onCreateTaskFromEvent={handleCreateTaskFromEvent}
            />
          </div>
        )}
              </div>
    </div>
  );
}

export default function SchedulerPage() {
  return (
    <AuthGuard>
      <FlexyDNDProvider>
        <div className="fixed top-16 left-0 right-0 bottom-0 overflow-hidden">
          <ErrorProvider>
            <SchedulerPageContent />
          </ErrorProvider>
        </div>
        <TaskDragPreview />
      </FlexyDNDProvider>
    </AuthGuard>
  );
} 
