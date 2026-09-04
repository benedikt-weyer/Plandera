#!/bin/bash

# Production setup script for Streamline Scheduler
# This script helps configure the application for production use

set -e

echo "🚀 Streamline Scheduler Production Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to generate a random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate a secure JWT secret (64 characters)
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/\n" | cut -c1-64
}

# Function to prompt for user input with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local response
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " response
        echo "${response:-$default}"
    else
        read -p "$prompt: " response
        echo "$response"
    fi
}

# Function to prompt for sensitive input (hidden)
prompt_password() {
    local prompt="$1"
    local response
    
    read -s -p "$prompt: " response
    echo ""
    echo "$response"
}

echo -e "${BLUE}This script will help you set up environment variables for production.${NC}"
echo -e "${YELLOW}⚠️  Make sure to review and customize the generated files before deploying!${NC}"
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists.${NC}"
    backup_existing=$(prompt_with_default "Create backup of existing .env file? (y/n)" "y")
    if [[ $backup_existing =~ ^[Yy]$ ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo -e "${GREEN}✓ Backup created${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🔧 Configuring production environment...${NC}"
echo ""

# Generate secure secrets
echo -e "${BLUE}Generating secure secrets...${NC}"
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_jwt_secret)
PGADMIN_PASSWORD=$(generate_password)

echo -e "${GREEN}✓ Secrets generated${NC}"

# Prompt for production-specific configuration
echo ""
echo -e "${BLUE}📝 Please provide production configuration:${NC}"

DOMAIN=$(prompt_with_default "Enter your production domain (e.g., yourdomain.com)" "localhost")
ENABLE_SSL=$(prompt_with_default "Enable SSL/HTTPS? (y/n)" "y")

if [[ $ENABLE_SSL =~ ^[Yy]$ ]]; then
    PROTOCOL="https"
    HTTP_PORT="443"
    HTTPS_PORT="443"
else
    PROTOCOL="http"
    HTTP_PORT="80"
    HTTPS_PORT="443"
fi

# For production with reverse proxy, both frontend and backend use the same domain
FRONTEND_URL="${PROTOCOL}://${DOMAIN}"
BACKEND_URL="${PROTOCOL}://${DOMAIN}"

# For local development, use separate ports
if [ "$DOMAIN" = "localhost" ]; then
    FRONTEND_URL="http://localhost:3000"
    BACKEND_URL="http://localhost:3001"
fi

# Database configuration
echo ""
echo -e "${BLUE}🗄️  Database Configuration:${NC}"
DB_NAME=$(prompt_with_default "Database Name" "streamline_scheduler")
DB_USER=$(prompt_with_default "Database User" "postgres")

# Port configuration
echo ""
echo -e "${BLUE}🌐 Port Configuration:${NC}"
FRONTEND_PORT=$(prompt_with_default "Frontend Port" "3000")
BACKEND_PORT=$(prompt_with_default "Backend Port" "3001")
DB_PORT=$(prompt_with_default "Database Port" "5432")
PGADMIN_PORT=$(prompt_with_default "pgAdmin Port" "5050")

echo ""
echo -e "${BLUE}📝 Creating .env file...${NC}"

# Create the .env file
cat > .env << EOF
# Streamline Scheduler Production Configuration
# Generated on $(date)

############################################
# 🔒 SECURITY - CHANGE THESE IN PRODUCTION!
############################################

# Database Configuration
POSTGRES_DB=$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_PORT=$DB_PORT

# pgAdmin Configuration
PGADMIN_EMAIL=admin@streamline.com
PGADMIN_PASSWORD=$PGADMIN_PASSWORD
PGADMIN_PORT=$PGADMIN_PORT

# JWT Configuration (CRITICAL: Change in production!)
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY_HOURS=24

# Backend Configuration (Rust)
BACKEND_PORT=$BACKEND_PORT
RUST_LOG=info

# CORS Configuration (customize for production)
ALLOWED_ORIGINS=$FRONTEND_URL

############################################
# 🌍 FRONTEND CONFIGURATION
############################################

# Frontend Configuration (Next.js)
FRONTEND_PORT=$FRONTEND_PORT
NEXT_PUBLIC_BACKEND_HTTP_URL=$BACKEND_URL
NEXT_PUBLIC_BACKEND_WS_URL=$(echo $BACKEND_URL | sed 's/^http/ws/')

############################################
# � NGINX CONFIGURATION
############################################

# Nginx Configuration (for production)
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
EOF

echo -e "${GREEN}✓ .env file created successfully!${NC}"

# Create frontend .env.local if it doesn't exist
if [ ! -f "apps/frontend/.env.local" ]; then
    echo ""
    echo -e "${BLUE}📝 Creating apps/frontend/.env.local...${NC}"
    
    cat > apps/frontend/.env.local << EOF
# Frontend Environment Variables
# Generated on $(date)

NEXT_PUBLIC_BACKEND_HTTP_URL=$BACKEND_URL
NEXT_PUBLIC_BACKEND_WS_URL=$(echo $BACKEND_URL | sed 's/^http/ws/')
EOF
    
    echo -e "${GREEN}✓ apps/frontend/.env.local created successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  apps/frontend/.env.local already exists, skipping...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Production setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Review the generated .env file and customize as needed"
echo "2. For production, generate new Supabase keys using: supabase gen keys"
echo "3. Set up SSL/TLS termination (nginx, Cloudflare, etc.)"
echo "4. Configure your domain's DNS to point to your server"
echo "5. Start the services with: docker compose up -d"
echo ""
echo -e "${BLUE}🔧 Access URLs:${NC}"
if [ "$DOMAIN" = "localhost" ]; then
    echo "• Frontend (Next.js): $FRONTEND_URL"
    echo "• Backend (Rust): $BACKEND_URL"
else
    echo "• Application: $FRONTEND_URL"
    echo "• API Endpoints: $BACKEND_URL/api/*"
    echo "• WebSocket: $BACKEND_URL/ws"
fi
echo "• pgAdmin: ${PROTOCOL}://${DOMAIN}:$PGADMIN_PORT"
echo ""
echo -e "${BLUE}🔧 Reverse Proxy Configuration:${NC}"
if [ "$DOMAIN" != "localhost" ]; then
    echo "• The nginx.conf is configured for single-domain deployment"
    echo "• Frontend served at: $FRONTEND_URL/"
    echo "• Backend API at: $FRONTEND_URL/api/"
    echo "• WebSocket at: $FRONTEND_URL/ws"
    echo "• All traffic goes through port 443 (HTTPS) or 80 (HTTP)"
fi
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "• Change default passwords before going live"
echo "• Generate a secure JWT secret (at least 32 characters)"
echo "• Set up proper backup procedures for your database"
echo "• Consider using managed database services for production"
echo "• Configure SSL/TLS termination properly"
echo "• Review CORS settings in ALLOWED_ORIGINS"
echo "• Test API endpoints at $BACKEND_URL/api/ after deployment"
echo ""
echo -e "${GREEN}✨ Happy deploying!${NC}" 