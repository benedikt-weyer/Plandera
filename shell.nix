{ 
  pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-unstable.tar.gz") {}
}:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js and related tools for Next.js frontend
    nodejs_20
    pnpm
    typescript
    typescript-language-server

    # Rust toolchain for backend
    rustc
    cargo
    cargo-watch
    rustfmt
    clippy
    rust-analyzer
    
    # Database tools
    postgresql_15
    
    # Container tools
    docker
    docker-compose

    # System dependencies for Rust compilation
    pkg-config
    openssl
    openssl.dev
    
    # Additional build tools
    gcc
    libiconv
    
    # Useful development tools
    curl
    jq
    git
    wget
  ];

  shellHook = ''
    # Save the project directory
    export PROJECT_DIR=$(pwd)
    
    # Print welcome message
    echo "🚀 Welcome to Streamline Scheduler development environment"
    echo "Architecture: Rust Backend + Next.js Frontend + E2E Encryption"
    echo "🔥 Hot reload enabled for Rust backend with cargo-watch"
    echo "-----------------------------------------------------"
    echo "Available commands:"
    echo "  start         - Start full stack (database, backend, frontend)"
    echo "  start:db      - Start only PostgreSQL database"
    echo "  start:be      - Start only Rust backend (with hot reload)"
    echo "  start:fe      - Start only Next.js frontend"
    echo "  stop          - Stop all development servers"
    echo "  stop:db       - Stop only database"
    echo "  stop:be       - Stop only backend"
    echo "  stop:fe       - Stop only frontend"
    echo "  restart       - Restart all development servers"
    echo "  restart:be    - Restart only backend"
    echo "  restart:fe    - Restart only frontend"
    echo "  build         - Build both frontend and backend"
    echo "  build:be      - Build only backend"
    echo "  build:fe      - Build only frontend"
    echo "  test          - Run all tests"
    echo "  test:be       - Run backend tests"
    echo "  test:fe       - Run frontend tests"
    echo "  migrate       - Run database migrations"
    echo "  logs          - Show logs from all services"
    echo "  logs-follow   - Follow all logs in real-time"
    echo "  logs:be       - Show backend logs"
    echo "  logs:fe       - Show frontend logs"
    echo "  logs:db       - Show database logs"
    echo "-----------------------------------------------------"

    # Create a temporary directory for PID files
    export TEMP_DIR=$(mktemp -d)

    # Set up environment variables for development
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
    export JWT_SECRET="dev-jwt-secret-key-for-local-development-only"
    export VITE_BACKEND_URL="http://localhost:3001"

    # Define function to start database
    start_database() {
      echo "🐘 Starting PostgreSQL database..."
      cd "$PROJECT_DIR"
      
      # Create .env file if it doesn't exist
      if [ ! -f ".env" ]; then
        cp env.example .env
        echo "Created .env file from env.example"
        
        # Generate secure passwords and JWT secret
        POSTGRES_PASSWORD=$(openssl rand -hex 32)
        JWT_SECRET=$(openssl rand -hex 32)
        PGADMIN_PASSWORD=$(openssl rand -hex 16)
        
        # Replace placeholders with generated values
        sed -i "s/your-super-secret-and-long-postgres-password/$POSTGRES_PASSWORD/" .env
        sed -i "s/your-super-secret-jwt-token-with-at-least-32-characters-long/$JWT_SECRET/" .env
        sed -i "s/your-super-secret-pgadmin-password/$PGADMIN_PASSWORD/" .env
        
        echo "🔐 Generated secure POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
        echo "🔐 Generated secure JWT_SECRET: $JWT_SECRET"
        echo "🔐 Generated secure PGADMIN_PASSWORD: $PGADMIN_PASSWORD"
      fi
      
      docker-compose up -d db pgadmin
      echo "Database started on localhost:5432"
      echo "pgAdmin started on localhost:5050"
      
      # Wait for database to be ready
      echo "Waiting for database to be ready..."
      sleep 3
      while ! docker exec streamline-db pg_isready -U postgres > /dev/null 2>&1; do
        sleep 1
      done
      echo "✅ Database is ready!"
    }

    # Define function to start Rust backend
    start_backend() {
      echo "🦀 Starting Rust backend server..."
      cd "$PROJECT_DIR/backend"
      
      # Create backend .env file from main .env file
      if [ ! -f ".env" ]; then
        cp env.example .env
        echo "Created backend .env file from env.example"
      fi
      
      # If main .env exists, use its values for backend configuration
      if [ -f "$PROJECT_DIR/.env" ]; then
        # Source the main .env file to get the generated values
        set -a  # automatically export all variables
        source "$PROJECT_DIR/.env"
        set +a  # stop automatically exporting
        
        # Update backend .env with values from main .env
        DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB"
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i "s/JWT_EXPIRY_HOURS=.*/JWT_EXPIRY_HOURS=$JWT_EXPIRY_HOURS/" .env
        sed -i "s/PORT=.*/PORT=$BACKEND_PORT/" .env
        sed -i "s/RUST_LOG=.*/RUST_LOG=$RUST_LOG/" .env
        sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" .env
        
        echo "🔗 Updated backend configuration from main .env"
      fi
      
      nohup cargo watch -x run > /tmp/backend.log 2>&1 &
      echo $! > "$TEMP_DIR/backend.pid"
      echo "Backend server started with hot reload (logs at /tmp/backend.log)"
      echo "🔥 Hot reload enabled - changes will trigger automatic restart"
      echo "🔗 API available at http://localhost:$BACKEND_PORT"
      cd "$PROJECT_DIR"
    }

    # Define function to start Next.js frontend
    start_frontend() {
      echo "⚡ Starting Next.js development server..."
      cd "$PROJECT_DIR/frontend"
      
      # Create .env.local file if it doesn't exist
      if [ ! -f ".env.local" ]; then
        cp env.example .env.local
        echo "Created .env.local file from env.example"
      fi
      
      nohup pnpm dev > /tmp/frontend.log 2>&1 &
      echo $! > "$TEMP_DIR/frontend.pid"
      echo "Frontend server started in background (logs at /tmp/frontend.log)"
      echo "📱 Access the app at http://localhost:3000"
      cd "$PROJECT_DIR"
      
      # Wait a moment for the server to start, then open browser
      sleep 3
      echo "🌐 Opening browser..."
      if command -v xdg-open > /dev/null; then
        xdg-open http://localhost:3000
      elif command -v open > /dev/null; then
        open http://localhost:3000
      else
        echo "⚠️  Could not auto-open browser. Please visit http://localhost:3000 manually"
      fi
    }

    # Define function to stop database
    stop_database() {
      echo "🛑 Stopping PostgreSQL database and pgAdmin..."
      cd "$PROJECT_DIR"
      docker-compose stop db pgadmin
      echo "✅ Database and pgAdmin stopped"
    }

    # Define function to stop backend
    stop_backend() {
      echo "🛑 Stopping Rust backend server..."
      if [ -f "$TEMP_DIR/backend.pid" ]; then
        kill $(cat "$TEMP_DIR/backend.pid") 2>/dev/null || true
        rm "$TEMP_DIR/backend.pid"
      fi
      pkill -f "cargo watch" || true
      pkill -f "cargo run" || true
      echo "✅ Backend server stopped"
    }

    # Define function to stop frontend
    stop_frontend() {
      echo "🛑 Stopping Next.js development server..."
      if [ -f "$TEMP_DIR/frontend.pid" ]; then
        kill $(cat "$TEMP_DIR/frontend.pid") 2>/dev/null || true
        rm "$TEMP_DIR/frontend.pid"
      fi
      pkill -f "pnpm dev" || true
      echo "✅ Frontend server stopped"
    }

    # Define function to stop all services
    stop_all() {
      echo "🛑 Stopping all development servers..."
      stop_frontend
      stop_backend
      stop_database
      
      # Clean up temp directory
      rm -rf $TEMP_DIR
      echo "✅ All servers stopped"
    }

    # Define function to restart backend
    restart_backend() {
      echo "🔄 Restarting Rust backend server..."
      stop_backend
      sleep 2
      start_backend
    }

    # Define function to restart frontend
    restart_frontend() {
      echo "🔄 Restarting Next.js development server..."
      stop_frontend
      sleep 2
      start_frontend
    }

    # Define function to restart all
    restart_all() {
      echo "🔄 Restarting all development servers..."
      stop_all
      sleep 2
      start_database
      sleep 3
      start_backend
      sleep 2
      start_frontend
    }

    # Define function to build backend
    build_backend() {
      echo "🔨 Building Rust backend..."
      cd "$PROJECT_DIR/backend"
      cargo build --release
      cd "$PROJECT_DIR"
      echo "✅ Backend build complete"
    }

    # Define function to build frontend
    build_frontend() {
      echo "🔨 Building Next.js frontend..."
      cd "$PROJECT_DIR/frontend"
      pnpm build
      cd "$PROJECT_DIR"
      echo "✅ Frontend build complete"
    }

    # Define function to run backend tests
    test_backend() {
      echo "🧪 Running Rust backend tests..."
      cd "$PROJECT_DIR/backend"
      cargo test
      cd "$PROJECT_DIR"
    }

    # Define function to run frontend tests
    test_frontend() {
      echo "🧪 Running Next.js frontend tests..."
      cd "$PROJECT_DIR/frontend"
      pnpm test
      cd "$PROJECT_DIR"
    }

    # Define function to run migrations
    run_migrations() {
      echo "🔄 Running database migrations..."
      cd "$PROJECT_DIR/backend"
      cargo run --bin migrator
      cd "$PROJECT_DIR"
      echo "✅ Migrations complete"
    }

    # Define function to show logs
    show_logs() {
      echo "📋 Showing logs from all services..."
      echo "=== Backend Logs ==="
      tail -n 20 /tmp/backend.log 2>/dev/null || echo "No backend logs found"
      echo ""
      echo "=== Frontend Logs ==="
      tail -n 20 /tmp/frontend.log 2>/dev/null || echo "No frontend logs found"
      echo ""
      echo "=== Database Logs ==="
      docker logs streamline-db --tail 20 2>/dev/null || echo "No database logs found"
    }

    # Define function to follow all logs in real-time
    follow_all_logs() {
      echo "📋 Following all logs in real-time... (Press Ctrl+C to stop)"
      echo "=========================================="
      
      # Create named pipes for log output if they don't exist
      mkdir -p /tmp/streamline-logs
      
      # Function to cleanup background processes
      cleanup_follow() {
        jobs -p | xargs -r kill 2>/dev/null
        rm -rf /tmp/streamline-logs
        echo ""
        echo "✅ Stopped following logs"
      }
      
      # Set up cleanup on exit
      trap cleanup_follow INT TERM
      
      # Start following logs with prefixes
      (tail -f /tmp/backend.log 2>/dev/null | sed 's/^/[BACKEND] /' &) 2>/dev/null
      (tail -f /tmp/frontend.log 2>/dev/null | sed 's/^/[FRONTEND] /' &) 2>/dev/null
      (docker logs streamline-db -f 2>/dev/null | sed 's/^/[DATABASE] /' &) 2>/dev/null
      
      # Wait for user to stop
      wait
    }

    # Set up cleanup on exit
    trap stop_all EXIT

    # Define convenient aliases
    alias start='start_database && sleep 3 && start_backend && sleep 2 && start_frontend'
    alias start:db='start_database'
    alias start:be='start_backend'
    alias start:fe='start_frontend'
    alias stop='stop_all'
    alias stop:db='stop_database'
    alias stop:be='stop_backend'
    alias stop:fe='stop_frontend'
    alias restart='restart_all'
    alias restart:be='restart_backend'
    alias restart:fe='restart_frontend'
    alias build='build_backend && build_frontend'
    alias build:be='build_backend'
    alias build:fe='build_frontend'
    alias test='test_backend && test_frontend'
    alias test:be='test_backend'
    alias test:fe='test_frontend'
    alias migrate='run_migrations'
    alias logs='show_logs'
    alias logs-follow='follow_all_logs'
    alias logs:be='tail -f /tmp/backend.log'
    alias logs:fe='tail -f /tmp/frontend.log'
    alias logs:db='docker logs streamline-db -f'

    # Ensure pnpm dependencies are installed for frontend
    if [ -d "$PROJECT_DIR/frontend" ]; then
      echo "📦 Setting up Next.js frontend dependencies..."
      cd "$PROJECT_DIR/frontend"
      if [ ! -d "node_modules" ]; then
        echo "Installing dependencies with pnpm..."
        pnpm install
      fi
      cd "$PROJECT_DIR"
    fi

    # Check if Rust backend dependencies are ready
    if [ -d "$PROJECT_DIR/backend" ]; then
      echo "🦀 Checking Rust backend setup..."
      cd "$PROJECT_DIR/backend"
      if [ ! -d "target" ]; then
        echo "Building Rust dependencies for the first time..."
        cargo build
      fi
      cd "$PROJECT_DIR"
    fi

    unset NODE_ENV

    echo "✅ Development environment ready!"
    echo ""
    echo "🎯 Quick start:"
    echo "  1. Run 'start' to launch the full stack"
    echo "  2. Visit http://localhost:3000 for the frontend"
    echo "  3. API is available at http://localhost:3001"
    echo "  4. Database is on localhost:5432"
    echo "  5. pgAdmin is available at http://localhost:5050"
    echo ""
    echo "🔧 Individual services:"
    echo "  - 'start:db' for database only"
    echo "  - 'start:be' for backend only" 
    echo "  - 'start:fe' for frontend only"
    echo ""
    echo "📋 Use 'logs' to see all logs or 'logs-follow' to follow in real-time"
    echo "    Individual logs: 'logs:be'/'logs:fe'/'logs:db'"
    echo ""
    echo "🔑 pgAdmin credentials (generated in .env file):"
    echo "  - Email: admin@streamline.com"
    echo "  - Password: Check .env file for PGADMIN_PASSWORD"
  '';

  # Set environment variables
  env = {
    RUST_LOG = "debug";
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
    PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.postgresql_15}/lib/pkgconfig";
    OPENSSL_DIR = "${pkgs.openssl.dev}";
    OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
    OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";
  };
}
