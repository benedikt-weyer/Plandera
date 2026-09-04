# Streamline Scheduler - Rust Backend

A high-performance Rust backend for the Streamline Scheduler application, built with Axum web framework and SeaORM.

## Features

- 🚀 **High Performance**: Built with Rust and Axum for maximum performance
- 🗃️ **SeaORM**: Modern async ORM with type-safe database operations
- 🔐 **JWT Authentication**: Custom JWT authentication system
- 🔒 **End-to-End Encryption**: Backend stores encrypted data from frontend
- ⚡ **Real-time Updates**: WebSocket support for live data synchronization
- 🛡️ **Row Level Security**: Application-level RLS implementation
- 📊 **PostgreSQL**: Full PostgreSQL database support with migrations
- 🐳 **Docker Ready**: Complete containerization with Docker Compose

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info (protected)

### Projects
- `GET /projects` - List user projects (protected)
- `POST /projects` - Create new project (protected)
- `GET /projects/:id` - Get specific project (protected)
- `PUT /projects/:id` - Update project (protected)
- `DELETE /projects/:id` - Delete project (protected)

### Can-Do List
- `GET /can-do-list` - List user tasks (protected)
- `POST /can-do-list` - Create new task (protected)
- `GET /can-do-list/:id` - Get specific task (protected)
- `PUT /can-do-list/:id` - Update task (protected)
- `DELETE /can-do-list/:id` - Delete task (protected)

### Calendars
- `GET /calendars` - List user calendars (protected)
- `POST /calendars` - Create new calendar (protected)
- `GET /calendars/:id` - Get specific calendar (protected)
- `PUT /calendars/:id` - Update calendar (protected)
- `DELETE /calendars/:id` - Delete calendar (protected)

### Calendar Events
- `GET /calendar-events` - List user events (protected)
- `POST /calendar-events` - Create new event (protected)
- `GET /calendar-events/:id` - Get specific event (protected)
- `PUT /calendar-events/:id` - Update event (protected)
- `DELETE /calendar-events/:id` - Delete event (protected)

### Real-time
- `GET /ws` - WebSocket connection for real-time updates (protected)

## Development Setup

### Prerequisites
- Rust 1.82+
- PostgreSQL 15+
- Docker (optional)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd backend_new
   ```

2. **Environment Configuration**:
   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

3. **Database Setup**:
   ```bash
   # Create PostgreSQL database
   createdb streamline_scheduler
   ```

4. **Run Development Server**:
   ```bash
   cargo run
   ```

   The server will start on `http://localhost:3001`

### Docker Development

1. **Start with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database on port 5432
   - Rust backend on port 3001

2. **View logs**:
   ```bash
   docker-compose logs -f backend
   ```

## Database Schema

The backend uses SeaORM for database operations with the following tables:

### users
- User authentication and profile data
- Custom authentication schema

### projects
- Hierarchical project structure
- Support for nested projects with parent-child relationships
- Display ordering and collapse state

### can_do_list
- Task management with project association
- Display ordering for custom task arrangement

### calendars
- Calendar management with default calendar support

### calendar_events
- Event storage with encrypted data

All user data (except auth) is stored encrypted using E2EE from the frontend.

## Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:password@localhost:5432/streamline_scheduler

# JWT
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
JWT_EXPIRY_HOURS=24

# Server
PORT=3001
RUST_LOG=info
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │───▶│   Rust Backend  │───▶│   PostgreSQL    │
│   (Next.js)     │    │     (Axum)      │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────▶│   WebSockets    │
                         │  (Real-time)    │
                         └─────────────────┘
```

### Key Components

- **Axum Router**: High-performance web framework
- **SeaORM**: Type-safe database operations with migrations
- **JWT Authentication**: Custom JWT token system
- **WebSocket Manager**: Real-time data synchronization
- **Middleware Stack**: Authentication, CORS, logging

## Security Features

- JWT-based authentication with custom token validation
- Application-level Row Level Security (RLS)
- CORS protection
- Input validation and sanitization
- Encrypted data storage (E2EE from frontend)

## Performance

- Async/await throughout the application
- Connection pooling for database operations
- Efficient WebSocket connection management
- Optimized database queries with proper indexing

## Testing

```bash
# Run tests
cargo test

# Run with coverage
cargo test --coverage
```

## Deployment

### Docker Production

```bash
# Build production image
docker build -t streamline-backend .

# Run production container
docker run -p 3001:3001 --env-file .env streamline-backend
```

### Manual Deployment

```bash
# Build release binary
cargo build --release

# Run migrations
DATABASE_URL=... ./target/release/streamline_backend

# Start server
./target/release/streamline_backend
```

## Contributing

1. Follow Rust conventions and best practices
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all checks pass: `cargo fmt && cargo clippy && cargo test`

## License

[Your License Here]
