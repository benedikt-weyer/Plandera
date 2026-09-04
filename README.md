# Streamline Scheduler

Streamline Scheduler is an open source self-hostable calendar-todolist combo with end-to-end encryption, which provides fast and efficient streamlined scheduling of tasks and events. It can be used as a standalone todolist app and/or calendar app. The frontend is built with Next.js, React, TypeScript, Tailwind CSS, and shadcn/ui components, featuring client-side encryption. The backend uses a custom Rust API with Axum framework and PostgreSQL. Privacy-focused and easy self-hosting first.

## Features

- 📅 **Calendar Management** - Create, edit, and manage events with support for recurring patterns
- ✅ **Todo List** - Efficient task management with priorities and due dates
- 🔄 **Recurring Events & Tasks** - Set up repeating events and tasks with flexible patterns
- 🔒 **End-to-End Encryption** - All data is encrypted client-side before transmission
- 🏠 **Easy Self-Hosting** - Simple deployment options for personal or team use
- 🎨 **Modern UI** - Beautiful, responsive interface built with Next.js, React, and shadcn/ui
- ⚡ **Real-time Sync** - WebSocket-based real-time updates across all devices
- 🌙 **Dark Mode** - Full dark/light theme support
- 🗂️ **Project Organization** - Hierarchical project structure with drag-and-drop reordering

## Architecture

### Current Architecture
- **Frontend**: Next.js 14+ with React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Rust with Axum framework, SeaORM, PostgreSQL
- **Real-time**: WebSocket implementation for instant synchronization
- **Security**: Client-side encryption with crypto-js and PBKDF2 key derivation
- **Package Manager**: pnpm
- **Development**: Nix flake dev shell, Docker Compose for local development

## Tech Stack

- **Frontend**: Next.js 14+, React 19, TypeScript, Tailwind CSS, shadcn/ui, crypto-js, @dnd-kit
- **Backend**: Rust, Axum, SeaORM, PostgreSQL, JWT authentication, WebSocket support
- **Development**: Nix flake dev shell, Docker, pnpm
- **Security**: End-to-end encryption, client-side key derivation

## Self-Hosting

Streamline Scheduler (rebranding to Plandera) can be easily self-hosted on your own server or cloud provider using the new Rust backend architecture.

### Deployment Options

1. **Kubernetes** (Recommended for production) - See [docs/deployment/K8S_QUICKSTART.md](./docs/deployment/K8S_QUICKSTART.md) and [docs/deployment/KUBERNETES_DEPLOYMENT.md](./docs/deployment/KUBERNETES_DEPLOYMENT.md)
2. **Docker Compose** (Good for local development and simple deployments)

### Quick Start with Kubernetes

For Kubernetes deployment with staging and production environments:

```bash
# Quick setup - see docs/deployment/K8S_QUICKSTART.md for details
kubectl apply -f k8s/staging/  # For staging
kubectl apply -f k8s/production/  # For production
```

**Key features**:
- Separate staging and production namespaces
- Automatic deployment via GitHub Actions
- TLS certificates via cert-manager
- Horizontal scaling support

See [docs/deployment/K8S_QUICKSTART.md](./docs/deployment/K8S_QUICKSTART.md) for quick start and [docs/deployment/KUBERNETES_DEPLOYMENT.md](./docs/deployment/KUBERNETES_DEPLOYMENT.md) for comprehensive documentation.

### Quick Start with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/streamline-scheduler.git
   cd streamline-scheduler
   ```

2. **Set up environment variables**:

   ```bash
   # Create environment file for the backend
   cp backend/env.example backend/.env
   
   # Create environment file for the frontend
   cp apps/frontend/env.example apps/frontend/.env.local
   
   # Edit the environment files with your settings
   # Set strong passwords, JWT secrets, and database configuration
   ```

3. **Deploy with Docker Compose**:

   ```bash
   # Start all services (PostgreSQL, Rust backend, Next.js frontend)
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend: <https://localhost:443> (with SSL) or <http://localhost:3000>
   - Backend API: <http://localhost:3001>

### Environment Variables

Key environment variables to configure:

#### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# Server
PORT=3001
```

#### Frontend (.env.local)

```bash
# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

#### Docker Compose (.env)
```bash
# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Service Ports
BACKEND_PORT=3001
FRONTEND_PORT=3000

# JWT Secret (should match backend)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

### Security Features

- **End-to-End Encryption**: All sensitive data is encrypted client-side using AES-CBC
- **Master Password**: Users provide a master password for key derivation (never sent to server)
- **PBKDF2 Key Derivation**: Strong key derivation with 10,000 iterations
- **Zero Knowledge**: Server never has access to unencrypted user data
- **JWT Authentication**: Secure token-based authentication
- **Row Level Security**: Application-level data isolation

### Manual Server Deployment

1. **Server Requirements**:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker and Docker Compose
   - Nginx (for reverse proxy and SSL)
   - SSL certificate (Let's Encrypt recommended)

2. **Install Dependencies**:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-username/streamline-scheduler.git
   cd streamline-scheduler
   
   # Set up production environment
   cp backend/env.example backend/.env.production
   cp apps/frontend/env.example apps/frontend/.env.production
   # Edit .env.production files with production settings
   
   # Start services
   docker-compose up -d
   ```

4. **Configure Nginx** (example):
   ```nginx
   server {
       listen 443 ssl http2;
       server_name your-domain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /api/ {
           proxy_pass http://localhost:3001/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /ws {
           proxy_pass http://localhost:3001/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Backup and Maintenance

```bash
# Database backup
docker exec streamline-db pg_dump -U postgres postgres > backup.sql

# Restore database
docker exec -i streamline-db psql -U postgres postgres < backup.sql

# Update application
git pull origin main
docker-compose down
docker-compose pull
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Development

### Prerequisites

- Node.js 20.x or later
- pnpm
- Rust (for backend development)
- Docker and Docker Compose
- Nix (optional, for complete environment)

### Development Setup

#### Option 1: Using Nix (Recommended)

The project includes a comprehensive `shell.nix` file that sets up a complete development environment with all necessary dependencies, including cargo-watch for hot reload functionality.

1. **Install Nix**:
   - Follow the [official Nix installation guide](https://nixos.org/download.html)

2. **Enter the development environment**:

   ```bash
   cd streamline-scheduler
   nix-shell
   ```

3. **Start development servers with convenient commands**:

   ```bash
   # Start the full stack (database, backend with hot reload, frontend)
   start
   
   # Or start services individually:
   start:db    # Start PostgreSQL database
   start:be    # Start Rust backend with cargo-watch hot reload
   start:fe    # Start Next.js frontend
   
   # Other useful commands:
   logs:be     # Follow backend logs
   stop        # Stop all services
   ```

#### Option 2: Manual Setup

1. **Install Prerequisites**:
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Node.js and pnpm
   # Install Docker and Docker Compose
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   
   # Set up environment
   cp env.example .env
   
   # Start database
   docker-compose up -d db
   
   # Run migrations and start server
   cargo run
   ```

3. **Setup Frontend**:

   ```bash
   cd apps/frontend
   
   # Install dependencies
   pnpm install
   
   # Set up environment
   cp env.example .env.local
   
   # Start development server
   pnpm dev
   ```

4. **Access the application**:
   - Frontend: <http://localhost:3000>
   - Backend API: <http://localhost:3001>
   - Database: localhost:5432

### Project Structure

```text
streamline-scheduler/
├── apps/frontend/           # Next.js frontend application
│   ├── app/                # Next.js 14+ app router
│   │   ├── (auth-pages)/   # Authentication pages
│   │   ├── dashboard/      # Dashboard pages
│   │   └── api/            # API routes
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── auth/           # Authentication components
│   │   └── dashboard/      # Dashboard components
│   ├── utils/              # Utility functions
│   │   ├── api/            # API client
│   │   ├── auth/           # Authentication utilities
│   │   └── cryptography/   # Encryption utilities
│   ├── hooks/              # Custom React hooks
│   ├── Dockerfile          # Frontend container
│   └── package.json
├── backend/                # Rust backend application
│   ├── src/
│   │   ├── entities/       # Database entities (SeaORM)
│   │   ├── handlers/       # API route handlers
│   │   ├── migrator/       # Database migrations
│   │   ├── models/         # Request/response models
│   │   ├── middleware/     # Middleware functions
│   │   └── websocket/      # WebSocket implementation
│   ├── Cargo.toml
│   └── Dockerfile          # Backend container
├── docker-compose.yml      # Complete stack deployment
├── nginx.conf              # Nginx configuration
└── shell.nix               # Nix development environment
```

### Development Workflow

1. **Fork and Clone**: Fork the repository and clone your fork
2. **Create a Branch**: Create a new branch for your feature or bugfix
3. **Set Up Environment**: Use one of the development setup options above
4. **Make Changes**: Implement your changes following the project conventions
5. **Test**: Test your changes with both frontend and backend
6. **Create Migrations**: If you changed the database schema, add SeaORM migrations
7. **Commit and Push**: Commit your changes and push to your fork
8. **Submit PR**: Submit a pull request with a clear description

## Migration from Legacy Architecture

This project has evolved from a Supabase-based backend to a custom Rust backend for better privacy and control. The current architecture provides:

- **Enhanced Privacy**: True end-to-end encryption with client-side key derivation
- **Better Performance**: Custom Rust backend optimized for the specific use case
- **Self-Hosting**: Complete control over your data and infrastructure
- **Real-time Features**: Custom WebSocket implementation for instant synchronization

## Contributing

We welcome contributions from the community! Please see the development setup above and feel free to:

- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation

## License
This project is licensed under a custom license by Benedikt Weyer. You may use it for personal self-hosting only. Selling it, monetizing hosting, or including it in proprietary projects is prohibited. All contributions are covered under the same license. See LICENSE for full details.

## Support

- 📖 **Documentation**: Check the [docs](./docs) directory for comprehensive guides
- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Open a discussion on GitHub
- 🔒 **Security Issues**: Report privately via email

## Documentation

For detailed documentation, see the [docs](./docs) directory:

- **[Documentation Index](./docs/INDEX.md)** - Complete documentation overview
- **[Deployment Guides](./docs/deployment)** - CI/CD, Kubernetes, and deployment setup
- **[Architecture](./docs/architecture)** - System design and workflows
- **[Integration Guides](./docs/integration)** - SSO and third-party integrations
- **[Testing](./docs/testing)** - Manual and automated testing procedures
