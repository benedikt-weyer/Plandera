/**
 * Decrypted Backend Implementation
 * This class implements DecryptedBackendInterface by wrapping BackendInterface
 * and handling encryption/decryption automatically.
 */

import { DecryptedBackendInterface } from './decrypted-backend-interface';
import { BackendInterface } from './backend-interface';
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
  CreateCanDoItemDecryptedRequest,
  UpdateCanDoItemDecryptedRequest,
  CreateProjectDecryptedRequest,
  UpdateProjectDecryptedRequest,
  CreateCalendarDecryptedRequest,
  UpdateCalendarDecryptedRequest,
  CreateCalendarEventDecryptedRequest,
  UpdateCalendarEventDecryptedRequest,
  CreateCountdownDecryptedRequest,
  UpdateCountdownDecryptedRequest,
  CreateCanDoItemRequest,
  UpdateCanDoItemRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateCalendarRequest,
  UpdateCalendarRequest,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
  CreateCountdownRequest,
  UpdateCountdownRequest,
  RealtimeMessage,
  RealtimeSubscription,
  PaginatedResponse,
  ApiResponse,
  QueryOptions,
} from './types';
import {
  encryptData,
  decryptData,
  generateIV,
  generateSalt,
  deriveKeyFromPassword,
} from '../cryptography/encryption';

export class DecryptedBackendImpl implements DecryptedBackendInterface {
  constructor(
    private backend: BackendInterface,
    private encryptionKey: string
  ) {}

  // Helper methods for encryption/decryption
  private encryptItemData(data: any): { encrypted_data: string; iv: string; salt: string } {
    const salt = generateSalt();
    const iv = generateIV();
    const derivedKey = deriveKeyFromPassword(this.encryptionKey, salt);
    const encrypted_data = encryptData(data, derivedKey, iv);
    return { encrypted_data, iv, salt };
  }

  private decryptItemData<T>(encrypted: { encrypted_data: string; iv: string; salt: string }): T {
    const derivedKey = deriveKeyFromPassword(this.encryptionKey, encrypted.salt);
    return decryptData(encrypted.encrypted_data, derivedKey, encrypted.iv) as T;
  }

  private encryptSettings(data: UserSettingsDecrypted): { encrypted_data: string; iv: string; salt: string } {
    const salt = generateSalt();
    const iv = generateIV();
    const derivedKey = deriveKeyFromPassword(this.encryptionKey, salt);
    const encrypted_data = encryptData(data, derivedKey, iv);
    return { encrypted_data, iv, salt };
  }

  private decryptSettings(encrypted: { encrypted_data: string; iv: string; salt: string }): UserSettingsDecrypted {
    const derivedKey = deriveKeyFromPassword(this.encryptionKey, encrypted.salt);
    return decryptData(encrypted.encrypted_data, derivedKey, encrypted.iv) as UserSettingsDecrypted;
  }

  private decryptCanDoItem(encrypted: CanDoItemEncrypted): CanDoItemDecrypted {
    const decryptedData = this.decryptItemData<{
      content: string;
      completed: boolean;
      due_date?: string;
      impact?: number;
      urgency?: number;
      tags?: string[];
      duration_minutes?: number;
      blocked_by?: string;
      my_day?: boolean;
      parent_task_id?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      user_id: encrypted.user_id,
      project_id: encrypted.project_id,
      display_order: encrypted.display_order,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      ...decryptedData,
    };
  }

  private decryptProject(encrypted: ProjectEncrypted): ProjectDecrypted {
    const decryptedData = this.decryptItemData<{
      name: string;
      description?: string;
      color?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      parent_id: encrypted.parent_id,
      order: encrypted.display_order,
      collapsed: encrypted.is_collapsed,
      ...decryptedData,
    };
  }

  private decryptCalendar(encrypted: CalendarEncrypted): CalendarDecrypted {
    const decryptedData = this.decryptItemData<{
      name: string;
      color?: string;
      is_visible: boolean;
      type?: 'regular' | 'ics';
      ics_url?: string;
      last_sync?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      is_default: encrypted.is_default,
      ...decryptedData,
    };
  }

  private decryptCalendarEvent(encrypted: CalendarEventEncrypted): CalendarEventDecrypted {
    const decryptedData = this.decryptItemData<{
      title: string;
      description?: string;
      location?: string;
      start_time: string;
      end_time: string;
      all_day: boolean;
      calendar_id: string;
      recurrence_rule?: string;
      recurrence_exception?: string[];
      is_group_event?: boolean;
      is_task_reservation_space?: boolean;
      parent_group_event_id?: string;
      task_id?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      ...decryptedData,
    };
  }

  private decryptCountdown(encrypted: CountdownEncrypted): CountdownDecrypted {
    const decryptedData = this.decryptItemData<{
      target: 'start' | 'end';
      task_id?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      event_id: encrypted.event_id,
      ...decryptedData,
    };
  }

  // Can-do list methods implementation
  canDoList = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CanDoItemDecrypted>> => {
      const response = await this.backend.canDoList.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptCanDoItem(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CanDoItemDecrypted>> => {
      const response = await this.backend.canDoList.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCanDoItem(response.data) : null,
      };
    },

    create: async (request: CreateCanDoItemDecryptedRequest): Promise<ApiResponse<CanDoItemDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        content: request.content,
        completed: request.completed ?? false,
        due_date: request.due_date,
        impact: request.impact,
        urgency: request.urgency,
        tags: request.tags,
        duration_minutes: request.duration_minutes,
        blocked_by: request.blocked_by,
        my_day: request.my_day ?? false,
        parent_task_id: request.parent_task_id,
      });

      const encryptedRequest: CreateCanDoItemRequest = {
        project_id: request.project_id,
        display_order: request.display_order ?? 0,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.canDoList.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCanDoItem(response.data) : null,
      };
    },

    update: async (request: UpdateCanDoItemDecryptedRequest): Promise<ApiResponse<CanDoItemDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Check if any encrypted field is being updated (use 'in' operator to detect property presence)
      const hasEncryptedFieldUpdate = 
        'content' in request || 'completed' in request || 
        'due_date' in request || 'impact' in request || 
        'urgency' in request || 'tags' in request || 
        'duration_minutes' in request || 'blocked_by' in request || 
        'my_day' in request || 'parent_task_id' in request;

      if (hasEncryptedFieldUpdate) {
        // Get current data to merge with updates (preserves fields not being updated)
        const currentResponse = await this.backend.canDoList.getById(request.id);
        if (!currentResponse.data) {
          throw new Error('Task not found');
        }
        const currentData = this.decryptCanDoItem(currentResponse.data);
        
        // Merge current data with updates (PUT-style: use request value even if undefined to clear)
        const dataToEncrypt: any = {
          content: 'content' in request ? request.content : currentData.content,
          completed: 'completed' in request ? request.completed : currentData.completed,
          due_date: 'due_date' in request ? request.due_date : currentData.due_date,
          impact: 'impact' in request ? request.impact : currentData.impact,
          urgency: 'urgency' in request ? request.urgency : currentData.urgency,
          tags: 'tags' in request ? request.tags : currentData.tags,
          duration_minutes: 'duration_minutes' in request ? request.duration_minutes : currentData.duration_minutes,
          blocked_by: 'blocked_by' in request ? request.blocked_by : currentData.blocked_by,
          my_day: 'my_day' in request ? request.my_day : currentData.my_day,
          parent_task_id: 'parent_task_id' in request ? request.parent_task_id : currentData.parent_task_id,
        };
        
        const encrypted = this.encryptItemData(dataToEncrypt);
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCanDoItemRequest = {
        id: request.id,
        project_id: request.project_id,
        display_order: request.display_order,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.canDoList.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCanDoItem(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.canDoList.delete(id);
    },

    subscribe: (callback: (payload: RealtimeMessage<CanDoItemDecrypted>) => void): RealtimeSubscription => {
      // Subscribe to encrypted events and decrypt them
      return this.backend.canDoList.subscribe((payload: RealtimeMessage<CanDoItemEncrypted>) => {
        const decryptedPayload: RealtimeMessage<CanDoItemDecrypted> = {
          ...payload,
          new: payload.new ? this.decryptCanDoItem(payload.new) : undefined,
          old: payload.old ? this.decryptCanDoItem(payload.old) : undefined,
        };
        callback(decryptedPayload);
      });
    },
  };

  // Project methods implementation
  projects = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<ProjectDecrypted>> => {
      const response = await this.backend.projects.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptProject(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<ProjectDecrypted>> => {
      const response = await this.backend.projects.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptProject(response.data) : null,
      };
    },

    create: async (request: CreateProjectDecryptedRequest): Promise<ApiResponse<ProjectDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        name: request.name,
        description: request.description,
        color: request.color,
      });

      const encryptedRequest: CreateProjectRequest = {
        parent_id: request.parent_id,
        display_order: request.order ?? 0,
        is_collapsed: request.collapsed ?? false,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.projects.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptProject(response.data) : null,
      };
    },

    update: async (request: UpdateProjectDecryptedRequest): Promise<ApiResponse<ProjectDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Only encrypt if we have content to update
      if (request.name !== undefined || request.description !== undefined || request.color !== undefined) {
        const encrypted = this.encryptItemData({
          name: request.name,
          description: request.description,
          color: request.color,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateProjectRequest = {
        id: request.id,
        parent_id: request.parent_id,
        display_order: request.order,
        is_collapsed: request.collapsed,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.projects.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptProject(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.projects.delete(id);
    },

    subscribe: (callback: (payload: RealtimeMessage<ProjectDecrypted>) => void): RealtimeSubscription => {
      // Subscribe to encrypted events and decrypt them
      return this.backend.projects.subscribe((payload: RealtimeMessage<ProjectEncrypted>) => {
        const decryptedPayload: RealtimeMessage<ProjectDecrypted> = {
          ...payload,
          new: payload.new ? this.decryptProject(payload.new) : undefined,
          old: payload.old ? this.decryptProject(payload.old) : undefined,
        };
        callback(decryptedPayload);
      });
    },
  };

  // Calendar methods implementation
  calendars = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarDecrypted>> => {
      const response = await this.backend.calendars.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptCalendar(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CalendarDecrypted>> => {
      const response = await this.backend.calendars.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCalendar(response.data) : null,
      };
    },

    create: async (request: CreateCalendarDecryptedRequest): Promise<ApiResponse<CalendarDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        name: request.name,
        color: request.color,
        is_visible: request.is_visible ?? true,
        type: request.type ?? 'regular',
        ics_url: request.ics_url,
      });

      const encryptedRequest: CreateCalendarRequest = {
        is_default: request.is_default,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.calendars.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendar(response.data) : null,
      };
    },

    update: async (request: UpdateCalendarDecryptedRequest): Promise<ApiResponse<CalendarDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Only encrypt if we have content to update
      if (request.name !== undefined || request.color !== undefined || 
          request.is_visible !== undefined || request.type !== undefined || request.ics_url !== undefined) {
        const encrypted = this.encryptItemData({
          name: request.name,
          color: request.color,
          is_visible: request.is_visible,
          type: request.type,
          ics_url: request.ics_url,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCalendarRequest = {
        id: request.id,
        is_default: request.is_default,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.calendars.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendar(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.calendars.delete(id);
    },

    subscribe: (callback: (payload: RealtimeMessage<CalendarDecrypted>) => void): RealtimeSubscription => {
      // Subscribe to encrypted events and decrypt them
      return this.backend.calendars.subscribe((payload: RealtimeMessage<CalendarEncrypted>) => {
        const decryptedPayload: RealtimeMessage<CalendarDecrypted> = {
          ...payload,
          new: payload.new ? this.decryptCalendar(payload.new) : undefined,
          old: payload.old ? this.decryptCalendar(payload.old) : undefined,
        };
        callback(decryptedPayload);
      });
    },
  };

  // Calendar event methods implementation
  calendarEvents = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEventDecrypted>> => {
      const response = await this.backend.calendarEvents.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptCalendarEvent(item)),
      };
    },

    getByDateRange: async (
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEventDecrypted>> => {
      const response = await this.backend.calendarEvents.getByDateRange(startDate, endDate, calendarIds);
      return {
        ...response,
        data: response.data.map(item => this.decryptCalendarEvent(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CalendarEventDecrypted>> => {
      const response = await this.backend.calendarEvents.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCalendarEvent(response.data) : null,
      };
    },

    create: async (request: CreateCalendarEventDecryptedRequest): Promise<ApiResponse<CalendarEventDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        title: request.title,
        description: request.description,
        location: request.location,
        start_time: request.start_time,
        end_time: request.end_time,
        all_day: request.all_day ?? false,
        calendar_id: request.calendar_id,
        recurrence_rule: request.recurrence_rule,
        is_group_event: request.is_group_event,
        is_task_reservation_space: request.is_task_reservation_space,
        parent_group_event_id: request.parent_group_event_id,
        task_id: request.task_id,
      });

      const encryptedRequest: CreateCalendarEventRequest = {
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.calendarEvents.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendarEvent(response.data) : null,
      };
    },

    update: async (request: UpdateCalendarEventDecryptedRequest): Promise<ApiResponse<CalendarEventDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      const hasEncryptedFieldUpdate =
        'title' in request || 'description' in request ||
        'location' in request || 'start_time' in request ||
        'end_time' in request || 'all_day' in request ||
        'calendar_id' in request || 'recurrence_rule' in request ||
        'recurrence_exception' in request || 'is_group_event' in request ||
        'is_task_reservation_space' in request ||
        'parent_group_event_id' in request || 'task_id' in request;

      if (hasEncryptedFieldUpdate) {
        const currentResponse = await this.backend.calendarEvents.getById(request.id);
        if (!currentResponse.data) {
          throw new Error('Calendar event not found');
        }
        const currentData = this.decryptCalendarEvent(currentResponse.data);

        const encrypted = this.encryptItemData({
          title: 'title' in request ? request.title : currentData.title,
          description: 'description' in request ? request.description : currentData.description,
          location: 'location' in request ? request.location : currentData.location,
          start_time: 'start_time' in request ? request.start_time : currentData.start_time,
          end_time: 'end_time' in request ? request.end_time : currentData.end_time,
          all_day: 'all_day' in request ? request.all_day : currentData.all_day,
          calendar_id: 'calendar_id' in request ? request.calendar_id : currentData.calendar_id,
          recurrence_rule: 'recurrence_rule' in request ? request.recurrence_rule : currentData.recurrence_rule,
          recurrence_exception: 'recurrence_exception' in request ? request.recurrence_exception : currentData.recurrence_exception,
          is_group_event: 'is_group_event' in request ? request.is_group_event : currentData.is_group_event,
          is_task_reservation_space: 'is_task_reservation_space' in request
            ? request.is_task_reservation_space
            : currentData.is_task_reservation_space,
          parent_group_event_id: 'parent_group_event_id' in request ? request.parent_group_event_id : currentData.parent_group_event_id,
          task_id: 'task_id' in request ? request.task_id : currentData.task_id,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCalendarEventRequest = {
        id: request.id,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.calendarEvents.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendarEvent(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.calendarEvents.delete(id);
    },

    subscribe: (callback: (payload: RealtimeMessage<CalendarEventDecrypted>) => void): RealtimeSubscription => {
      // Subscribe to encrypted events and decrypt them
      return this.backend.calendarEvents.subscribe((payload: RealtimeMessage<CalendarEventEncrypted>) => {
        const decryptedPayload: RealtimeMessage<CalendarEventDecrypted> = {
          ...payload,
          new: payload.new ? this.decryptCalendarEvent(payload.new) : undefined,
          old: payload.old ? this.decryptCalendarEvent(payload.old) : undefined,
        };
        callback(decryptedPayload);
      });
    },
  };

  countdowns = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CountdownDecrypted>> => {
      const response = await this.backend.countdowns.getAll(options);
      return {
        ...response,
        data: response.data.map((item) => this.decryptCountdown(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CountdownDecrypted>> => {
      const response = await this.backend.countdowns.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCountdown(response.data) : null,
      };
    },

    create: async (request: CreateCountdownDecryptedRequest): Promise<ApiResponse<CountdownDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        target: request.target,
        task_id: request.task_id,
      });

      const encryptedRequest: CreateCountdownRequest = {
        event_id: request.event_id,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.countdowns.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCountdown(response.data) : null,
      };
    },

    update: async (request: UpdateCountdownDecryptedRequest): Promise<ApiResponse<CountdownDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      if (request.target !== undefined || 'task_id' in request) {
        const currentResponse = await this.backend.countdowns.getById(request.id);
        if (!currentResponse.data) {
          throw new Error('Countdown not found');
        }

        const currentData = this.decryptCountdown(currentResponse.data);
        const encrypted = this.encryptItemData({
          target: request.target ?? currentData.target,
          task_id: 'task_id' in request ? request.task_id : currentData.task_id,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCountdownRequest = {
        id: request.id,
        ...(request.event_id !== undefined && { event_id: request.event_id }),
        ...(encryptedData !== undefined && { encrypted_data: encryptedData }),
        ...(iv !== undefined && { iv }),
        ...(salt !== undefined && { salt }),
      };

      const response = await this.backend.countdowns.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCountdown(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.countdowns.delete(id);
    },

    subscribe: (callback: (payload: RealtimeMessage<CountdownDecrypted>) => void): RealtimeSubscription => {
      return this.backend.countdowns.subscribe((payload: RealtimeMessage<CountdownEncrypted>) => {
        const decryptedPayload: RealtimeMessage<CountdownDecrypted> = {
          ...payload,
          new: payload.new ? this.decryptCountdown(payload.new) : undefined,
          old: payload.old ? this.decryptCountdown(payload.old) : undefined,
        };
        callback(decryptedPayload);
      });
    },
  };

  userSettings = {
    get: async (): Promise<ApiResponse<UserSettingsDecrypted>> => {
      const response = await this.backend.userSettings.get();
      if (!response.data) {
        return response as ApiResponse<UserSettingsDecrypted>;
      }
      
      // Check if settings exist (empty iv/salt means no settings yet)
      if (!response.data.iv || !response.data.salt || response.data.iv === '' || response.data.salt === '') {
        // Return default settings if none exist
        return {
          data: {},
          error: null,
          status: 200,
        };
      }
      
      try {
        const decrypted = this.decryptSettings(response.data);
        return {
          ...response,
          data: decrypted,
        };
      } catch (error) {
        console.error('Failed to decrypt user settings:', error);
        // Return default settings if decryption fails
        return {
          data: {},
          error: null,
          status: 200,
        };
      }
    },

    update: async (settings: UserSettingsDecrypted): Promise<ApiResponse<UserSettingsDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptSettings(settings);
      
      const response = await this.backend.userSettings.update({ encrypted_data, iv, salt });
      if (!response.data) {
        return response as ApiResponse<UserSettingsDecrypted>;
      }
      
      const decrypted = this.decryptSettings(response.data);
      return {
        ...response,
        data: decrypted,
      };
    },
  };


  // Utility method to fix corrupted data in the database
  async fixCorruptedData(): Promise<{ calendarsFixed: number; eventsFixed: number }> {
    let calendarsFixed = 0;
    let eventsFixed = 0;

    try {
      // Fix calendars
      const calendarsResponse = await this.calendars.getAll();
      for (const calendar of calendarsResponse.data) {
        // Re-save the calendar to normalize the encrypted data
        await this.calendars.update({
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          is_visible: calendar.is_visible,
          type: calendar.type,
          ics_url: calendar.ics_url,
          last_sync: calendar.last_sync,
        });
        calendarsFixed++;
      }

      // Fix calendar events
      const eventsResponse = await this.calendarEvents.getAll();
      for (const event of eventsResponse.data) {
        // Re-save the event to normalize the encrypted data
        await this.calendarEvents.update({
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          start_time: event.start_time,
          end_time: event.end_time,
          all_day: event.all_day,
          calendar_id: event.calendar_id,
          recurrence_rule: event.recurrence_rule,
          recurrence_exception: event.recurrence_exception,
        });
        eventsFixed++;
      }

      console.log(`Data corruption fix completed: ${calendarsFixed} calendars, ${eventsFixed} events fixed`);
      return { calendarsFixed, eventsFixed };
    } catch (error) {
      console.error('Error fixing corrupted data:', error);
      throw error;
    }
  }
}
