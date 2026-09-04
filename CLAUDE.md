# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Plandera (formerly Streamline Scheduler) is a self-hostable calendar/todo-list app with true end-to-end
encryption. Frontend: Next.js 14+ / React 19 / TypeScript / Tailwind / shadcn-ui. Backend: Rust (Axum +
SeaORM + PostgreSQL). Real-time sync via WebSocket.

## Commands

Enter the dev shell first (`nix develop`, or `direnv allow` since `.envrc` uses `use flake`). The shell
exposes wrapper scripts (in `scripts/`, all delegating to `scripts/plandera-dev`) for the whole stack —
prefer these over raw `cargo`/`pnpm` invocations when working across both services:

```bash
start / stop / restart          # whole stack: db + backend + frontend
start-db / start-be / start-fe  # individual services
stop-be / stop-fe / stop-db
restart-be / restart-fe
build                           # build backend and frontend
migrate                         # run SeaORM migrations
test                            # run backend + frontend tests
test-be / test-fe               # test one side only
logs / logs-be / logs-fe / logs-db / logs-follow
```

### Frontend (`frontend/`, package manager is pnpm)

```bash
pnpm dev                        # next dev
pnpm build
pnpm test                       # jest (ts-jest, jsdom env)
pnpm test:watch
pnpm exec jest test/path/to/file.test.ts   # single test file
```

Test files live under `frontend/test/` (mirroring `app/`, `components/`, `utils/`), matched by
`test/**/*.test.ts?(x)`, not colocated with source. `@/*` path alias maps to the frontend root.

### Backend (`apps/backend/`, Rust 2024 edition)

```bash
cargo run                       # applies SeaORM migrations on startup, then serves
cargo test
cargo test test_name            # single test
cargo watch -x run              # hot reload (used by start-be)
cargo fmt && cargo clippy
```

Requires `DATABASE_URL` and `JWT_SECRET` env vars (set automatically by the Nix shellHook from `.env`,
or copy `apps/backend/env.example` to `apps/backend/.env` for manual setup).

## Architecture

### Zero-knowledge encryption model

The server never sees plaintext. Every user-data table (`calendar_events`, `can_do_list`, `projects`,
`calendars`, `countdowns`, `user_settings`) stores only opaque `encrypted_data` + `iv` + `salt` columns
(see `apps/backend/src/entities/`) — the Rust backend has no notion of an event's title, a task's due date,
etc., it just stores and returns ciphertext blobs.

Client-side (`frontend/utils/cryptography/encryption.ts`): a master password is PBKDF2-derived into
separate auth and encryption keys (different salts, `hashPasswordForAuth` vs `hashPasswordForEncryption`),
AES-CBC encrypt/decrypt per record. The derived encryption key is cached in a cookie
(`storeEncryptionKey`/`getStoredEncryptionKey`) so the master password itself is never persisted or sent
to the server — losing it means losing access to the data (no server-side recovery is possible).

### Frontend API layering

Three layers, each with its own interface — when adding a new resource type, all three need updating:

1. `utils/api/backend-interface.ts` — `BackendInterface`: transport contract, only deals in `*Encrypted`
   payloads (e.g. `CalendarEventEncrypted`).
2. `utils/api/rust-backend-impl.ts` — `RustBackendImpl`: implements `BackendInterface` over HTTP + the
   `/ws` WebSocket, talking to the Rust backend. URLs are resolved at runtime from `/api/config`
   (`utils/api/init.ts`) rather than baked in at build time, so a container's `NEXT_PUBLIC_BACKEND_URL`
   can differ per deployment without a rebuild.
3. `utils/api/decrypted-backend-impl.ts` — `DecryptedBackendImpl`: wraps a `BackendInterface` and exposes
   `DecryptedBackendInterface`, encrypting requests / decrypting responses transparently. Feature code
   (services in `frontend/services/*`, components) is written against the decrypted interface and should
   never see ciphertext.

`frontend/services/*` (calendar, calendar-events, projects, tasks) sit above the decrypted backend and
hold feature-level logic (sorting, recurrence expansion, validation) — this is the layer components call
into, not the backend interfaces directly.

State: Zustand stores in `frontend/stores/` hold local UI/session state (current calendar week,
highlighted event, settings, task-navigation); they are not the source of truth for persisted data, which
flows through the API layers above and is kept in sync via WebSocket push.

### Backend request flow

`apps/backend/src/main.rs` wires two router groups: public (`/api/auth/register`, `/api/auth/login`,
`/health`, `/ws`) and protected, where `middleware::auth::auth_middleware` validates the JWT and injects
`AuthUser` as an extractor for handlers. Handlers (`apps/backend/src/handlers/`) follow a consistent
CRUD-per-resource shape backed by SeaORM entities (`apps/backend/src/entities/`), scoping every query by
`user_id`. Migrations are plain SeaORM migration files under `apps/backend/src/migrator/`, numbered
sequentially, and run automatically at startup (`Migrator::up`) — a schema change means adding a new
migration file, not editing an old one.

### Real-time sync (WebSocket)

`apps/backend/src/websocket/mod.rs`: `WebSocketState` maps `user_id -> Vec<WebSocketConnection>` (multiple
tabs/devices per user), each connection identified by a `connection_id`. On connect, the client's first
message must carry the JWT for auth. After any mutating handler writes to the DB, it calls
`ws_state.broadcast_to_user(user_id, message, connection_id)`, passing its *own* connection_id as
`exclude_connection_id` so the origin tab doesn't get echoed its own update — the `X-Connection-Id`
request header (see `extract_connection_id` in handlers) is how the frontend tells the backend which
connection to exclude. Broadcast payloads carry `event_type` (`INSERT`/`UPDATE`/`DELETE`), `table`, and
the already-encrypted `data` — decryption happens client-side like any other fetched record.

## License

Custom license (see `LICENSE`): personal self-hosting only. Selling it, monetizing hosting, or embedding
it in proprietary projects is prohibited.
