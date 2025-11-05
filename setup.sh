#!/bin/bash

# Clue Generator Agent - Quick Setup Script
# For Hostinger VPS with existing PostgreSQL

set -e

echo "🚀 Clue Generator Agent - Quick Setup"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose found${NC}"

# Check for .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env created${NC}"
fi

# Load environment
source .env

# Check Docker network
echo ""
echo "Checking Docker network..."
if ! docker network ls | grep -q "koopjesjacht-network"; then
    echo -e "${YELLOW}⚠️  Creating Docker network 'koopjesjacht-network'...${NC}"
    docker network create koopjesjacht-network
    echo -e "${GREEN}✅ Network created${NC}"
else
    echo -e "${GREEN}✅ Network 'koopjesjacht-network' exists${NC}"
fi

# Check PostgreSQL
echo ""
echo "Checking PostgreSQL container..."
if docker ps | grep -q "postgres"; then
    echo -e "${GREEN}✅ PostgreSQL container is running${NC}"
    
    # Try to connect existing postgres to network
    POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
    if [ -n "$POSTGRES_CONTAINER" ]; then
        echo "Found PostgreSQL container: $POSTGRES_CONTAINER"
        docker network connect koopjesjacht-network $POSTGRES_CONTAINER 2>/dev/null && \
            echo -e "${GREEN}✅ Connected PostgreSQL to network${NC}" || \
            echo -e "${YELLOW}⚠️  PostgreSQL already connected to network${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PostgreSQL container not found. Make sure it's running.${NC}"
    echo "Looking for any container with 'postgres' in the name..."
    docker ps -a | grep postgres || echo "No PostgreSQL containers found"
fi

# Build and start
echo ""
echo "Building and starting Clue Generator Agent..."
docker-compose build
docker-compose up -d

# Wait for agent to start
echo ""
echo "Waiting for agent to start..."
sleep 10

# Health check
echo ""
echo "Running health check..."
HEALTH_RESPONSE=$(curl -s http://localhost:9005/health || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Agent is healthy!${NC}"
    echo ""
    echo "$HEALTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Agent health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
    echo ""
    echo "Checking logs..."
    docker-compose logs --tail=20 clue-generator-agent
    exit 1
fi

# Show status
echo ""
echo "====================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "📍 Endpoints:"
echo "   Internal: http://localhost:9005"
echo "   Health: http://localhost:9005/health"
echo "   API: http://localhost:9005/api/"

echo ""
echo "📝 Next Steps:"
echo "1. Configure nginx reverse proxy (see DEPLOYMENT.md)"
echo "2. Test API endpoints:"
echo "   curl http://localhost:9005/health"
echo "3. View logs:"
echo "   docker-compose logs -f"

echo ""
echo "🔧 Management Commands:"
echo "   Stop:    docker-compose down"
echo "   Restart: docker-compose restart clue-generator-agent"
echo "   Logs:    docker-compose logs -f clue-generator-agent"

echo ""
