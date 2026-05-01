{
  description = "Development shell for Plandera";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs;
              [
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

                # Useful development tools
                curl
                jq
                git
                wget
              ]
              ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.libiconv ];

            RUST_LOG = "debug";
            DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
            JWT_SECRET = "dev-jwt-secret-key-for-local-development-only";
            VITE_BACKEND_URL = "http://localhost:3001";
            PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.postgresql_15}/lib/pkgconfig";
            OPENSSL_DIR = "${pkgs.openssl.dev}";
            OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
            OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";

            shellHook = ''
              export PROJECT_DIR="$PWD"
              export TEMP_DIR="''${TEMP_DIR:-$(mktemp -d)}"

              start_database() {
                echo "🐘 Starting PostgreSQL database..."
                cd "$PROJECT_DIR"

                if [ ! -f ".env" ]; then
                  cp env.example .env
                  echo "Created .env file from env.example"

                  POSTGRES_PASSWORD=$(openssl rand -hex 32)
                  JWT_SECRET=$(openssl rand -hex 32)
                  PGADMIN_PASSWORD=$(openssl rand -hex 16)

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

                echo "Waiting for database to be ready..."
                sleep 3
                while ! docker exec streamline-db pg_isready -U postgres > /dev/null 2>&1; do
                  sleep 1
                done
                echo "✅ Database is ready!"
              }

              start_backend() {
                echo "🦀 Starting Rust backend server..."
                cd "$PROJECT_DIR/backend"

                if [ ! -f ".env" ]; then
                  cp env.example .env
                  echo "Created backend .env file from env.example"
                fi

                if [ -f "$PROJECT_DIR/.env" ]; then
                  set -a
                  source "$PROJECT_DIR/.env"
                  set +a

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
                echo "🔗 API available at http://localhost:''${BACKEND_PORT:-3001}"
                cd "$PROJECT_DIR"
              }

              start_frontend() {
                echo "⚡ Starting Next.js development server..."
                cd "$PROJECT_DIR/frontend"

                if [ ! -f ".env.local" ]; then
                  cp env.example .env.local
                  echo "Created .env.local file from env.example"
                fi

                nohup pnpm dev > /tmp/frontend.log 2>&1 &
                echo $! > "$TEMP_DIR/frontend.pid"
                echo "Frontend server started in background (logs at /tmp/frontend.log)"
                echo "📱 Access the app at http://localhost:3000"
                cd "$PROJECT_DIR"

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

              stop_database() {
                echo "🛑 Stopping PostgreSQL database and pgAdmin..."
                cd "$PROJECT_DIR"
                docker-compose stop db pgadmin
                echo "✅ Database and pgAdmin stopped"
              }

              stop_backend() {
                echo "🛑 Stopping Rust backend server..."
                if [ -f "$TEMP_DIR/backend.pid" ]; then
                  kill "$(cat "$TEMP_DIR/backend.pid")" 2>/dev/null || true
                  rm "$TEMP_DIR/backend.pid"
                fi
                pkill -f "cargo watch" || true
                pkill -f "cargo run" || true
                echo "✅ Backend server stopped"
              }

              stop_frontend() {
                echo "🛑 Stopping Next.js development server..."
                if [ -f "$TEMP_DIR/frontend.pid" ]; then
                  kill "$(cat "$TEMP_DIR/frontend.pid")" 2>/dev/null || true
                  rm "$TEMP_DIR/frontend.pid"
                fi
                pkill -f "pnpm dev" || true
                echo "✅ Frontend server stopped"
              }

              stop_all() {
                echo "🛑 Stopping all development servers..."
                stop_frontend
                stop_backend
                stop_database

                rm -rf "$TEMP_DIR"
                echo "✅ All servers stopped"
              }

              restart_backend() {
                echo "🔄 Restarting Rust backend server..."
                stop_backend
                sleep 2
                start_backend
              }

              restart_frontend() {
                echo "🔄 Restarting Next.js development server..."
                stop_frontend
                sleep 2
                start_frontend
              }

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

              build_backend() {
                echo "🔨 Building Rust backend..."
                cd "$PROJECT_DIR/backend"
                cargo build --release
                cd "$PROJECT_DIR"
                echo "✅ Backend build complete"
              }

              build_frontend() {
                echo "🔨 Building Next.js frontend..."
                cd "$PROJECT_DIR/frontend"
                pnpm build
                cd "$PROJECT_DIR"
                echo "✅ Frontend build complete"
              }

              test_backend() {
                echo "🧪 Running Rust backend tests..."
                cd "$PROJECT_DIR/backend"
                cargo test
                cd "$PROJECT_DIR"
              }

              test_frontend() {
                echo "🧪 Running Next.js frontend tests..."
                cd "$PROJECT_DIR/frontend"
                pnpm test
                cd "$PROJECT_DIR"
              }

              run_migrations() {
                echo "🔄 Running database migrations..."
                cd "$PROJECT_DIR/backend"
                cargo run --bin migrator
                cd "$PROJECT_DIR"
                echo "✅ Migrations complete"
              }

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

              follow_all_logs() {
                echo "📋 Following all logs in real-time... (Press Ctrl+C to stop)"
                echo "=========================================="

                mkdir -p /tmp/streamline-logs

                cleanup_follow() {
                  jobs -p | xargs -r kill 2>/dev/null
                  rm -rf /tmp/streamline-logs
                  echo ""
                  echo "✅ Stopped following logs"
                }

                trap cleanup_follow INT TERM

                (tail -f /tmp/backend.log 2>/dev/null | sed 's/^/[BACKEND] /' &) 2>/dev/null
                (tail -f /tmp/frontend.log 2>/dev/null | sed 's/^/[FRONTEND] /' &) 2>/dev/null
                (docker logs streamline-db -f 2>/dev/null | sed 's/^/[DATABASE] /' &) 2>/dev/null

                wait
              }

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

              unset NODE_ENV

              if [ -z "''${PLANDERA_DEV_ENV_INITIALIZED:-}" ]; then
                export PLANDERA_DEV_ENV_INITIALIZED=1

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
                echo "🛑 Services persist until you run 'stop' or the specific stop alias"
                echo ""
                echo "🔑 pgAdmin credentials (generated in .env file):"
                echo "  - Email: admin@streamline.com"
                echo "  - Password: Check .env file for PGADMIN_PASSWORD"
              fi
            '';
          };
        });
    };
}