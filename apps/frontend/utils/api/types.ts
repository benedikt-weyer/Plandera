/**
 * Type definitions for backend API interactions
 */

// A record's DEK, wrapped for one principal's ML-KEM-768 KEK. Field names
// match the Rust `WrappedDekPayload` struct's wire format exactly — it is
// never camelCase-renamed, even when nested inside a camelCase auth request.
export interface WrappedDekPayload {
  user_id: string;
  kek_public_key: string;
  algorithm: string;
  kem_ciphertext_hex: string;
  wrapped_dek_hex: string;
  nonce_hex: string;
  version: number;
}

export interface KekMetadata {
  kekEpochVersion: number;
  kekPublicKey: string;
}

export type PrincipalKind = 'user' | 'api_user';

export interface PrincipalSummary {
  id: string;
  kind: PrincipalKind;
  email?: string;
  username?: string;
}

export interface LinkedPrincipal {
  id: string;
  kind: PrincipalKind;
  email?: string;
  username?: string;
  latestKekEpochVersion: number;
  latestKekPublicKey: string;
}

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  currentPrincipal: PrincipalSummary;
  kekMetadatas: KekMetadata[];
  linkedPrincipals: LinkedPrincipal[];
}

export interface AuthResponse {
  session: AuthSession | null;
  user: AuthUser | null;
  error: string | null;
}

export interface SignUpRequest {
  email: string;
  password: string;
  emailRedirectTo?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
  redirectTo?: string;
}

export interface UpdatePasswordRequest {
  password: string;
}

export interface ApiUser {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
  latestKekEpochVersion: number;
  latestKekPublicKey: string;
  encryptedLabel: { algorithm: string; ciphertext_hex: string; nonce_hex: string; version: number };
  encryptedLabelDek: WrappedDekPayload;
}

// Can-do list types
export interface CanDoItemEncrypted {
  id: string;
  user_id: string;
  project_id?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_dek?: WrappedDekPayload;
}

export interface CanDoItemDecrypted {
  id: string;
  user_id: string;
  project_id?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  content: string;
  completed: boolean;
  due_date?: string;
  impact?: number; // 0-10 scale
  urgency?: number; // 0-10 scale
  tags?: string[];
  duration_minutes?: number;
  blocked_by?: string;
  my_day?: boolean;
  parent_task_id?: string; // For subtasks - references parent task ID
}



export interface CreateCanDoItemRequest {
  project_id?: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
  display_order?: number;
}

export interface UpdateCanDoItemRequest {
  id: string;
  project_id?: string;
  algorithm?: string;
  ciphertext_hex?: string;
  nonce_hex?: string;
  version?: number;
  wrapped_deks?: WrappedDekPayload[];
  display_order?: number;
}

export interface CreateCanDoItemDecryptedRequest {
  project_id?: string;
  content: string;
  completed?: boolean;
  due_date?: string;
  impact?: number; // 0-10 scale
  urgency?: number; // 0-10 scale
  tags?: string[];
  duration_minutes?: number;
  display_order?: number;
  blocked_by?: string;
  my_day?: boolean;
  parent_task_id?: string; // For subtasks
}

export interface UpdateCanDoItemDecryptedRequest {
  id: string;
  project_id?: string;
  content?: string;
  completed?: boolean;
  due_date?: string;
  impact?: number; // 0-10 scale
  urgency?: number; // 0-10 scale
  tags?: string[];
  duration_minutes?: number;
  display_order?: number;
  blocked_by?: string;
  my_day?: boolean;
  parent_task_id?: string; // For subtasks
}

// Project types
export interface ProjectEncrypted {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  parent_id?: string;
  display_order: number;
  is_collapsed: boolean;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_dek?: WrappedDekPayload;
}

export interface ProjectDecrypted {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  parent_id?: string;
  order: number;
  collapsed: boolean;
}



export interface CreateProjectRequest {
  display_order: number;
  is_collapsed?: boolean;
  parent_id?: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
}

export interface UpdateProjectRequest {
  id: string;
  parent_id?: string;
  display_order?: number;
  is_collapsed?: boolean;
  algorithm?: string;
  ciphertext_hex?: string;
  nonce_hex?: string;
  version?: number;
  wrapped_deks?: WrappedDekPayload[];
}

export interface CreateProjectDecryptedRequest {
  name: string;
  description?: string;
  color?: string;
  parent_id?: string;
  order?: number;
  collapsed?: boolean;
}

export interface UpdateProjectDecryptedRequest {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  parent_id?: string;
  order?: number;
  collapsed?: boolean;
}

// Calendar types
export interface CalendarEncrypted {
  id: string;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_dek?: WrappedDekPayload;
}

export interface CalendarDecrypted {
  id: string;
  name: string;
  color?: string;
  is_visible: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  type?: 'regular' | 'ics';
  ics_url?: string;
  last_sync?: string;
}



export interface CreateCalendarRequest {
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
  is_default?: boolean;
}

export interface UpdateCalendarRequest {
  id: string;
  algorithm?: string;
  ciphertext_hex?: string;
  nonce_hex?: string;
  version?: number;
  wrapped_deks?: WrappedDekPayload[];
  is_default?: boolean;
}

export interface CreateCalendarDecryptedRequest {
  name: string;
  color?: string;
  is_visible?: boolean;
  is_default?: boolean;
  type?: 'regular' | 'ics';
  ics_url?: string;
  last_sync?: string;
}

export interface UpdateCalendarDecryptedRequest {
  id: string;
  name?: string;
  color?: string;
  is_visible?: boolean;
  is_default?: boolean;
  type?: 'regular' | 'ics';
  ics_url?: string;
  last_sync?: string;
}

export interface CalendarEventEncrypted {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_dek?: WrappedDekPayload;
}

export interface CalendarEventDecrypted {
  id: string;
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
  task_id?: string; // Link to a can-do list task
  created_at: string;
  updated_at: string;
  user_id: string;
}



export interface CreateCalendarEventRequest {
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
}

export interface UpdateCalendarEventRequest {
  id: string;
  algorithm?: string;
  ciphertext_hex?: string;
  nonce_hex?: string;
  version?: number;
  wrapped_deks?: WrappedDekPayload[];
}

export interface CreateCalendarEventDecryptedRequest {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  calendar_id: string;
  recurrence_rule?: string;
  is_group_event?: boolean;
  is_task_reservation_space?: boolean;
  parent_group_event_id?: string;
  task_id?: string;
}

export interface UpdateCalendarEventDecryptedRequest {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  calendar_id?: string;
  recurrence_rule?: string;
  recurrence_exception?: string[];
  is_group_event?: boolean;
  is_task_reservation_space?: boolean;
  parent_group_event_id?: string;
  task_id?: string;
}

export interface CountdownEncrypted {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
  updated_at: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_dek?: WrappedDekPayload;
}

export interface CountdownDecrypted {
  id: string;
  user_id: string;
  event_id: string;
  target: 'start' | 'end';
  task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCountdownRequest {
  event_id: string;
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
}

export interface UpdateCountdownRequest {
  id: string;
  event_id?: string;
  algorithm?: string;
  ciphertext_hex?: string;
  nonce_hex?: string;
  version?: number;
  wrapped_deks?: WrappedDekPayload[];
}

export interface CreateCountdownDecryptedRequest {
  event_id: string;
  target: 'start' | 'end';
  task_id?: string;
}

export interface UpdateCountdownDecryptedRequest {
  id: string;
  event_id?: string;
  target?: 'start' | 'end';
  task_id?: string;
}

// Real-time subscription types
export interface RealtimeMessage<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  commit_timestamp: string;
  new?: T;
  old?: T;
}

export interface RealtimeSubscription {
  id: string;
  unsubscribe: () => void;
}

// API Response types
export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  error: string | null;
  count: number | null;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// User Settings types
export interface UserSettingsEncrypted {
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_dek?: WrappedDekPayload;
}

export type TaskClickBehavior = 'edit' | 'complete';
export type WeekStartDay = 0 | 1; // 0 = Sunday, 1 = Monday
export type Language = 'en' | 'de' | 'es';

export interface UserSettingsDecrypted {
  taskClickBehavior?: TaskClickBehavior;
  weekStartsOn?: WeekStartDay;
  language?: Language;
}

export interface UpdateUserSettingsRequest {
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
}

// Query filter types
export interface QueryFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'not';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: {
    column: string;
    ascending?: boolean;
  }[];
  limit?: number;
  offset?: number;
  select?: string[];
  all?: boolean; // For fetching all items regardless of hierarchy
}
