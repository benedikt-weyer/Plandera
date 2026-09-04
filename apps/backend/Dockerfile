# Build stage
FROM rust:1.91.1-slim-trixie AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy manifests and source code
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Accept environment variables from host system as build arguments
ARG DATABASE_URL
ARG JWT_SECRET
ARG PORT
ARG RUST_LOG

# Remove any existing .env files first
RUN find . -name ".env" -not -name ".env.example" -delete 2>/dev/null || true

# Create .env file with the environment variables from build args
RUN echo "DATABASE_URL=${DATABASE_URL:-postgres://postgres:password@db:5432/streamline_scheduler}" > .env && \
    echo "JWT_SECRET=${JWT_SECRET:-default-jwt-secret-change-in-production}" >> .env && \
    echo "PORT=${PORT:-3001}" >> .env && \
    echo "RUST_LOG=${RUST_LOG:-info}" >> .env

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:trixie-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r app && useradd -r -g app app

# Create app directory
WORKDIR /app

# Copy the binary and .env file from builder stage
COPY --from=builder /app/target/release/streamline_backend /app/
COPY --from=builder /app/.env /app/

# Make sure the binary is executable and change ownership
RUN chmod +x /app/streamline_backend && chown -R app:app /app
USER app

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run the application with environment variable logging
CMD ["sh", "-c", "echo 'Starting streamline_backend...' && echo 'Environment variables:' && echo 'DATABASE_URL='$DATABASE_URL && echo 'JWT_SECRET=***' && echo 'PORT='$PORT && echo 'RUST_LOG='$RUST_LOG && echo 'Waiting for database to be fully ready...' && sleep 5 && echo 'Starting application...' && exec ./streamline_backend"]
