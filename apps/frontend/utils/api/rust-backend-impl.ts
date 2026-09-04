/**
 * Implementation of BackendInterface that communicates with the Rust backend
 * using both HTTP requests and WebSocket connections
 */

import { BackendInterface } from './backend-interface';
import {
  createApiToken,
  createPasswordSalt,
  deriveApiTokenCredentials,
  deriveCredentials,
  deriveKekKeyPair,
  getStoredCryptKey,
  storeCryptKey,
  clearStoredCryptKey,
  rewrapDekForRecipient,
  type CryptKey,
} from '../cryptography/encryption';
import {
  AuthUser,
  AuthSession,
  AuthResponse,
  ApiUser,
  KekMetadata,
  LinkedPrincipal,
  PrincipalSummary,
  WrappedDekPayload,
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
  UpdateUserSettingsRequest,
  RealtimeMessage,
  RealtimeSubscription,
  ApiResponse,
  PaginatedResponse,
  QueryOptions
} from './types';

interface AuthSessionApiShape {
  currentPrincipal: PrincipalSummary;
  kekMetadatas: KekMetadata[];
  linkedPrincipals: LinkedPrincipal[];
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
}

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
  private refreshToken: string | null = null;
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
        this.refreshToken = localStorage.getItem('refresh_token');
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

  private storeAuthToken(token: string, refreshToken?: string): void {
    this.authToken = token;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }

    try {
      localStorage.setItem('auth_token', token);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
    } catch (e) {
      // Fallback to cookies if localStorage fails
      document.cookie = `auth_token=${token};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict`;
    }

    // Initialize WebSocket connection now that we have a token
    if (!this.ws && typeof window !== 'undefined') {
      this.initWebSocket();
    }
  }

  private storeSession(session: AuthSession): void {
    try {
      localStorage.setItem('auth_session', JSON.stringify(session));
    } catch (e) {
      // Ignore persistence failures — the session still lives in memory.
    }
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem('auth_session');
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch (e) {
      return null;
    }
  }

  private clearAuthToken(): void {
    this.authToken = null;
    this.refreshToken = null;
    this.connectionId = null;

    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_session');
    } catch (e) {
      // Clear cookie as fallback
      document.cookie = 'auth_token=;path=/;max-age=0';
    }
    clearStoredCryptKey();

    // Close WebSocket connection when token is cleared
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private refreshPromise: Promise<boolean> | null = null;

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
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

    // The 15-minute access token expired mid-session — use the refresh
    // token to get a new one and retry, exactly once, before giving up.
    if (
      response.status === 401 &&
      !isRetry &&
      this.refreshToken &&
      endpoint !== '/api/auth/refresh'
    ) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.makeRequest<T>(endpoint, options, true);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /** Coalesces concurrent 401s into a single refresh call. */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.refreshToken }),
          });

          if (!response.ok) {
            this.clearAuthToken();
            this.authStateCallbacks.forEach((callback) => callback('SIGNED_OUT', null));
            return false;
          }

          const body: { data: AuthSessionApiShape } = await response.json();
          const session = this.buildSession(body.data);
          this.storeAuthToken(session.access_token, session.refresh_token);
          this.storeSession(session);
          return true;
        } catch {
          return false;
        } finally {
          this.refreshPromise = null;
        }
      })();
    }

    return this.refreshPromise;
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
        const saltHex = await createPasswordSalt();
        const credentials = await deriveCredentials(request.email, request.password, saltHex);
        const kekKeyPair = await deriveKekKeyPair(credentials.cryptKey);

        const response = await this.makeRequest<{ data: AuthSessionApiShape }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: credentials.email,
            authKey: credentials.authKey,
            kekPublicKey: kekKeyPair.kekPublicKey,
            saltHex,
          }),
        });

        const session = this.buildSession(response.data);
        this.storeAuthToken(session.access_token, session.refresh_token);
        storeCryptKey(credentials.cryptKey);
        this.storeSession(session);

        return { session, user: session.user, error: null };
      } catch (error) {
        return {
          session: null,
          user: null,
          error: error instanceof Error ? error.message : 'Sign up failed',
        };
      }
    },

    signIn: async (request: SignInRequest): Promise<AuthResponse> => {
      try {
        const saltResponse = await this.makeRequest<{ data: { saltHex: string } }>('/api/auth/salt', {
          method: 'POST',
          body: JSON.stringify({ email: request.email }),
        });

        const credentials = await deriveCredentials(request.email, request.password, saltResponse.data.saltHex);

        const response = await this.makeRequest<{ data: AuthSessionApiShape }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: credentials.email,
            authKey: credentials.authKey,
          }),
        });

        const session = this.buildSession(response.data);
        this.storeAuthToken(session.access_token, session.refresh_token);
        storeCryptKey(credentials.cryptKey);
        this.storeSession(session);

        this.authStateCallbacks.forEach((callback) => callback('SIGNED_IN', session));

        return { session, user: session.user, error: null };
      } catch (error) {
        return {
          session: null,
          user: null,
          error: error instanceof Error ? error.message : 'Sign in failed',
        };
      }
    },

    signOut: async (): Promise<{ error: string | null }> => {
      this.clearAuthToken();
      this.authStateCallbacks.forEach((callback) => callback('SIGNED_OUT', null));
      return { error: null };
    },

    getSession: async (): Promise<{ data: { session: AuthSession | null }, error: string | null }> => {
      if (!this.authToken) {
        return { data: { session: null }, error: null };
      }
      const session = this.readStoredSession();
      return { data: { session }, error: null };
    },

    getUser: async (): Promise<{ data: { user: AuthUser | null }, error: string | null }> => {
      const { data } = await this.auth.getSession();
      return { data: { user: data.session?.user ?? null }, error: null };
    },

    updatePassword: async (request: UpdatePasswordRequest): Promise<{ error: string | null }> => {
      try {
        const session = this.readStoredSession();
        if (!session) {
          return { error: 'Not signed in' };
        }
        // The account's auth_salt is fixed at registration and never
        // rotates — always re-derive against the salt the server has on
        // file, never a freshly generated one.
        const oldCryptKey = getStoredCryptKey();
        if (!oldCryptKey) {
          return { error: 'Missing local encryption key' };
        }
        const saltResponse = await this.makeRequest<{ data: { saltHex: string } }>('/api/auth/salt', {
          method: 'POST',
          body: JSON.stringify({ email: session.user.email }),
        });

        const newCredentials = await deriveCredentials(session.user.email, request.password, saltResponse.data.saltHex);
        const newKekKeyPair = await deriveKekKeyPair(newCredentials.cryptKey);

        const response = await this.makeRequest<{ data: AuthSessionApiShape }>('/api/auth/rotate-password', {
          method: 'POST',
          body: JSON.stringify({
            kekPublicKey: newKekKeyPair.kekPublicKey,
            newAuthKey: newCredentials.authKey,
          }),
        });

        // The KEK keypair is derived deterministically from the crypt key,
        // so every record still wrapped for the *old* KEK becomes
        // unreadable the moment the old crypt key is gone — migrate them
        // to the new KEK first, while we still have the old key in hand.
        await this.migrateOwnedDeksToKek(oldCryptKey, session.currentPrincipal.id, newKekKeyPair.kekPublicKey);

        const newSession = this.buildSession(response.data);
        this.storeAuthToken(newSession.access_token, newSession.refresh_token);
        storeCryptKey(newCredentials.cryptKey);
        this.storeSession(newSession);

        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to update password' };
      }
    },

    resetPasswordForEmail: async (_request: ResetPasswordRequest): Promise<{ error: string | null }> => {
      // Zero-knowledge accounts have no server-recoverable password: losing
      // the master password means losing access. Nothing to send here.
      return { error: 'Password reset is not available — the master password cannot be recovered.' };
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
    },

    /**
     * Re-fetches this account's linked principals (owner + every api user)
     * and updates the stored session in place — needed after creating or
     * deleting an api user, so this tab's `recipients` map (who new/edited
     * records get wrapped for) picks up the change without a full re-login.
     */
    refreshLinkedPrincipals: async (): Promise<LinkedPrincipal[]> => {
      const response = await this.makeRequest<{ data: LinkedPrincipal[] }>('/api/auth/linked-principals');
      const session = this.readStoredSession();
      if (session) {
        this.storeSession({ ...session, linkedPrincipals: response.data });
      }
      return response.data;
    },
  };

  /**
   * Rewraps every resource this account currently owns from `oldCryptKey`'s
   * KEK to `newKekPublicKey`, sending each as a wraps-only update (no
   * ciphertext fields) so it merges rather than disturbing any other
   * principal's (e.g. an api user's) existing wrap of the same resource.
   * The DEK itself and the payload ciphertext are untouched — only who can
   * unwrap the DEK changes.
   */
  private async migrateOwnedDeksToKek(oldCryptKey: CryptKey, ownerId: string, newKekPublicKey: string): Promise<void> {
    const [canDoItems, projects, calendars, calendarEvents, countdowns, userSettings] = await Promise.all([
      this.canDoList.getAll(),
      this.projects.getAll({ all: true }),
      this.calendars.getAll(),
      this.calendarEvents.getAll(),
      this.countdowns.getAll(),
      this.userSettings.get(),
    ]);

    const rewrapAndUpdate = async (
      record: { id: string; wrapped_dek?: WrappedDekPayload; algorithm: string; ciphertext_hex: string; nonce_hex: string; version: number },
      update: (wrappedDek: WrappedDekPayload) => Promise<unknown>,
    ) => {
      if (!record.wrapped_dek || record.wrapped_dek.user_id !== ownerId) return;
      const newWrap = await rewrapDekForRecipient(record, record.wrapped_dek, oldCryptKey, ownerId, newKekPublicKey);
      await update(newWrap);
    };

    await Promise.all([
      ...canDoItems.data.map((item) => rewrapAndUpdate(item, (w) => this.canDoList.update({ id: item.id, wrapped_deks: [w] }))),
      ...projects.data.map((item) => rewrapAndUpdate(item, (w) => this.projects.update({ id: item.id, wrapped_deks: [w] }))),
      ...calendars.data.map((item) => rewrapAndUpdate(item, (w) => this.calendars.update({ id: item.id, wrapped_deks: [w] }))),
      ...calendarEvents.data.map((item) => rewrapAndUpdate(item, (w) => this.calendarEvents.update({ id: item.id, wrapped_deks: [w] }))),
      ...countdowns.data.map((item) => rewrapAndUpdate(item, (w) => this.countdowns.update({ id: item.id, wrapped_deks: [w] }))),
    ]);

    // The singleton user-settings row requires the full payload on every
    // update (no partial-field support), so resend its unchanged
    // ciphertext alongside the new wrap.
    if (userSettings.data?.wrapped_dek && userSettings.data.wrapped_dek.user_id === ownerId) {
      const newWrap = await rewrapDekForRecipient(userSettings.data, userSettings.data.wrapped_dek, oldCryptKey, ownerId, newKekPublicKey);
      await this.userSettings.update({
        algorithm: userSettings.data.algorithm,
        ciphertext_hex: userSettings.data.ciphertext_hex,
        nonce_hex: userSettings.data.nonce_hex,
        version: userSettings.data.version,
        wrapped_deks: [newWrap],
      });
    }
  }

  private buildSession(data: AuthSessionApiShape): AuthSession {
    return {
      user: { id: data.userId, email: data.email, created_at: new Date().toISOString() },
      access_token: data.token,
      refresh_token: data.refreshToken,
      expires_at: Date.now() + 15 * 60 * 1000,
      currentPrincipal: data.currentPrincipal,
      kekMetadatas: data.kekMetadatas,
      linkedPrincipals: data.linkedPrincipals,
    };
  }

  // API user (scoped access principal) methods
  apiUsers = {
    list: async (): Promise<ApiResponse<ApiUser[]>> => {
      return this.makeRequest<ApiResponse<ApiUser[]>>('/api/auth/api-users');
    },

    create: async (request: {
      apiUserId: string;
      authKey: string;
      kekPublicKey: string;
      encryptedLabel: { algorithm: string; ciphertext_hex: string; nonce_hex: string; version: number };
      encryptedLabelDeks: WrappedDekPayload[];
    }): Promise<ApiResponse<ApiUser>> => {
      return this.makeRequest<ApiResponse<ApiUser>>('/api/auth/api-users', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/auth/api-users/${id}`, { method: 'DELETE' });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete api user' };
      }
    },

    provisionDeks: async (
      apiUserId: string,
      deks: { resource_id: string; wrapped_dek: WrappedDekPayload }[],
    ): Promise<ApiResponse<ApiUser>> => {
      return this.makeRequest<ApiResponse<ApiUser>>(`/api/auth/api-users/${apiUserId}/deks`, {
        method: 'POST',
        body: JSON.stringify({ deks }),
      });
    },

    createApiToken,
    deriveApiTokenCredentials,
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

    update: async (request: UpdateUserSettingsRequest): Promise<ApiResponse<UserSettingsEncrypted>> => {
      return this.makeRequest<ApiResponse<UserSettingsEncrypted>>('/api/user-settings', {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },
  };
}

export default RustBackendImpl;
