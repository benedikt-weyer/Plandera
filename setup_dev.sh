#!/bin/bash

# Development Setup Script for Streamline Scheduler sets up the application for local development

set -e

echo "🛠️  Streamline Scheduler Development Setup"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up development environment...${NC}"

# Create .env file with development defaults if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating .env file with development defaults...${NC}"
    
    cat > .env << 'EOF'
# Streamline Scheduler Development Configuration

# Database Configuration
POSTGRES_DB=streamline_scheduler
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
POSTGRES_PORT=5432

# pgAdmin Configuration
PGADMIN_EMAIL=admin@streamline.com
PGADMIN_PASSWORD=your-super-secret-pgadmin-password
PGADMIN_PORT=5050

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
JWT_EXPIRY_HOURS=24

# Backend Configuration (Rust)
BACKEND_PORT=3001
RUST_LOG=debug

# CORS Configuration (for development)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Frontend Configuration (Next.js)
FRONTEND_PORT=3000
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001

# Nginx Configuration (for production)
HTTP_PORT=80
HTTPS_PORT=443
EOF
    
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

# Create frontend .env.local if it doesn't exist
if [ ! -f "apps/frontend/.env.local" ]; then
    echo -e "${BLUE}📝 Creating apps/frontend/.env.local...${NC}"
    
    cat > apps/frontend/.env.local << 'EOF'
# Frontend Development Environment Variables

NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001
EOF
    
    echo -e "${GREEN}✓ apps/frontend/.env.local created${NC}"
else
    echo -e "${YELLOW}⚠️  apps/frontend/.env.local already exists, skipping...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Development setup completed!${NC}"
echo ""
echo -e "${BLUE}🚀 To start the application:${NC}"
echo "   docker compose up -d"
echo ""
echo -e "${BLUE}🔧 Access URLs:${NC}"
echo "   • Frontend (Next.js): http://localhost:3000"
echo "   • Backend (Rust): http://localhost:3001"
echo "   • pgAdmin: http://localhost:5050"
echo "   • Database: localhost:5432"
echo ""
echo -e "${BLUE}🔑 pgAdmin Login:${NC}"
echo "   • Email: admin@streamline.com"
echo "   • Password: your-super-secret-pgadmin-password"
echo ""
echo -e "${GREEN}✨ Happy coding!${NC}" 