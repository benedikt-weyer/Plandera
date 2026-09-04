#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
STATE_DIR="${XDG_RUNTIME_DIR:-/tmp}/plandera-dev"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"
BACKEND_LOG_FILE="/tmp/backend.log"
FRONTEND_LOG_FILE="/tmp/frontend.log"

is_port_in_use() {
  local port="$1"
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$port$"
}

find_available_port() {
  local start_port="$1"
  local port="$start_port"

  while is_port_in_use "$port"; do
    port=$((port + 1))
  done

  printf '%s\n' "$port"
}

get_streamline_db_published_port() {
  docker port streamline-db 5432/tcp 2>/dev/null | awk -F: 'NR==1 {print $NF}' || true
}

sql_escape_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

sync_database_credentials() {
  local postgres_user="${POSTGRES_USER:-postgres}"
  local escaped_password
  escaped_password=$(sql_escape_literal "${POSTGRES_PASSWORD:-}")

  if docker exec streamline-db psql -U "$postgres_user" -d postgres -c "ALTER USER \"$postgres_user\" WITH PASSWORD '$escaped_password';" >/dev/null 2>&1; then
    echo "Synchronized PostgreSQL credentials from root .env"
  else
    echo "Warning: Failed to synchronize PostgreSQL credentials with the running database" >&2
  fi
}

wait_for_backend() {
  local health_url="http://localhost:${BACKEND_PORT:-3001}/health"
  local attempts=30
  local attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      echo "Backend is ready at $health_url"
      return 0
    fi

    sleep 1
    attempt=$((attempt + 1))
  done

  echo "Backend failed to become ready at $health_url" >&2
  tail -n 40 "$BACKEND_LOG_FILE" >&2 || true
  return 1
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

sed_inplace() {
  local expression="$1"
  local file="$2"

  if sed --version >/dev/null 2>&1; then
    sed -i "$expression" "$file"
  else
    sed -i '' "$expression" "$file"
  fi
}

open_url() {
  local url="$1"

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 &
  fi
}

load_root_env() {
  if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$PROJECT_DIR/.env"
    set +a
  fi
}

ensure_root_env() {
  cd "$PROJECT_DIR"

  if [ -f ".env" ]; then
    return
  fi

  cp env.example .env
  echo "Created .env file from env.example"

  local postgres_password
  local jwt_secret
  local pgadmin_password
  postgres_password=$(openssl rand -hex 32)
  jwt_secret=$(openssl rand -hex 32)
  pgadmin_password=$(openssl rand -hex 16)

  sed_inplace "s/your-super-secret-and-long-postgres-password/$postgres_password/" .env
  sed_inplace "s/your-super-secret-jwt-token-with-at-least-32-characters-long/$jwt_secret/" .env
  sed_inplace "s/your-super-secret-pgadmin-password/$pgadmin_password/" .env

  echo "Generated POSTGRES_PASSWORD in .env"
  echo "Generated JWT_SECRET in .env"
  echo "Generated PGADMIN_PASSWORD in .env"
}

ensure_backend_env() {
  local backend_dir="$PROJECT_DIR/apps/backend"
  local backend_env="$backend_dir/.env"

  cd "$backend_dir"

  if [ ! -f "$backend_env" ]; then
    cp env.example .env
    echo "Created backend .env file from env.example"
  fi

  if [ -f "$PROJECT_DIR/.env" ]; then
    load_root_env

    local database_url="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB"
    sed_inplace "s|DATABASE_URL=.*|DATABASE_URL=$database_url|" "$backend_env"
    sed_inplace "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$backend_env"
    sed_inplace "s/JWT_EXPIRY_HOURS=.*/JWT_EXPIRY_HOURS=$JWT_EXPIRY_HOURS/" "$backend_env"
    sed_inplace "s/PORT=.*/PORT=$BACKEND_PORT/" "$backend_env"
    sed_inplace "s/RUST_LOG=.*/RUST_LOG=$RUST_LOG/" "$backend_env"
    sed_inplace "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" "$backend_env"

    echo "Updated backend configuration from root .env"
  fi
}

ensure_frontend_env() {
  local frontend_dir="$PROJECT_DIR/apps/frontend"
  local frontend_env="$frontend_dir/.env.local"

  cd "$frontend_dir"

  if [ ! -f "$frontend_env" ]; then
    cp env.example .env.local
    echo "Created frontend .env.local from env.example"
  fi
}

start_database() {
  echo "Starting PostgreSQL database..."
  ensure_root_env
  load_root_env

  local configured_port="${POSTGRES_PORT:-5432}"
  local published_port
  local compose_recreate_flag="--no-recreate"

  published_port=$(get_streamline_db_published_port)

  if [ -z "$published_port" ] || [ "$published_port" != "$configured_port" ]; then
    if is_port_in_use "$configured_port" && [ "$published_port" != "$configured_port" ]; then
      local available_port
      available_port=$(find_available_port $((configured_port + 1)))
      sed_inplace "s/POSTGRES_PORT=.*/POSTGRES_PORT=$available_port/" "$PROJECT_DIR/.env"
      load_root_env
      configured_port="$available_port"
      echo "Updated POSTGRES_PORT in .env to $configured_port because port $POSTGRES_PORT was already in use"
    fi

    compose_recreate_flag="--force-recreate"
  fi

  cd "$PROJECT_DIR"
  docker-compose up -d "$compose_recreate_flag" db pgadmin

  echo "Database started on localhost:${POSTGRES_PORT:-5432}"
  echo "pgAdmin started on localhost:${PGADMIN_PORT:-5050}"
  echo "Waiting for database to be ready..."

  while ! docker exec streamline-db pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; do
    sleep 1
  done

  echo "Database is ready"
  sync_database_credentials
}

start_backend() {
  ensure_state_dir
  ensure_root_env
  load_root_env
  ensure_backend_env

  echo "Starting Rust backend server..."
  cd "$PROJECT_DIR/apps/backend"
  : >"$BACKEND_LOG_FILE"
  nohup cargo watch -x run >"$BACKEND_LOG_FILE" 2>&1 &
  echo $! >"$BACKEND_PID_FILE"
  wait_for_backend
  echo "Backend server started with hot reload"
  echo "API available at http://localhost:${BACKEND_PORT:-3001}"
}

start_frontend() {
  ensure_state_dir
  ensure_frontend_env
  load_root_env

  echo "Starting Next.js development server..."
  cd "$PROJECT_DIR/apps/frontend"
  nohup pnpm dev >"$FRONTEND_LOG_FILE" 2>&1 &
  echo $! >"$FRONTEND_PID_FILE"
  echo "Frontend server started in background"
  echo "App available at http://localhost:${FRONTEND_PORT:-3000}"
  open_url "http://localhost:${FRONTEND_PORT:-3000}"
}

stop_database() {
  echo "Stopping PostgreSQL database and pgAdmin..."
  cd "$PROJECT_DIR"
  docker-compose stop db pgadmin
}

stop_backend() {
  echo "Stopping Rust backend server..."

  if [ -f "$BACKEND_PID_FILE" ]; then
    kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null || true
    rm -f "$BACKEND_PID_FILE"
  fi

  pkill -f "cargo watch -x run" 2>/dev/null || true
  pkill -f "cargo run" 2>/dev/null || true
}

stop_frontend() {
  echo "Stopping Next.js development server..."

  if [ -f "$FRONTEND_PID_FILE" ]; then
    kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null || true
    rm -f "$FRONTEND_PID_FILE"
  fi

  pkill -f "pnpm dev" 2>/dev/null || true
}

stop_all() {
  stop_frontend
  stop_backend
  stop_database
}

restart_backend() {
  stop_backend
  sleep 2
  start_backend
}

restart_frontend() {
  stop_frontend
  sleep 2
  start_frontend
}

restart_all() {
  stop_all
  sleep 2
  start_database
  sleep 3
  start_backend
  sleep 2
  start_frontend
}

build_backend() {
  cd "$PROJECT_DIR/apps/backend"
  cargo build --release
}

build_frontend() {
  cd "$PROJECT_DIR/apps/frontend"
  pnpm build
}

test_backend() {
  cd "$PROJECT_DIR/apps/backend"
  cargo test
}

test_frontend() {
  cd "$PROJECT_DIR/apps/frontend"
  pnpm test
}

run_migrations() {
  cd "$PROJECT_DIR/apps/backend"
  cargo run --bin migrator
}

show_logs() {
  echo "=== Backend Logs ==="
  tail -n 20 "$BACKEND_LOG_FILE" 2>/dev/null || echo "No backend logs found"
  echo ""
  echo "=== Frontend Logs ==="
  tail -n 20 "$FRONTEND_LOG_FILE" 2>/dev/null || echo "No frontend logs found"
  echo ""
  echo "=== Database Logs ==="
  docker logs streamline-db --tail 20 2>/dev/null || echo "No database logs found"
}

follow_all_logs() {
  echo "Following all logs in real time. Press Ctrl+C to stop."

  tail -f "$BACKEND_LOG_FILE" 2>/dev/null | sed 's/^/[BACKEND] /' &
  local backend_tail_pid=$!
  tail -f "$FRONTEND_LOG_FILE" 2>/dev/null | sed 's/^/[FRONTEND] /' &
  local frontend_tail_pid=$!
  docker logs streamline-db -f 2>/dev/null | sed 's/^/[DATABASE] /' &
  local database_tail_pid=$!

  cleanup_follow() {
    kill "$backend_tail_pid" "$frontend_tail_pid" "$database_tail_pid" 2>/dev/null || true
  }

  trap cleanup_follow INT TERM EXIT
  wait
}

print_usage() {
  cat <<'EOF'
Usage: plandera-dev <command>

Commands:
  start        Start database, backend, and frontend
  start-db     Start PostgreSQL and pgAdmin
  start-be     Start the Rust backend
  start-fe     Start the Next.js frontend
  stop         Stop database, backend, and frontend
  stop-db      Stop PostgreSQL and pgAdmin
  stop-be      Stop the Rust backend
  stop-fe      Stop the Next.js frontend
  restart      Restart database, backend, and frontend
  restart-be   Restart the Rust backend
  restart-fe   Restart the Next.js frontend
  build        Build backend and frontend
  build-be     Build the Rust backend
  build-fe     Build the Next.js frontend
  test         Run backend and frontend tests
  test-be      Run Rust backend tests
  test-fe      Run frontend tests
  migrate      Run database migrations
  logs         Show recent logs for all services
  logs-follow  Follow backend, frontend, and database logs
  logs-be      Follow backend logs
  logs-fe      Follow frontend logs
  logs-db      Follow database logs
EOF
}