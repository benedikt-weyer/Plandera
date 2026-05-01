/**
 * Implementation of BackendInterface that communicates with the Rust backend
 * using both HTTP requests and WebSocket connections
 */

import { BackendInterface } from './backend-interface';
import {
  AuthUser,
  AuthSession,
  AuthResponse,
  SignUpRequest,
  SignInRequest,
  ResetPasswordRequest,
  UpdatePasswordRequest,
  CanDoItemEncrypted,
  CreateCanDoItemRequest,
  UpdateCanDoItemRequest,
  ProjectEncrypted,
  CreateProjectRequest,
  UpdateProjectRequest,
  CalendarEncrypted,
  CreateCalendarRequest,
  UpdateCalendarRequest,
  CalendarEventEncrypted,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
  CountdownEncrypted,
  CreateCountdownRequest,
  UpdateCountdownRequest,
  UserSettingsEncrypted,
  RealtimeMessage,
  RealtimeSubscription,
  ApiResponse,
  PaginatedResponse,
  QueryOptions
} from './types';

interface WebSocketMessage {
  type?: 'subscription' | 'auth_change' | 'error' | 'auth_success' | 'auth_error';
  table?: string;
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  commit_timestamp?: string;
  new?: any;
  old?: any;
  error?: string;
  event?: string;
  session?: AuthSession | null;
  // Backend message format
  event_type?: string;
  user_id?: string;
  record_id?: string;
  data?: any;
  message?: string;
}

class RustBackendImpl implements BackendInterface {
  private baseUrl: string;
  private wsUrl: string;
  private runtimeConfigPromise: Promise<void> = Promise.resolve();
  private ws: WebSocket | null = null;
  private authToken: string | null = null;
  private connectionId: string | null = null;
  private subscriptions: Map<string, (payload: RealtimeMessage<any>) => void> = new Map();
  private authStateCallbacks: Set<(event: string, session: AuthSession | null) => void> = new Set();
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(baseUrl: string, wsUrl: string) {
    this.baseUrl = baseUrl;
    this.wsUrl = wsUrl;
    
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.restoreAuthToken();
      // Remove the async timeout - let components handle their own auth checks
    }
  }

  updateUrls(httpUrl: string, wsUrl: string): void {
    this.baseUrl = httpUrl;
    this.wsUrl = wsUrl;
  }

  setRuntimeConfigPromise(promise: Promise<void>): void {
    this.runtimeConfigPromise = promise;
  }

  private async ensureRuntimeConfigReady(): Promise<void> {
    await this.runtimeConfigPromise;
  }

  private restoreAuthToken(): void {
    // Try localStorage first
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        console.log('[RustBackend] Auth token restored from localStorage');
        this.authToken = token;
        // Initialize WebSocket connection now that we have a token
        if (!this.ws && typeof window !== 'undefined') {
          console.log('[RustBackend] Initializing WebSocket after token restore');
          this.initWebSocket();
        }
        return;
      }
    } catch (e) {
      // localStorage might not be available in SSR
      console.warn('[RustBackend] localStorage not available:', e);
    }

    // Try cookies as fallback
    try {
      const match = document.cookie.match(/auth_token=([^;]+)/);
      if (match) {
        console.log('[RustBackend] Auth token restored from cookies');
        this.authToken = match[1];
        // Initialize WebSocket connection now that we have a token
        if (!this.ws && typeof window !== 'undefined') {
          console.log('[RustBackend] Initializing WebSocket after token restore from cookies');
          this.initWebSocket();
        }
      }
    } catch (e) {
      // document might not be available in SSR
      console.warn('[RustBackend] Cookies not available:', e);
    }
    
    if (!this.authToken) {
      console.log('[RustBackend] No auth token found in storage');
    }
  }

  private storeAuthToken(token: string): void {
    this.authToken = token;
    
    try {
      localStorage.setItem('auth_token', token);
    } catch (e) {
      // Fallback to cookies if localStorage fails
      document.cookie = `auth_token=${token};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict`;
    }
    
    // Initialize WebSocket connection now that we have a token
    if (!this.ws && typeof window !== 'undefined') {
      this.initWebSocket();
    }
  }

  private clearAuthToken(): void {
    this.authToken = null;
    this.connectionId = null;
    
    try {
      localStorage.removeItem('auth_token');
    } catch (e) {
      // Clear cookie as fallback
      document.cookie = 'auth_token=;path=/;max-age=0';
    }
    
    // Close WebSocket connection when token is cleared
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureRuntimeConfigReady();

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Include connection ID to prevent receiving our own updates via WebSocket
    if (this.connectionId) {
      headers['X-Connection-Id'] = this.connectionId;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private async initWebSocket(): Promise<void> {
    if (typeof window === 'undefined') {
      console.log('[RustBackend] Skipping WebSocket in SSR');
      return;
    }

    await this.ensureRuntimeConfigReady();

    // Don't connect if we don't have an auth token
    if (!this.authToken) {
      console.log('[RustBackend] No auth token available, skipping WebSocket connection');
      return;
    }

    // Don't create multiple connections
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log('[RustBackend] WebSocket already connecting, skipping');
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[RustBackend] WebSocket already connected, skipping');
      return;
    }

    try {
      const wsUrl = `${this.wsUrl}/ws`;
      console.log('[RustBackend] Attempting to connect to WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[RustBackend] WebSocket connected, sending auth token');
        this.wsReconnectAttempts = 0;
        
        // Send auth token immediately (required by backend)
        if (this.authToken) {
          this.ws?.send(JSON.stringify({
            token: this.authToken
          }));
        } else {
          console.warn('[RustBackend] No auth token available for WebSocket auth');
          this.ws?.close();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[RustBackend] Received WebSocket message:', message);
          
          // Handle auth responses
          if (message.type === 'auth_success') {
            console.log('[RustBackend] WebSocket authentication successful');
          } else if (message.type === 'auth_error') {
            console.error('[RustBackend] WebSocket authentication failed:', message.message);
            this.ws?.close();
            return;
          }
          
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[RustBackend] Failed to parse WebSocket message:', error, 'Raw data:', event.data);
        }
      };

      this.ws.onclose = () => {
        console.log('[RustBackend] WebSocket disconnected');
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[RustBackend] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[RustBackend] Failed to initialize WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RustBackend] Max WebSocket reconnection attempts reached');
      return;
    }

    this.wsReconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);
    
    setTimeout(() => {
      console.log(`[RustBackend] Attempting WebSocket reconnection (${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`);
      this.initWebSocket();
    }, delay);
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    // Handle auth responses first
    if (message.type === 'auth_success') {
      console.log('[RustBackend] WebSocket authentication successful');
      // Store connection ID to exclude self from broadcasts
      if ((message as any).connection_id) {
        this.connectionId = (message as any).connection_id;
        console.log('[RustBackend] Connection ID stored:', this.connectionId);
      }
      return;
    } else if (message.type === 'auth_error') {
      console.error('[RustBackend] WebSocket authentication failed:', message.message);
      this.ws?.close();
      return;
    }

    // Handle backend message format (data change notifications)
    if (message.event_type && message.table) {
      console.log(`[RustBackend] Processing ${message.event_type} event for table ${message.table}`);
      const callback = this.subscriptions.get(message.table);
      if (callback) {
        console.log(`[RustBackend] Found subscription callback for table ${message.table}`);
        const realtimeMessage: RealtimeMessage = {
          eventType: message.event_type as 'INSERT' | 'UPDATE' | 'DELETE',
          schema: 'public',
          table: message.table,
          commit_timestamp: new Date().toISOString(),
          new: message.event_type === 'DELETE' ? undefined : message.data,
          old: message.event_type === 'DELETE' ? message.data : undefined,
        };
        console.log(`[RustBackend] Calling subscription callback with:`, realtimeMessage);
        callback(realtimeMessage);
      } else {
        console.warn(`[RustBackend] No subscription callback found for table ${message.table}`);
        console.log(`[RustBackend] Available subscriptions:`, Array.from(this.subscriptions.keys()));
      }
      return;
    }

    // Handle legacy message format
    switch (message.type) {
      case 'subscription':
        if (message.table && message.eventType) {
          const callback = this.subscriptions.get(message.table);
          if (callback) {
            const realtimeMessage: RealtimeMessage = {
              eventType: message.eventType,
              schema: message.schema || 'public',
              table: message.table,
              commit_timestamp: message.commit_timestamp || new Date().toISOString(),
              new: message.new,
              old: message.old,
            };
            callback(realtimeMessage);
          }
        }
        break;
        
      case 'auth_change':
        if (message.event) {
          this.authStateCallbacks.forEach(callback => {
            callback(message.event!, message.session || null);
          });
        }
        break;
        
      case 'error':
        console.error('[RustBackend] WebSocket error:', message.error);
        break;
    }
  }

  private subscribe(table: string, callback: (payload: RealtimeMessage<any>) => void): RealtimeSubscription {
    const id = `${table}_${Date.now()}_${Math.random()}`;
    this.subscriptions.set(table, callback);
    
    // Send subscription message to WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        table: table
      }));
    }

    return {
      id,
      unsubscribe: () => {
        this.subscriptions.delete(table);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'unsubscribe',
            table: table
          }));
        }
      }
    };
  }

  // Authentication methods
  auth = {
    signUp: async (request: SignUpRequest): Promise<AuthResponse> => {
      try {
        const response = await this.makeRequest<any>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        
        // Handle the backend's response format
        if (response.data?.access_token) {
          this.storeAuthToken(response.data.access_token);
          return {
            session: {
              user: response.data.user,
              access_token: response.data.access_token,
              refresh_token: undefined,
              expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            },
            user: response.data.user,
            error: null
          };
        }
        
        return { session: null, user: null, error: null };
      } catch (error) {
        return { 
          session: null, 
          user: null, 
          error: error instanceof Error ? error.message : 'Sign up failed' 
        };
      }
    },

    signIn: async (request: SignInRequest): Promise<AuthResponse> => {
      try {
        const response = await this.makeRequest<any>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        
        // Handle the backend's response format
        if (response.data?.access_token) {
          this.storeAuthToken(response.data.access_token);
          
          const authResult = {
            session: {
              user: response.data.user,
              access_token: response.data.access_token,
              refresh_token: undefined,
              expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            },
            user: response.data.user,
            error: null
          };
          
          // Trigger auth state change
          this.authStateCallbacks.forEach(callback => {
            callback('SIGNED_IN', authResult.session);
          });
          
          return authResult;
        }
        
        return { session: null, user: null, error: 'Invalid credentials' };
      } catch (error) {
        return { 
          session: null, 
          user: null, 
          error: error instanceof Error ? error.message : 'Sign in failed' 
        };
      }
    },

    signOut: async (): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest('/api/auth/logout', {
          method: 'POST',
        });
        this.clearAuthToken();
        
        // Trigger auth state change
        this.authStateCallbacks.forEach(callback => {
          callback('SIGNED_OUT', null);
        });
        
        return { error: null };
      } catch (error) {
        this.clearAuthToken(); // Clear token even if request fails
        
        // Trigger auth state change even if logout request fails
        this.authStateCallbacks.forEach(callback => {
          callback('SIGNED_OUT', null);
        });
        
        return { error: error instanceof Error ? error.message : 'Sign out failed' };
      }
    },

    getSession: async (): Promise<{ data: { session: AuthSession | null }, error: string | null }> => {
      try {
        // Since /api/auth/session doesn't exist, we'll construct a session from the current user
        if (this.authToken) {
          const { data: { user }, error } = await this.auth.getUser();
          if (user && !error) {
            const session: AuthSession = {
              user: user,
              access_token: this.authToken,
              refresh_token: undefined,
              expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            };
            return { data: { session }, error: null };
          }
        }
        return { data: { session: null }, error: null };
      } catch (error) {
        return { 
          data: { session: null }, 
          error: error instanceof Error ? error.message : 'Failed to get session' 
        };
      }
    },

    getUser: async (): Promise<{ data: { user: AuthUser | null }, error: string | null }> => {
      try {
        const response = await this.makeRequest<{ data: AuthUser | null }>('/api/auth/me');
        
        // The backend returns user data directly in response.data, not response.data.user
        const user = response.data;
        
        // If we have a valid user and token, trigger SIGNED_IN event for consistency
        if (user && this.authToken) {
          const session: AuthSession = {
            user: user,
            access_token: this.authToken,
            refresh_token: undefined,
            expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
          };
          
          this.authStateCallbacks.forEach(callback => {
            callback('SIGNED_IN', session);
          });
        }
        
        return { data: { user }, error: null };
      } catch (error) {
        // If token is invalid, clear it
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
          this.clearAuthToken();
          // Trigger SIGNED_OUT event
          this.authStateCallbacks.forEach(callback => {
            callback('SIGNED_OUT', null);
          });
        }
        return { 
          data: { user: null }, 
          error: error instanceof Error ? error.message : 'Failed to get user' 
        };
      }
    },

    updatePassword: async (request: UpdatePasswordRequest): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest('/api/auth/update-password', {
          method: 'PUT',
          body: JSON.stringify(request),
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to update password' };
      }
    },

    resetPasswordForEmail: async (request: ResetPasswordRequest): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to reset password' };
      }
    },

    onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => {
      this.authStateCallbacks.add(callback);
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authStateCallbacks.delete(callback);
            }
          }
        }
      };
    }
  };

  // Can-do list methods
  canDoList = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CanDoItemEncrypted>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<CanDoItemEncrypted>>(`/api/can-do-list?${params}`);
    },

    // Alias for getAll to match the expected interface
    list: async (options?: QueryOptions): Promise<PaginatedResponse<CanDoItemEncrypted>> => {
      return this.canDoList.getAll(options);
    },

    getById: async (id: string): Promise<ApiResponse<CanDoItemEncrypted>> => {
      return this.makeRequest<ApiResponse<CanDoItemEncrypted>>(`/api/can-do-list/${id}`);
    },

    create: async (request: CreateCanDoItemRequest): Promise<ApiResponse<CanDoItemEncrypted>> => {
      return this.makeRequest<ApiResponse<CanDoItemEncrypted>>('/api/can-do-list', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCanDoItemRequest): Promise<ApiResponse<CanDoItemEncrypted>> => {
      return this.makeRequest<ApiResponse<CanDoItemEncrypted>>(`/api/can-do-list/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/can-do-list/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete item' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<CanDoItemEncrypted>) => void): RealtimeSubscription => {
      return this.subscribe('can_do_list', callback);
    }
  };

  // Project methods
  projects = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<ProjectEncrypted>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.all) params.append('all', 'true');
      
      return this.makeRequest<PaginatedResponse<ProjectEncrypted>>(`/api/projects?${params}`);
    },

    // Alias for getAll to match the expected interface
    list: async (options?: QueryOptions): Promise<PaginatedResponse<ProjectEncrypted>> => {
      return this.projects.getAll(options);
    },

    getById: async (id: string): Promise<ApiResponse<ProjectEncrypted>> => {
      return this.makeRequest<ApiResponse<ProjectEncrypted>>(`/api/projects/${id}`);
    },

    create: async (request: CreateProjectRequest): Promise<ApiResponse<ProjectEncrypted>> => {
      return this.makeRequest<ApiResponse<ProjectEncrypted>>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateProjectRequest): Promise<ApiResponse<ProjectEncrypted>> => {
      return this.makeRequest<ApiResponse<ProjectEncrypted>>(`/api/projects/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/projects/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete project' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<ProjectEncrypted>) => void): RealtimeSubscription => {
      return this.subscribe('projects', callback);
    }
  };

  // Calendar methods
  calendars = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEncrypted>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<CalendarEncrypted>>(`/api/calendars?${params}`);
    },

    // Alias for getAll to match the expected interface
    list: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEncrypted>> => {
      return this.calendars.getAll(options);
    },

    getById: async (id: string): Promise<ApiResponse<CalendarEncrypted>> => {
      return this.makeRequest<ApiResponse<CalendarEncrypted>>(`/api/calendars/${id}`);
    },

    create: async (request: CreateCalendarRequest): Promise<ApiResponse<CalendarEncrypted>> => {
      return this.makeRequest<ApiResponse<CalendarEncrypted>>('/api/calendars', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCalendarRequest): Promise<ApiResponse<CalendarEncrypted>> => {
      return this.makeRequest<ApiResponse<CalendarEncrypted>>(`/api/calendars/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/calendars/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete calendar' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<CalendarEncrypted>) => void): RealtimeSubscription => {
      return this.subscribe('calendars', callback);
    }
  };

  // Calendar event methods
  calendarEvents = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEventEncrypted>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<CalendarEventEncrypted>>(`/api/calendar-events?${params}`);
    },

    // Alias for getAll to match the expected interface
    list: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEventEncrypted>> => {
      return this.calendarEvents.getAll(options);
    },

    getByDateRange: async (
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEventEncrypted>> => {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      if (calendarIds?.length) {
        params.append('calendar_ids', calendarIds.join(','));
      }
      
      return this.makeRequest<PaginatedResponse<CalendarEventEncrypted>>(`/api/calendar-events/range?${params}`);
    },

    getById: async (id: string): Promise<ApiResponse<CalendarEventEncrypted>> => {
      return this.makeRequest<ApiResponse<CalendarEventEncrypted>>(`/api/calendar-events/${id}`);
    },

    create: async (request: CreateCalendarEventRequest): Promise<ApiResponse<CalendarEventEncrypted>> => {
      return this.makeRequest<ApiResponse<CalendarEventEncrypted>>('/api/calendar-events', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCalendarEventRequest): Promise<ApiResponse<CalendarEventEncrypted>> => {
      return this.makeRequest<ApiResponse<CalendarEventEncrypted>>(`/api/calendar-events/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/calendar-events/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete event' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<CalendarEventEncrypted>) => void): RealtimeSubscription => {
      return this.subscribe('calendar_events', callback);
    }
  };

  countdowns = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CountdownEncrypted>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      return this.makeRequest<PaginatedResponse<CountdownEncrypted>>(`/api/countdowns?${params}`);
    },

    getById: async (id: string): Promise<ApiResponse<CountdownEncrypted>> => {
      return this.makeRequest<ApiResponse<CountdownEncrypted>>(`/api/countdowns/${id}`);
    },

    create: async (request: CreateCountdownRequest): Promise<ApiResponse<CountdownEncrypted>> => {
      return this.makeRequest<ApiResponse<CountdownEncrypted>>('/api/countdowns', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCountdownRequest): Promise<ApiResponse<CountdownEncrypted>> => {
      return this.makeRequest<ApiResponse<CountdownEncrypted>>(`/api/countdowns/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/countdowns/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete countdown' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<CountdownEncrypted>) => void): RealtimeSubscription => {
      return this.subscribe('countdowns', callback);
    },
  };

  // User Settings methods
  userSettings = {
    get: async (): Promise<ApiResponse<UserSettingsEncrypted>> => {
      return this.makeRequest<ApiResponse<UserSettingsEncrypted>>('/api/user-settings');
    },

    update: async (request: UserSettingsEncrypted): Promise<ApiResponse<UserSettingsEncrypted>> => {
      return this.makeRequest<ApiResponse<UserSettingsEncrypted>>('/api/user-settings', {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },
  };

  // Data management methods
  dataManagement = {
    exportUserData: async (): Promise<any> => {
      // Get user info
      const { data: { user } } = await this.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch all user data
      const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
        this.canDoList.getAll(),
        this.projects.getAll({ all: true }), // Get all projects including children
        this.calendars.getAll(),
        this.calendarEvents.getAll(),
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
        },
      };
    },

    importUserData: async (data: any): Promise<void> => {
      // Import in the correct order (projects first, then tasks that reference them)
      
      // Import projects
      if (data.data?.projects) {
        for (const project of data.data.projects) {
          await this.projects.create({
            encrypted_data: project.encrypted_data,
            iv: project.iv,
            salt: project.salt,
            parent_id: project.parent_id,
            display_order: project.display_order || project.order || 0,
            is_collapsed: project.is_collapsed || project.collapsed || false,
          });
        }
      }

      // Import can-do list items
      if (data.data?.can_do_list) {
        for (const task of data.data.can_do_list) {
          await this.canDoList.create({
            encrypted_data: task.encrypted_data,
            iv: task.iv,
            salt: task.salt,
            project_id: task.project_id,
            display_order: task.display_order || task.order || 0,
          });
        }
      }

      // Import calendars
      if (data.data?.calendars) {
        for (const calendar of data.data.calendars) {
          await this.calendars.create({
            encrypted_data: calendar.encrypted_data || JSON.stringify(calendar),
            iv: calendar.iv || 'placeholder_iv',
            salt: calendar.salt || 'placeholder_salt',
            is_default: calendar.is_default || false,
          });
        }
      }

      // Import calendar events
      if (data.data?.calendar_events) {
        for (const event of data.data.calendar_events) {
          await this.calendarEvents.create({
            encrypted_data: event.encrypted_data,
            iv: event.iv,
            salt: event.salt,
          });
        }
      }
    },

    clearAllUserData: async (): Promise<void> => {
      // Get all data first
      const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
        this.canDoList.getAll(),
        this.projects.getAll({ all: true }), // Get all projects including children
        this.calendars.getAll(),
        this.calendarEvents.getAll(),
      ]);

      // Delete in reverse order (children first, then parents)
      
      // Delete calendar events
      if (calendarEventsResult.data) {
        for (const event of calendarEventsResult.data) {
          await this.calendarEvents.delete(event.id);
        }
      }

      // Delete calendars
      if (calendarsResult.data) {
        for (const calendar of calendarsResult.data) {
          await this.calendars.delete(calendar.id);
        }
      }

      // Delete can-do list items
      if (canDoListResult.data) {
        for (const task of canDoListResult.data) {
          await this.canDoList.delete(task.id);
        }
      }

      // Delete projects
      if (projectsResult.data) {
        for (const project of projectsResult.data) {
          await this.projects.delete(project.id);
        }
      }
    }
  };
}

export default RustBackendImpl;
