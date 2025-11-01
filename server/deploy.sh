#!/bin/bash

# Deployment script for Eventify server
# This script can be used for manual deployments or integrated with CI/CD

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="eventify/server"
COMPOSE_FILE="docker-compose.yml"

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Check if we're in the correct directory or try to navigate
if [ ! -f "$COMPOSE_FILE" ]; then
    if [ -d "$PROJECT_DIR" ]; then
        echo -e "${YELLOW}📁 Changing to project directory: $PROJECT_DIR${NC}"
        cd "$PROJECT_DIR" || exit 1
    else
        echo -e "${RED}❌ Error: $COMPOSE_FILE not found and $PROJECT_DIR doesn't exist${NC}"
        echo -e "${RED}   Please run this script from the server directory or ensure the path is correct${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}📦 Stopping and removing Docker containers...${NC}"
# Force stop and remove containers to avoid ContainerConfig metadata issues
# This handles compatibility issues with older docker-compose versions

# Stop containers if they exist (ignore errors)
docker-compose down --remove-orphans 2>/dev/null || true

# Force remove containers by name (bypasses docker-compose metadata reading)
docker stop taskme_server taskme_db 2>/dev/null || true
docker rm -f taskme_server taskme_db 2>/dev/null || true

# Force remove using docker-compose (in case containers still exist)
docker-compose rm -f 2>/dev/null || true

# Clean up any dangling containers with similar names
docker ps -a --filter "name=taskme" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true
docker ps -a --filter "name=eventify" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true

echo -e "${YELLOW}🔄 Pulling latest code from git...${NC}"
# Check if git repository exists
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not a git repository${NC}"
    exit 1
fi

# Fetch and pull latest changes
git fetch origin main || { echo -e "${RED}❌ Git fetch failed${NC}"; exit 1; }
git pull origin main || { echo -e "${RED}❌ Git pull failed${NC}"; exit 1; }

echo -e "${YELLOW}🏗️  Building Docker containers...${NC}"
# Build containers without cache to ensure fresh build
docker-compose build --no-cache || { echo -e "${RED}❌ Docker build failed${NC}"; exit 1; }

echo -e "${YELLOW}🚀 Starting Docker containers...${NC}"
# Start containers in detached mode with force recreate to avoid metadata issues
docker-compose up -d --force-recreate || { echo -e "${RED}❌ Docker start failed${NC}"; exit 1; }

echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

echo -e "${YELLOW}🔍 Checking container status...${NC}"
docker-compose ps

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

# Show recent logs
echo -e "${YELLOW}📋 Recent logs:${NC}"
docker-compose logs --tail=50

# Optional: Health check
echo -e "${YELLOW}🏥 Performing health check...${NC}"
sleep 5
SERVER_PORT=${SERVER_PORT:-8000}
if curl -f http://localhost:${SERVER_PORT}/api/v1/payment/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${RED}⚠️  Health check failed - server may still be starting${NC}"
fi

echo -e "${GREEN}🎉 All done!${NC}"

