'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { encryptData, generateSalt, generateIV, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
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

// Import user data
export async function importUserData(data: ExportedData): Promise<void> {
  try {
    const rawBackend = getBackend();

    // Use the backend's data management import method which handles encryption properly
    if (rawBackend.dataManagement?.importUserData) {
      return await rawBackend.dataManagement.importUserData(data);
    }

    // If no backend import method, the data should be handled by a more sophisticated import
    throw new Error('Backend import method not available. Import functionality requires backend support.');
  } catch (error) {
    console.error('Failed to import user data:', error);
    throw error;
  }
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

// Re-encrypt a plaintext record for storage, mirroring DecryptedBackendImpl.encryptItemData
function encryptItem(plaintext: Record<string, any>, encryptionKey: string): { encrypted_data: string; iv: string; salt: string } {
  const salt = generateSalt();
  const iv = generateIV();
  const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
  const encrypted_data = encryptData(plaintext, derivedKey, iv);
  return { encrypted_data, iv, salt };
}

// Import decrypted user data: re-encrypt every record's plaintext fields, then delegate to main import
export async function importDecryptedUserData(data: DecryptedExportData, encryptionKey: string): Promise<void> {
  try {
    const can_do_list = data.data.tasks.map(task => ({
      ...encryptItem({
        content: task.content,
        completed: task.completed,
        due_date: task.dueDate,
        impact: task.impact,
        urgency: task.urgency,
        tags: task.tags,
        duration_minutes: task.estimatedDuration,
        blocked_by: task.blockedBy,
        my_day: task.my_day,
        parent_task_id: task.parent_task_id,
      }, encryptionKey),
      project_id: task.projectId,
      display_order: task.displayOrder,
    }));

    const projects = data.data.projects.map(project => ({
      ...encryptItem({
        name: project.name,
        description: project.description,
        color: project.color,
      }, encryptionKey),
      parent_id: project.parentId,
      display_order: project.order,
      is_collapsed: project.isCollapsed,
    }));

    const calendars = data.data.calendars.map(calendar => ({
      ...encryptItem({
        name: calendar.name,
        color: calendar.color,
        is_visible: calendar.isVisible,
        type: calendar.type,
        ics_url: calendar.icsUrl,
        last_sync: calendar.lastSync,
      }, encryptionKey),
      is_default: calendar.isDefault,
    }));

    const calendar_events = data.data.calendarEvents.map(event => {
      const recurrence_rule = event.recurrencePattern
        ? JSON.stringify({
            frequency: event.recurrencePattern.frequency,
            interval: event.recurrencePattern.interval,
            end_date: event.recurrencePattern.endDate,
            days_of_week: event.recurrencePattern.daysOfWeek,
          })
        : (event as any).recurrence_rule;

      return encryptItem({
        title: event.title,
        description: event.description,
        location: event.location,
        start_time: event.startTime,
        end_time: event.endTime,
        all_day: event.isAllDay,
        calendar_id: event.calendarId,
        recurrence_rule,
        recurrence_exception: event.recurrence_exception,
        is_group_event: event.is_group_event,
        is_task_reservation_space: event.is_task_reservation_space,
        parent_group_event_id: event.parent_group_event_id,
        task_id: event.task_id,
      }, encryptionKey);
    });

    const countdowns = (data.data.countdowns || []).map(countdown => ({
      ...encryptItem({
        target: countdown.target,
        task_id: countdown.task_id,
      }, encryptionKey),
      event_id: countdown.event_id,
    }));

    const user_settings = data.data.userSettings
      ? encryptItem(data.data.userSettings, encryptionKey)
      : undefined;

    // Convert to ExportedData format and delegate to main import
    const exportData: ExportedData = {
      version: data.version,
      timestamp: data.timestamp,
      userId: data.userId,
      data: {
        can_do_list: can_do_list as any,
        projects: projects as any,
        calendars: calendars as any,
        calendar_events: calendar_events as any,
        countdowns: countdowns as any,
        user_settings: user_settings as any,
      }
    };

    return importUserData(exportData);
  } catch (error) {
    console.error('Failed to import decrypted user data:', error);
    throw error;
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