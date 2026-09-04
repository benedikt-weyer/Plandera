# Streamline Scheduler API Documentation

## Overview

The Streamline Scheduler backend provides a RESTful API for managing tasks, projects, calendars, and events. This is an **End-to-End Encrypted (E2EE)** application where all sensitive user data is encrypted client-side before being sent to the server.

**Base URL:** `http://localhost:3001` (default)

## 🔒 End-to-End Encryption

**CRITICAL:** All sensitive data (content, names, descriptions, etc.) must be encrypted client-side before sending to the API. The server only stores:

- **Encrypted Data**: `encrypted_data`, `iv`, `salt` fields  
- **Non-sensitive Metadata**: IDs, timestamps, relationships, display order, boolean flags

**The server NEVER sees plaintext sensitive data.**

## Data Structure

All data entities follow this pattern:

### Server-side Storage (what the API handles):

```json
{
  "id": "uuid",
  "user_id": "uuid", 
  "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
  "iv": "1234567890abcdef1234567890abcdef",
  "salt": "abcdef1234567890abcdef1234567890",
  "created_at": "2025-09-12T14:30:00Z",
  "updated_at": "2025-09-12T14:30:00Z"
  // + any non-sensitive metadata fields
}
```

### Client-side Decryption (what encrypted_data contains):

The `encrypted_data` field contains the AES-encrypted JSON with sensitive user content.

## Non-Sensitive Metadata Fields

These are the ONLY fields stored in plaintext on the server:

### Projects:
- `parent_id`, `display_order`, `is_collapsed`, `is_default`

### Can-Do Items:  
- `project_id`, `display_order`

### Calendars:
- `is_default`

### Calendar Events:
- (No additional metadata - everything is encrypted)

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this structure:

```json
{
  "data": <response_data>,
  "message": "Optional success message"
}
```

Error responses:

```json
{
  "error": "Error message",
  "details": "Optional error details"
}
```

---

## Endpoints

### Health Check

#### `GET /health`

Check if the API is running.

**Response:**

```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-12T14:30:00Z"
  }
}
```

---

## Authentication Endpoints

### Register User

#### `POST /api/auth/register`

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**

```json
{
  "data": {
    "access_token": "jwt_token_here",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": null,
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "app_metadata": {},
      "user_metadata": {}
    }
  },
  "message": "User registered successfully"
}
```

### Login

#### `POST /api/auth/login`

Authenticate user and get access token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:** Same as register response.

### Get Current User

#### `GET /api/auth/me`

Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed_at": null,
    "created_at": "2025-09-12T14:30:00Z",
    "updated_at": "2025-09-12T14:30:00Z",
    "app_metadata": {},
    "user_metadata": {}
  }
}
```

---

## Project Endpoints

### List Projects

#### `GET /api/projects`

Get all projects for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `parent_id` (optional): Filter by parent project ID. Omit to get root projects.

**Response:**

```json
{
  "data": [
    {
      "id": "f31ff317-6ade-4bf4-a868-140316593e6d",
      "user_id": "bc9cb5f0-dfb7-48a2-a330-21fa0f48f985",
      "parent_id": null,
      "display_order": 0,
      "is_collapsed": false,
      "is_default": false,
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
      "iv": "1234567890abcdef1234567890abcdef",
      "salt": "abcdef1234567890abcdef1234567890"
    }
  ]
}
```

**⚠️ The `encrypted_data` contains:**

```json
{
  "name": "My Project",
  "description": "Project description", 
  "color": "#3b82f6"
}
```

### Create Project

#### `POST /api/projects`

Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "parent_id": null,
  "display_order": 0,
  "is_collapsed": false,
  "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
  "iv": "1234567890abcdef1234567890abcdef",
  "salt": "abcdef1234567890abcdef1234567890"
}
```

**⚠️ Before sending, client must encrypt:**

```json
{
  "name": "New Project",
  "description": "Project description",
  "color": "#3b82f6"
}
```

**Response:** Single project object (same structure as list).

### Get Project

#### `GET /api/projects/{id}`

Get a specific project by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:** Single project object.

### Update Project

#### `PUT /api/projects/{id}`

Update an existing project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Same as create (all fields optional).

**Response:** Updated project object.

### Delete Project

#### `DELETE /api/projects/{id}`

Delete a project and all its sub-projects.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "data": null,
  "message": "Project deleted successfully"
}
```

---

## Can-Do List Endpoints

### List Can-Do Items

#### `GET /api/can-do-list`

Get all can-do items for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `project_id` (optional): Filter by project ID

**Response:**

```json
{
  "data": [
    {
      "id": "1720657d-dadf-474e-b4ae-17ff5c671b8f",
      "user_id": "bc9cb5f0-dfb7-48a2-a330-21fa0f48f985",
      "project_id": "4254f783-9406-4b0d-be01-78a6a774524d",
      "display_order": 0,
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
      "iv": "1234567890abcdef1234567890abcdef",
      "salt": "abcdef1234567890abcdef1234567890"
    }
  ]
}
```

**⚠️ The `encrypted_data` contains:**

```json
{
  "content": "Task content",
  "completed": false,
  "estimatedDuration": 60,
  "impact": 7,
  "urgency": 8,
  "dueDate": "2025-09-15T12:00:00Z",
  "blockedBy": ["other-task-id"],
  "priority": "high",
  "tags": ["work", "urgent"]
}
```

### Create Can-Do Item

#### `POST /api/can-do-list`

Create a new can-do item.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "project_id": "4254f783-9406-4b0d-be01-78a6a774524d",
  "display_order": 0,
  "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
  "iv": "1234567890abcdef1234567890abcdef",
  "salt": "abcdef1234567890abcdef1234567890"
}
```

**⚠️ Before sending, client must encrypt:**

```json
{
  "content": "New task",
  "completed": false,
  "estimatedDuration": 60,
  "impact": 7,
  "urgency": 8,
  "dueDate": "2025-09-15T12:00:00Z",
  "blockedBy": [],
  "priority": "high",
  "tags": ["work"]
}
```

**Response:** Single can-do item object.

### Get/Update/Delete Can-Do Item

#### `GET /api/can-do-list/{id}`
#### `PUT /api/can-do-list/{id}`
#### `DELETE /api/can-do-list/{id}`

Same patterns as projects.

---

## Calendar Endpoints

### List Calendars

#### `GET /api/calendars`

**Response:**

```json
{
  "data": [
    {
      "id": "9818a085-8867-4b83-a620-006647ebe091",
      "user_id": "bc9cb5f0-dfb7-48a2-a330-21fa0f48f985",
      "is_default": false,
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
      "iv": "1234567890abcdef1234567890abcdef",
      "salt": "abcdef1234567890abcdef1234567890"
    }
  ]
}
```

**⚠️ The `encrypted_data` contains:**

```json
{
  "name": "My Calendar",
  "color": "#3b82f6",
  "is_visible": true,
  "type": "regular"
}
```

**For ICS calendars, `encrypted_data` contains:**

```json
{
  "name": "External Calendar",
  "color": "#10b981",
  "is_visible": true,
  "type": "ics",
  "ics_url": "https://calendar.google.com/calendar/ical/example%40gmail.com/private-abc123/basic.ics",
  "last_sync": "2025-09-12T14:30:00Z"
}
```

### Create Calendar

#### `POST /api/calendars`

**Request Body:**

```json
{
  "is_default": false,
  "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
  "iv": "1234567890abcdef1234567890abcdef",
  "salt": "abcdef1234567890abcdef1234567890"
}
```

**⚠️ Before sending, client must encrypt:**

```json
{
  "name": "New Calendar",
  "color": "#3b82f6",
  "is_visible": true
}
```

---

## Calendar Event Endpoints

### List Calendar Events

#### `GET /api/calendar-events`

**Response:**

```json
{
  "data": [
    {
      "id": "ecb68911-479e-48f4-a53a-9da80d558a66",
      "user_id": "bc9cb5f0-dfb7-48a2-a330-21fa0f48f985",
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
      "iv": "1234567890abcdef1234567890abcdef",
      "salt": "abcdef1234567890abcdef1234567890"
    }
  ]
}
```

**⚠️ The `encrypted_data` contains:**

```json
{
  "title": "Event Title",
  "description": "Event description",
  "location": "Conference Room A",
  "start_time": "2025-09-15T10:00:00Z",
  "end_time": "2025-09-15T11:00:00Z",
  "all_day": false,
  "calendar_id": "uuid",
  "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
  "recurrence_exception": []
}
```

### Create Calendar Event

#### `POST /api/calendar-events`

**Request Body:**

```json
{
  "encrypted_data": "U2FsdGVkX1+abc123def456ghi789jkl...",
  "iv": "1234567890abcdef1234567890abcdef",
  "salt": "abcdef1234567890abcdef1234567890"
}
```

**⚠️ Before sending, client must encrypt all event data including `title`, `description`, `start_time`, `end_time`, `calendar_id`, etc.**

---

## WebSocket Endpoint

#### `GET /ws`

Establish a WebSocket connection for real-time updates.

**Headers:** `Authorization: Bearer <token>` (via query parameter or upgrade headers)

Real-time messages contain the same encrypted data structure as REST endpoints.

---

## Security Notes

1. **All sensitive data must be encrypted client-side**
2. **Server never processes plaintext sensitive content**
3. **Only metadata for relationships/organization is stored plaintext**
4. **Use strong encryption keys derived from user passwords**
5. **Rotate encryption keys regularly**

---

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized  
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `500` - Internal Server Error
