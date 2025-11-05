# Deployment Guide - Clue Generator Agent on Hostinger VPS

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Hostinger VPS                       │
│                                                       │
│  ┌────────────────┐                                  │
│  │  Nginx Reverse │  :80/:443                        │
│  │     Proxy      │────────┐                         │
│  └────────────────┘        │                         │
│                             │                         │
│  ┌─────────────────────────▼─────────────────┐      │
│  │  Docker Network: koopjesjacht-network     │      │
│  │                                            │      │
│  │  ┌──────────────────┐  ┌───────────────┐ │      │
│  │  │ Clue Generator   │  │  PostgreSQL   │ │      │
│  │  │  Agent Container │  │   Container   │ │      │
│  │  │   (Port 9005)    │→ │ koopjesjacht/ │ │      │
│  │  │                  │  │ koopjesjacht  │ │      │
│  │  └──────────────────┘  └───────────────┘ │      │
│  │                                            │      │
│  └────────────────────────────────────────────┘      │
│                                                       │
│  SmythOS SDK/SRE installed on host VPS              │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

### On Hostinger VPS

1. **SmythOS SDK/SRE installed** (already done per your setup)
2. **Docker and Docker Compose installed**
3. **Existing PostgreSQL container running**
4. **Nginx installed and running**
5. **Docker network `koopjesjacht-network` exists**

### Verify Prerequisites

```bash
# Check SmythOS
npm list -g @smythos/sdk

# Check Docker
docker --version
docker-compose --version

# Check existing PostgreSQL container
docker ps | grep postgres

# Check Docker network
docker network ls | grep koopjesjacht-network

# Check Nginx
nginx -v
sudo systemctl status nginx
```

## Step 1: Prepare Docker Network

If the Docker network doesn't exist yet, create it:

```bash
# Create Docker network
docker network create koopjesjacht-network

# Connect existing PostgreSQL container to the network (if not already connected)
docker network connect koopjesjacht-network <postgres-container-name>
```

## Step 2: Clone Repository

```bash
# Navigate to your projects directory
cd /opt/koopjesjacht

# Clone the repository
git clone https://github.com/your-org/clue-generator-agent.git
cd clue-generator-agent
```

## Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit if needed (default values match your existing setup)
nano .env
```

Default `.env` content (should work as-is):
```bash
DB_HOST=postgres
DB_PORT=5432
DB_NAME=koopjesjacht
DB_USER=koopjesjacht
DB_PASSWORD=koopjesjacht
PORT=9005
NODE_ENV=production
```

## Step 4: Build and Deploy Agent Container

```bash
# Build the Docker image
docker-compose build

# Start the agent container
docker-compose up -d

# Verify it's running
docker-compose ps

# Check logs
docker-compose logs -f clue-generator-agent
```

Expected output:
```
✅ Database schema initialized
✅ SmythOS Agent initialized with skills
✅ Clue Generator Agent running on port 9005
   HTTP API: http://localhost:9005
   Health: http://localhost:9005/health
```

## Step 5: Test Agent Locally

```bash
# Test health endpoint
curl http://localhost:9005/health

# Test clue generation
curl -X POST http://localhost:9005/api/generate-clue \
  -H "Content-Type: application/json" \
  -d '{
    "venue_name": "De Gouden Leeuw",
    "venue_type": "restaurant",
    "difficulty_level": 3
  }'
```

## Step 6: Configure Nginx Reverse Proxy

### Option A: Using Domain Name

```bash
# Copy nginx configuration
sudo cp nginx/clue-generator-agent.conf /etc/nginx/sites-available/

# Edit the configuration
sudo nano /etc/nginx/sites-available/clue-generator-agent.conf

# Update server_name with your domain
# server_name clue-agent.yourdomain.com;

# Create symlink
sudo ln -s /etc/nginx/sites-available/clue-generator-agent.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Option B: Using IP Address

```bash
# Edit nginx config to use IP
sudo nano /etc/nginx/sites-available/clue-generator-agent.conf

# Change server_name to:
# server_name your-vps-ip;

# Or add to existing nginx default site
sudo nano /etc/nginx/sites-available/default

# Add this location block:
location /clue-agent/ {
    proxy_pass http://localhost:9005/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Step 7: Configure Firewall

```bash
# Allow nginx HTTP/HTTPS (if not already allowed)
sudo ufw allow 'Nginx Full'

# Or manually:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check firewall status
sudo ufw status
```

## Step 8: Test External Access

### From another machine or service:

```bash
# Test health endpoint
curl http://your-vps-ip/health
# or
curl http://clue-agent.yourdomain.com/health

# Test API endpoint
curl -X POST http://your-vps-ip/api/generate-clue \
  -H "Content-Type: application/json" \
  -d '{
    "venue_name": "Test Restaurant",
    "venue_type": "restaurant",
    "difficulty_level": 2
  }'
```

## Step 9: Enable SSL/HTTPS (Optional but Recommended)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d clue-agent.yourdomain.com

# Certbot will automatically configure nginx for HTTPS
# Certificate auto-renewal is set up automatically

# Test auto-renewal
sudo certbot renew --dry-run
```

## File Locations on VPS

```
/opt/koopjesjacht/clue-generator-agent/
├── src/
│   └── agent.ts                    # Agent code
├── dist/                           # Compiled JavaScript (created by build)
├── node_modules/                   # Dependencies (in container)
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .env                            # Your configuration
├── .env.example
└── nginx/
    └── clue-generator-agent.conf   # Nginx config

/etc/nginx/
├── sites-available/
│   └── clue-generator-agent.conf   # Copied from project
└── sites-enabled/
    └── clue-generator-agent.conf   # Symlink

Docker Container:
- Name: clue-generator-agent
- Network: koopjesjacht-network
- Port: 9005 (mapped to host)
```

## Monitoring and Maintenance

### Check Agent Status

```bash
# Container status
docker ps | grep clue-generator-agent

# Detailed status
docker-compose ps

# Health check
curl http://localhost:9005/health
```

### View Logs

```bash
# Real-time logs
docker-compose logs -f clue-generator-agent

# Last 100 lines
docker-compose logs --tail=100 clue-generator-agent

# Nginx access logs
sudo tail -f /var/log/nginx/clue-generator-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/clue-generator-error.log
```

### Resource Monitoring

```bash
# Container resource usage
docker stats clue-generator-agent

# System resources
htop

# Disk usage
df -h
docker system df
```

### Database Access

```bash
# Connect to PostgreSQL container
docker exec -it <postgres-container-name> psql -U koopjesjacht -d koopjesjacht

# Query clues
SELECT * FROM clues ORDER BY created_at DESC LIMIT 10;

# Exit
\q
```

## Updating the Agent

### Method 1: Git Pull and Rebuild

```bash
cd /opt/koopjesjacht/clue-generator-agent

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Check logs
docker-compose logs -f clue-generator-agent
```

### Method 2: Quick Restart

```bash
# Restart without rebuild
docker-compose restart clue-generator-agent
```

### Method 3: Full Redeploy

```bash
# Stop and remove
docker-compose down

# Rebuild from scratch
docker-compose build --no-cache

# Start
docker-compose up -d
```

## Scaling to Multiple Instances

To run multiple agent instances:

1. **Update docker-compose.yml:**
```yaml
services:
  clue-generator-agent-1:
    # ... same config
    ports:
      - "9005:9005"
  
  clue-generator-agent-2:
    # ... same config
    ports:
      - "9006:9005"
  
  clue-generator-agent-3:
    # ... same config
    ports:
      - "9007:9005"
```

2. **Update nginx upstream:**
```nginx
upstream clue_generator_backend {
    server localhost:9005;
    server localhost:9006;
    server localhost:9007;
    keepalive 32;
}
```

3. **Deploy:**
```bash
docker-compose up -d
sudo nginx -t && sudo systemctl reload nginx
```

## Backup and Restore

### Database Backup

```bash
# Backup from PostgreSQL container
docker exec <postgres-container-name> pg_dump -U koopjesjacht koopjesjacht > backup_$(date +%Y%m%d_%H%M%S).sql

# Or backup specific table
docker exec <postgres-container-name> pg_dump -U koopjesjacht -t clues koopjesjacht > clues_backup.sql
```

### Database Restore

```bash
# Restore to PostgreSQL container
docker exec -i <postgres-container-name> psql -U koopjesjacht koopjesjacht < backup_20240101_120000.sql
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs clue-generator-agent

# Check if port is in use
sudo netstat -tulpn | grep 9005

# Verify network exists
docker network ls | grep koopjesjacht-network
```

### Cannot Connect to PostgreSQL

```bash
# Check PostgreSQL container is running
docker ps | grep postgres

# Check if PostgreSQL is on the same network
docker network inspect koopjesjacht-network

# Test connection from agent container
docker exec clue-generator-agent wget -O- http://postgres:5432 2>&1 | grep "Connection refused" || echo "Port is open"
```

### Nginx 502 Bad Gateway

```bash
# Check agent is running
curl http://localhost:9005/health

# Check nginx error logs
sudo tail -f /var/log/nginx/clue-generator-error.log

# Verify nginx config
sudo nginx -t

# Check if firewall is blocking
sudo ufw status
```

### Database Schema Issues

```bash
# Recreate schema
docker exec -i <postgres-container-name> psql -U koopjesjacht koopjesjacht << EOF
DROP TABLE IF EXISTS clues;
EOF

# Restart agent (will recreate schema)
docker-compose restart clue-generator-agent
```

## Security Best Practices

1. **Use environment variables** for sensitive data (already done)
2. **Enable SSL/HTTPS** with Let's Encrypt (see Step 9)
3. **Restrict health endpoint** to internal IPs only in nginx config
4. **Enable rate limiting** in nginx to prevent abuse
5. **Regular updates:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Update Docker images
   docker-compose pull
   docker-compose up -d
   ```
6. **Monitor logs** for suspicious activity
7. **Backup database** regularly

## Performance Tuning

### Nginx

```nginx
# In /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 1024;

# Enable gzip compression
gzip on;
gzip_types application/json;
```

### Docker

```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '1.0'      # Increase if needed
      memory: 1G       # Increase if needed
```

### PostgreSQL Connection Pool

```typescript
// In src/agent.ts
const pool = new Pool({
  max: 20,              // Adjust based on load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/generate-clue` | POST | Generate single clue |
| `/api/generate-batch` | POST | Generate multiple clues |
| `/api/clues/:hunt_id` | GET | Get clues for hunt |
| `/api/clue/:clue_id` | GET | Get specific clue |
| `/api/clue/:clue_id` | PUT | Update clue |

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Check nginx logs: `sudo tail -f /var/log/nginx/clue-generator-error.log`
3. Test locally: `curl http://localhost:9005/health`
4. Review this guide
5. Create GitHub issue

---

**Deployment Status Checklist:**

- [ ] SmythOS SDK/SRE installed on host
- [ ] PostgreSQL container running
- [ ] Docker network exists
- [ ] Agent container built
- [ ] Agent container running
- [ ] Health check passes locally
- [ ] Nginx configured
- [ ] External access working
- [ ] SSL/HTTPS enabled (optional)
- [ ] Monitoring set up

**Estimated deployment time: 15-20 minutes**
