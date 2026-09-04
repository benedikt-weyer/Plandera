'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { decryptData, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
import {
  CanDoItemDecrypted,
  CanDoItemEncrypted,
  ProjectDecrypted,
  ProjectEncrypted,
  CalendarDecrypted,
  CalendarEncrypted,
  CalendarEventDecrypted,
  CalendarEventEncrypted,
  CountdownDecrypted,
  CountdownEncrypted,
  UserSettingsDecrypted,
  UserSettingsEncrypted
} from '@/utils/api/types';

export interface ExportedData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    can_do_list: CanDoItemDecrypted[];
    projects: ProjectDecrypted[];
    calendars: CalendarDecrypted[];
    calendar_events: CalendarEventDecrypted[];
    countdowns: CountdownEncrypted[];
    user_settings?: UserSettingsEncrypted;
  };
}

// Domain-specific extensions for export/import
export interface DecryptedTask extends Omit<CanDoItemDecrypted, 'created_at' | 'updated_at' | 'project_id' | 'display_order'> {
  estimatedDuration?: number;
  impact?: number;
  urgency?: number;
  dueDate?: string;
  blockedBy?: string;
  projectId?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedProject extends Omit<ProjectDecrypted, 'created_at' | 'updated_at' | 'parent_id' | 'collapsed'> {
  parentId?: string;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCalendar extends Omit<CalendarDecrypted, 'created_at' | 'updated_at' | 'is_visible' | 'is_default' | 'ics_url' | 'last_sync'> {
  isVisible?: boolean;
  isDefault?: boolean;
  icsUrl?: string;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCalendarEvent extends Omit<CalendarEventDecrypted, 'created_at' | 'updated_at' | 'start_time' | 'end_time' | 'all_day' | 'calendar_id'> {
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  calendarId?: string;
  recurrencePattern?: {
    frequency: string;
    endDate?: string;
    interval?: number;
    daysOfWeek?: number[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCountdown extends Omit<CountdownDecrypted, 'created_at' | 'updated_at'> {
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedExportData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    tasks: DecryptedTask[];
    projects: DecryptedProject[];
    calendars: DecryptedCalendar[];
    calendarEvents: DecryptedCalendarEvent[];
    countdowns: DecryptedCountdown[];
    userSettings?: UserSettingsDecrypted;
    profile?: any;
  };
}

// Decrypt a raw (ciphertext) export into plaintext form, mirroring the fields each
// resource actually stores encrypted (see DecryptedBackendImpl's decrypt* methods).
export function decryptExportedData(rawData: ExportedData, encryptionKey: string): DecryptedExportData {
  const decryptItem = (item: any): any | null => {
    try {
      const key = deriveKeyFromPassword(encryptionKey, item.salt);
      return decryptData(item.encrypted_data, key, item.iv) || null;
    } catch (error) {
      console.error('Failed to decrypt item:', error);
      return null;
    }
  };

  const tasks: DecryptedTask[] = (rawData.data.can_do_list || [])
    .map((task: any) => {
      const decrypted = decryptItem(task);
      if (!decrypted) return null;
      return {
        id: task.id,
        content: decrypted.content,
        completed: decrypted.completed,
        estimatedDuration: decrypted.duration_minutes,
        impact: decrypted.impact,
        urgency: decrypted.urgency,
        dueDate: decrypted.due_date,
        blockedBy: decrypted.blocked_by,
        tags: decrypted.tags,
        my_day: decrypted.my_day,
        parent_task_id: decrypted.parent_task_id,
        projectId: task.project_id,
        displayOrder: task.display_order ?? 0,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        user_id: task.user_id,
      };
    })
    .filter((task): task is NonNullable<typeof task> => task !== null);

  const projects: DecryptedProject[] = (rawData.data.projects || [])
    .map((project: any) => {
      const decrypted = decryptItem(project);
      if (!decrypted) return null;
      return {
        id: project.id,
        name: decrypted.name,
        description: decrypted.description,
        color: decrypted.color,
        parentId: project.parent_id,
        order: project.display_order ?? 0,
        isCollapsed: project.is_collapsed ?? false,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        user_id: project.user_id,
      };
    })
    .filter((project): project is NonNullable<typeof project> => project !== null);

  const calendars: DecryptedCalendar[] = (rawData.data.calendars || [])
    .map((calendar: any) => {
      const decrypted = decryptItem(calendar);
      if (!decrypted) return null;
      return {
        id: calendar.id,
        name: decrypted.name,
        color: decrypted.color,
        isVisible: decrypted.is_visible ?? true,
        isDefault: calendar.is_default,
        type: decrypted.type || 'regular',
        icsUrl: decrypted.ics_url,
        lastSync: decrypted.last_sync,
        createdAt: calendar.created_at,
        updatedAt: calendar.updated_at,
        user_id: calendar.user_id,
      };
    })
    .filter((calendar): calendar is NonNullable<typeof calendar> => calendar !== null);

  const calendarEvents: DecryptedCalendarEvent[] = (rawData.data.calendar_events || [])
    .map((event: any) => {
      const decrypted = decryptItem(event);
      if (!decrypted) return null;

      let recurrencePattern = undefined;
      if (decrypted.recurrence_rule) {
        try {
          const rule = JSON.parse(decrypted.recurrence_rule);
          if (rule.frequency && rule.frequency !== 'none') {
            recurrencePattern = {
              frequency: rule.frequency,
              interval: rule.interval || 1,
              endDate: rule.end_date,
              daysOfWeek: rule.days_of_week,
            };
          }
        } catch (error) {
          console.error('Failed to parse recurrence rule:', error);
        }
      }

      return {
        id: event.id,
        title: decrypted.title,
        description: decrypted.description,
        location: decrypted.location,
        startTime: decrypted.start_time,
        endTime: decrypted.end_time,
        isAllDay: decrypted.all_day,
        recurrence_rule: decrypted.recurrence_rule,
        recurrencePattern,
        recurrence_exception: decrypted.recurrence_exception,
        calendarId: decrypted.calendar_id,
        is_group_event: decrypted.is_group_event,
        is_task_reservation_space: decrypted.is_task_reservation_space,
        parent_group_event_id: decrypted.parent_group_event_id,
        task_id: decrypted.task_id,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        user_id: event.user_id,
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null);

  const countdowns: DecryptedCountdown[] = (rawData.data.countdowns || [])
    .map((countdown: any) => {
      const decrypted = decryptItem(countdown);
      if (!decrypted) return null;
      return {
        id: countdown.id,
        event_id: countdown.event_id,
        target: decrypted.target,
        task_id: decrypted.task_id,
        createdAt: countdown.created_at,
        updatedAt: countdown.updated_at,
        user_id: countdown.user_id,
      };
    })
    .filter((countdown): countdown is NonNullable<typeof countdown> => countdown !== null);

  const userSettings: UserSettingsDecrypted | undefined = rawData.data.user_settings?.encrypted_data
    ? decryptItem(rawData.data.user_settings) || undefined
    : undefined;

  return {
    version: rawData.version,
    timestamp: rawData.timestamp,
    userId: rawData.userId,
    data: {
      tasks,
      projects,
      calendars,
      calendarEvents,
      countdowns,
      userSettings,
      profile: undefined,
    },
  };
}

// Export all user data
export async function exportUserData(): Promise<ExportedData> {
  try {
    const rawBackend = getBackend();
    const decryptedBackend = getDecryptedBackend();
    
    // Use the backend's data management export method if available
    if (rawBackend.dataManagement?.exportUserData) {
      return await rawBackend.dataManagement.exportUserData();
    }
    
    // Fallback to direct implementation
    const { data: { user } } = await rawBackend.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch all user data using decrypted backend
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult, countdownsResult, userSettingsResult] = await Promise.all([
      decryptedBackend.canDoList.getAll(),
      decryptedBackend.projects.getAll({ all: true }), // Get all projects including children
      decryptedBackend.calendars.getAll(),
      decryptedBackend.calendarEvents.getAll(),
      decryptedBackend.countdowns.getAll(),
      decryptedBackend.userSettings.get(),
    ]);

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        can_do_list: canDoListResult.data || [],
        projects: projectsResult.data || [],
        calendars: calendarsResult.data || [],
        calendar_events: calendarEventsResult.data || [],
        countdowns: (countdownsResult.data || []) as any,
        user_settings: userSettingsResult.data as any,
      },
    };
  } catch (error) {
    console.error('Failed to export user data:', error);
    throw error;
  }
}

// Import (encrypted-format) user data: decrypt it with the current session's key, then
// run it through the same ID-remapping importer as the decrypted format.
export async function importUserData(data: ExportedData, encryptionKey: string): Promise<void> {
  return importDecryptedUserData(decryptExportedData(data, encryptionKey), encryptionKey);
}

// Clear all user data
export async function clearAllUserData(): Promise<void> {
  try {
    const rawBackend = getBackend();

    // Use the backend's data management clear method if available
    if (rawBackend.dataManagement?.clearAllUserData) {
      return await rawBackend.dataManagement.clearAllUserData();
    }

    // Fallback to direct implementation
    // Get all data first
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      rawBackend.canDoList.getAll(),
      rawBackend.projects.getAll({ all: true }), // Get all projects including children
      rawBackend.calendars.getAll(),
      rawBackend.calendarEvents.getAll(),
    ]);

    // Delete in reverse order (children first, then parents)
    
    // Delete calendar events
    if (calendarEventsResult.data) {
      for (const event of calendarEventsResult.data) {
        await rawBackend.calendarEvents.delete(event.id);
      }
    }

    // Delete calendars
    if (calendarsResult.data) {
      for (const calendar of calendarsResult.data) {
        await rawBackend.calendars.delete(calendar.id);
      }
    }

    // Delete can-do list items
    if (canDoListResult.data) {
      for (const task of canDoListResult.data) {
        await rawBackend.canDoList.delete(task.id);
      }
    }

    // Delete projects
    if (projectsResult.data) {
      for (const project of projectsResult.data) {
        await rawBackend.projects.delete(project.id);
      }
    }
  } catch (error) {
    console.error('Failed to clear user data:', error);
    throw error;
  }
}

// Import decrypted user data: recreate every record through the decrypted backend (which
// handles encryption itself), remapping old IDs to the freshly created ones as we go so
// relationships between records (project nesting, task blocking, event->calendar links,
// countdown->event links, etc.) survive the round trip instead of pointing at IDs that no
// longer exist.
export async function importDecryptedUserData(data: DecryptedExportData, encryptionKey: string): Promise<void> {
  const backend = getDecryptedBackend();

  const projectIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();
  const calendarIdMap = new Map<string, string>();
  const eventIdMap = new Map<string, string>();

  // Projects: create first without parent_id (parent may not exist yet), then wire up
  // parent/child relationships once every project has a new id.
  for (const project of data.data.projects) {
    const result = await backend.projects.create({
      name: project.name,
      description: project.description,
      color: project.color,
      order: project.order,
      collapsed: project.isCollapsed,
    });
    if (result.data) projectIdMap.set(project.id, result.data.id);
  }
  for (const project of data.data.projects) {
    const newId = projectIdMap.get(project.id);
    if (!newId || !project.parentId) continue;
    const newParentId = projectIdMap.get(project.parentId);
    if (newParentId) {
      await backend.projects.update({ id: newId, parent_id: newParentId });
    }
  }

  // Tasks: create with project_id already remapped; blocking/subtask relationships are
  // wired up afterward since they can reference tasks created later in the same import.
  for (const task of data.data.tasks) {
    const result = await backend.canDoList.create({
      content: task.content,
      completed: task.completed,
      due_date: task.dueDate,
      impact: task.impact,
      urgency: task.urgency,
      tags: task.tags,
      duration_minutes: task.estimatedDuration,
      my_day: task.my_day,
      project_id: task.projectId ? projectIdMap.get(task.projectId) : undefined,
      display_order: task.displayOrder,
    });
    if (result.data) taskIdMap.set(task.id, result.data.id);
  }
  for (const task of data.data.tasks) {
    const newId = taskIdMap.get(task.id);
    if (!newId) continue;
    const updates: { id: string; blocked_by?: string; parent_task_id?: string } = { id: newId };
    if (task.blockedBy && taskIdMap.has(task.blockedBy)) {
      updates.blocked_by = taskIdMap.get(task.blockedBy);
    }
    if (task.parent_task_id && taskIdMap.has(task.parent_task_id)) {
      updates.parent_task_id = taskIdMap.get(task.parent_task_id);
    }
    if (Object.keys(updates).length > 1) {
      await backend.canDoList.update(updates);
    }
  }

  // Calendars: no cross-references to remap.
  for (const calendar of data.data.calendars) {
    const result = await backend.calendars.create({
      name: calendar.name,
      color: calendar.color,
      is_visible: calendar.isVisible,
      is_default: calendar.isDefault,
      type: calendar.type as 'regular' | 'ics' | undefined,
      ics_url: calendar.icsUrl,
      last_sync: calendar.lastSync,
    });
    if (result.data) calendarIdMap.set(calendar.id, result.data.id);
  }

  // Calendar events: calendar_id and task_id can be remapped immediately (calendars and
  // tasks are already created); parent_group_event_id is wired up afterward since group
  // events may reference each other within this same batch.
  for (const event of data.data.calendarEvents) {
    const recurrence_rule = event.recurrencePattern
      ? JSON.stringify({
          frequency: event.recurrencePattern.frequency,
          interval: event.recurrencePattern.interval,
          end_date: event.recurrencePattern.endDate,
          days_of_week: event.recurrencePattern.daysOfWeek,
        })
      : event.recurrence_rule;

    const result = await backend.calendarEvents.create({
      title: event.title,
      description: event.description,
      location: event.location,
      start_time: event.startTime,
      end_time: event.endTime,
      all_day: event.isAllDay,
      calendar_id: (event.calendarId && calendarIdMap.get(event.calendarId)) || event.calendarId || '',
      recurrence_rule,
      is_group_event: event.is_group_event,
      is_task_reservation_space: event.is_task_reservation_space,
      task_id: event.task_id ? taskIdMap.get(event.task_id) : undefined,
    });
    if (result.data) eventIdMap.set(event.id, result.data.id);
  }
  for (const event of data.data.calendarEvents) {
    const newId = eventIdMap.get(event.id);
    if (!newId) continue;
    const updates: { id: string; parent_group_event_id?: string; recurrence_exception?: string[] } = { id: newId };
    if (event.parent_group_event_id && eventIdMap.has(event.parent_group_event_id)) {
      updates.parent_group_event_id = eventIdMap.get(event.parent_group_event_id);
    }
    if (event.recurrence_exception) {
      updates.recurrence_exception = event.recurrence_exception;
    }
    if (Object.keys(updates).length > 1) {
      await backend.calendarEvents.update(updates);
    }
  }

  // Countdowns: event_id remapped to the freshly created calendar event.
  for (const countdown of data.data.countdowns || []) {
    const eventId = eventIdMap.get(countdown.event_id) || countdown.event_id;
    await backend.countdowns.create({
      event_id: eventId,
      target: countdown.target,
      task_id: countdown.task_id ? taskIdMap.get(countdown.task_id) : undefined,
    });
  }

  // User settings: singleton, no id to remap.
  if (data.data.userSettings) {
    await backend.userSettings.update(data.data.userSettings);
  }
}

// Change user password
export async function changePassword(newPassword: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.auth.updatePassword({ password: newPassword });
  } catch (error) {
    console.error('Failed to change password:', error);
    throw error;
  }
}