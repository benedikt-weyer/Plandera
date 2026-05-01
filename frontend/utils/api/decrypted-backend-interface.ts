/**
 * Decrypted Backend Interface
 * This interface provides the same API as BackendInterface but works with decrypted data types.
 * It acts as a middleware layer that handles encryption/decryption automatically.
 */

import {
  CanDoItemDecrypted,
  ProjectDecrypted,
  CalendarDecrypted,
  CalendarEventDecrypted,
  CountdownDecrypted,
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
  RealtimeMessage,
  RealtimeSubscription,
  PaginatedResponse,
  ApiResponse,
  QueryOptions,
} from './types';

export interface DecryptedBackendInterface {
  // Can-do list methods
  canDoList: {
    /**
     * Get all can-do items for the current user (decrypted)
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CanDoItemDecrypted>>;

    /**
     * Get a single can-do item by ID (decrypted)
     */
    getById(id: string): Promise<ApiResponse<CanDoItemDecrypted>>;

    /**
     * Create a new can-do item with decrypted data
     */
    create(request: CreateCanDoItemDecryptedRequest): Promise<ApiResponse<CanDoItemDecrypted>>;

    /**
     * Update an existing can-do item with decrypted data
     */
    update(request: UpdateCanDoItemDecryptedRequest): Promise<ApiResponse<CanDoItemDecrypted>>;

    /**
     * Delete a can-do item
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for can-do items (decrypted)
     */
    subscribe(callback: (payload: RealtimeMessage<CanDoItemDecrypted>) => void): RealtimeSubscription;
  };

  // Project methods
  projects: {
    /**
     * Get all projects for the current user (decrypted)
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<ProjectDecrypted>>;

    /**
     * Get a single project by ID (decrypted)
     */
    getById(id: string): Promise<ApiResponse<ProjectDecrypted>>;

    /**
     * Create a new project with decrypted data
     */
    create(request: CreateProjectDecryptedRequest): Promise<ApiResponse<ProjectDecrypted>>;

    /**
     * Update an existing project with decrypted data
     */
    update(request: UpdateProjectDecryptedRequest): Promise<ApiResponse<ProjectDecrypted>>;

    /**
     * Delete a project
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for projects (decrypted)
     */
    subscribe(callback: (payload: RealtimeMessage<ProjectDecrypted>) => void): RealtimeSubscription;
  };

  // Calendar methods
  calendars: {
    /**
     * Get all calendars for the current user (decrypted)
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CalendarDecrypted>>;

    /**
     * Get a single calendar by ID (decrypted)
     */
    getById(id: string): Promise<ApiResponse<CalendarDecrypted>>;

    /**
     * Create a new calendar with decrypted data
     */
    create(request: CreateCalendarDecryptedRequest): Promise<ApiResponse<CalendarDecrypted>>;

    /**
     * Update an existing calendar with decrypted data
     */
    update(request: UpdateCalendarDecryptedRequest): Promise<ApiResponse<CalendarDecrypted>>;

    /**
     * Delete a calendar
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for calendars (decrypted)
     */
    subscribe(callback: (payload: RealtimeMessage<CalendarDecrypted>) => void): RealtimeSubscription;
  };

  // Calendar event methods
  calendarEvents: {
    /**
     * Get all calendar events for the current user (decrypted)
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CalendarEventDecrypted>>;

    /**
     * Get calendar events within a date range (decrypted)
     */
    getByDateRange(
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEventDecrypted>>;

    /**
     * Get a single calendar event by ID (decrypted)
     */
    getById(id: string): Promise<ApiResponse<CalendarEventDecrypted>>;

    /**
     * Create a new calendar event with decrypted data  
     */
    create(request: CreateCalendarEventDecryptedRequest): Promise<ApiResponse<CalendarEventDecrypted>>;

    /**
     * Update an existing calendar event with decrypted data
     */
    update(request: UpdateCalendarEventDecryptedRequest): Promise<ApiResponse<CalendarEventDecrypted>>;

    /**
     * Delete a calendar event
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for calendar events (decrypted)
     */
    subscribe(callback: (payload: RealtimeMessage<CalendarEventDecrypted>) => void): RealtimeSubscription;
  };

  countdowns: {
    /**
     * Get all countdowns for the current user (decrypted)
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CountdownDecrypted>>;

    /**
     * Get a single countdown by ID (decrypted)
     */
    getById(id: string): Promise<ApiResponse<CountdownDecrypted>>;

    /**
     * Create a new countdown with decrypted data
     */
    create(request: CreateCountdownDecryptedRequest): Promise<ApiResponse<CountdownDecrypted>>;

    /**
     * Update an existing countdown with decrypted data
     */
    update(request: UpdateCountdownDecryptedRequest): Promise<ApiResponse<CountdownDecrypted>>;

    /**
     * Delete a countdown
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for countdowns (decrypted)
     */
    subscribe(callback: (payload: RealtimeMessage<CountdownDecrypted>) => void): RealtimeSubscription;
  };

  // User Settings methods
  userSettings: {
    /**
     * Get user settings (decrypted)
     */
    get(): Promise<ApiResponse<UserSettingsDecrypted>>;

    /**
     * Update user settings with decrypted data
     */
    update(settings: UserSettingsDecrypted): Promise<ApiResponse<UserSettingsDecrypted>>;
  };
}
