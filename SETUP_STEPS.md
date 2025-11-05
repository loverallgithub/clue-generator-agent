# Step-by-Step Deployment Instructions

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Hostinger VPS access (SSH)
- [ ] SmythOS SDK/SRE installed on VPS
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Existing PostgreSQL container running
- [ ] PostgreSQL credentials: koopjesjacht/koopjesjacht
- [ ] Nginx installed and running
- [ ] Git installed

## Step 1: Connect to VPS

```bash
ssh your-user@your-vps-ip
```

## Step 2: Verify Prerequisites

```bash
# Check SmythOS
npm list -g @smythos/sdk
# Should show version 1.3.0 or higher

# Check Docker
docker --version
# Should show version 20.x or higher

# Check Docker Compose
docker-compose --version
# Should show version 2.x or higher

# Check PostgreSQL container
docker ps | grep postgres
# Should show running PostgreSQL container

# Check Nginx
nginx -v
systemctl status nginx
# Should show nginx is active

# Check Docker network
docker network ls | grep koopjesjacht-network
# If not found, we'll create it in next steps
```

## Step 3: Create Project Directory

```bash
# Navigate to projects directory
cd /opt/koopjesjacht

# Clone repository
git clone https://github.com/your-org/clue-generator-agent.git

# Or if you have the files locally, upload them:
# scp -r clue-generator-agent your-user@your-vps-ip:/opt/koopjesjacht/

# Navigate to project
cd clue-generator-agent

# List files to verify
ls -la
```

Expected files:
```
- src/agent.ts
- package.json
- tsconfig.json
- Dockerfile
- docker-compose.yml
- .env.example
- setup.sh
- nginx/clue-generator-agent.conf
- README.md
- DEPLOYMENT.md
```

## Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Check the contents
cat .env
```

The default values should work:
```
DB_HOST=postgres
DB_PORT=5432
DB_NAME=koopjesjacht
DB_USER=koopjesjacht
DB_PASSWORD=koopjesjacht
PORT=9005
NODE_ENV=production
```

**Note:** Only edit if your PostgreSQL has different credentials.

## Step 5: Setup Docker Network

```bash
# Check if network exists
docker network ls | grep koopjesjacht-network

# If it doesn't exist, create it
docker network create koopjesjacht-network

# Connect existing PostgreSQL container to network
# Find your PostgreSQL container name
docker ps | grep postgres

# Connect it (replace <postgres-container-name> with actual name)
docker network connect koopjesjacht-network <postgres-container-name>

# Verify PostgreSQL is connected
docker network inspect koopjesjacht-network | grep -A 5 postgres
```

## Step 6: Build and Start Agent

```bash
# Run the setup script (easiest method)
./setup.sh

# OR manually:
# docker-compose build
# docker-compose up -d
```

Wait for the build to complete (2-3 minutes).

## Step 7: Verify Agent is Running

```bash
# Check container status
docker-compose ps

# Should show:
# NAME                    STATUS
# clue-generator-agent    Up (healthy)

# Check logs
docker-compose logs -f clue-generator-agent

# Should see:
# ✅ Database schema initialized
# ✅ SmythOS Agent initialized with skills
# ✅ Clue Generator Agent running on port 9005

# Press Ctrl+C to exit logs

# Test health endpoint
curl http://localhost:9005/health

# Should return:
# {
#   "status": "healthy",
#   "service": "clue-generator-agent",
#   "database": "connected",
#   "timestamp": "..."
# }
```

## Step 8: Test API Locally

```bash
# Test clue generation
curl -X POST http://localhost:9005/api/generate-clue \
  -H "Content-Type: application/json" \
  -d '{
    "venue_name": "De Gouden Leeuw",
    "venue_type": "restaurant",
    "difficulty_level": 3
  }'

# Should return a clue with:
# {
#   "success": true,
#   "data": {
#     "clue_id": "...",
#     "venue_name": "De Gouden Leeuw",
#     "clue_text": "...",
#     "hint": "...",
#     "solution": "De Gouden Leeuw"
#   }
# }
```

## Step 9: Configure Nginx

### Method A: Using Provided Config File

```bash
# Copy nginx configuration
sudo cp nginx/clue-generator-agent.conf /etc/nginx/sites-available/

# Edit server_name if using a domain
sudo nano /etc/nginx/sites-available/clue-generator-agent.conf

# Change this line:
# server_name clue-agent.yourdomain.com;
# To your actual domain or VPS IP:
# server_name your-vps-ip;

# Create symlink
sudo ln -s /etc/nginx/sites-available/clue-generator-agent.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Should show:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload nginx
sudo systemctl reload nginx
```

### Method B: Add to Existing Config

```bash
# Edit your main nginx config
sudo nano /etc/nginx/sites-available/default

# Add this location block inside the server block:
location /clue-agent/ {
    proxy_pass http://localhost:9005/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}

# Save and exit (Ctrl+X, Y, Enter)

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Step 10: Configure Firewall

```bash
# Check current firewall status
sudo ufw status

# Allow HTTP and HTTPS if not already allowed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Or use nginx profile
sudo ufw allow 'Nginx Full'

# Reload firewall
sudo ufw reload

# Verify
sudo ufw status
```

## Step 11: Test External Access

### From your local machine:

```bash
# Test health endpoint
curl http://your-vps-ip/health

# OR if using Method B above:
curl http://your-vps-ip/clue-agent/health

# Should return:
# {
#   "status": "healthy",
#   "service": "clue-generator-agent",
#   "database": "connected",
#   "timestamp": "..."
# }

# Test API
curl -X POST http://your-vps-ip/api/generate-clue \
  -H "Content-Type: application/json" \
  -d '{
    "venue_name": "Test Restaurant",
    "venue_type": "restaurant",
    "difficulty_level": 2
  }'
```

## Step 12: Enable SSL/HTTPS (Optional but Recommended)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d clue-agent.yourdomain.com

# Follow the prompts:
# 1. Enter email address
# 2. Agree to terms
# 3. Choose whether to redirect HTTP to HTTPS (recommended: yes)

# Test auto-renewal
sudo certbot renew --dry-run

# Certificate will auto-renew
```

## Step 13: Verify Database

```bash
# Find your PostgreSQL container name
docker ps | grep postgres

# Connect to database (replace <postgres-container-name>)
docker exec -it <postgres-container-name> psql -U koopjesjacht -d koopjesjacht

# Check clues table
SELECT COUNT(*) FROM clues;
# Should show number of clues (at least 1 from testing)

# View recent clues
SELECT clue_id, venue_name, difficulty_level, created_at 
FROM clues 
ORDER BY created_at DESC 
LIMIT 5;

# Exit
\q
```

## Step 14: Setup Monitoring (Optional)

```bash
# Create a monitoring script
nano /opt/koopjesjacht/monitor-agent.sh
```

Add this content:
```bash
#!/bin/bash
HEALTH=$(curl -s http://localhost:9005/health | grep "healthy")
if [ -z "$HEALTH" ]; then
    echo "Agent unhealthy! Restarting..."
    cd /opt/koopjesjacht/clue-generator-agent
    docker-compose restart clue-generator-agent
fi
```

```bash
# Make it executable
chmod +x /opt/koopjesjacht/monitor-agent.sh

# Add to crontab (runs every 5 minutes)
crontab -e

# Add this line:
*/5 * * * * /opt/koopjesjacht/monitor-agent.sh
```

## Step 15: Test Everything

```bash
# 1. Health check
curl http://your-vps-ip/health

# 2. Generate clue
curl -X POST http://your-vps-ip/api/generate-clue \
  -H "Content-Type: application/json" \
  -d '{"venue_name":"Test","venue_type":"restaurant","difficulty_level":3}'

# 3. Check container logs
docker-compose logs --tail=50 clue-generator-agent

# 4. Check nginx logs
sudo tail -f /var/log/nginx/clue-generator-access.log

# 5. Check database
docker exec -it <postgres-container-name> psql -U koopjesjacht -d koopjesjacht -c "SELECT COUNT(*) FROM clues;"
```

## Troubleshooting

### Container Not Starting
```bash
docker-compose logs clue-generator-agent
docker ps -a | grep clue
```

### Cannot Connect to Database
```bash
docker network inspect koopjesjacht-network
docker exec clue-generator-agent wget -qO- http://postgres:5432 || echo "Cannot reach"
```

### Nginx 502 Error
```bash
curl http://localhost:9005/health
sudo nginx -t
sudo tail -f /var/log/nginx/clue-generator-error.log
```

### Port Already in Use
```bash
sudo netstat -tulpn | grep 9005
# Stop conflicting service or change PORT in .env
```

## Post-Deployment Checklist

- [ ] Agent container is running (`docker-compose ps`)
- [ ] Health check returns "healthy" (`curl http://localhost:9005/health`)
- [ ] Database connection works (query returns results)
- [ ] Nginx reverse proxy works (`curl http://your-vps-ip/health`)
- [ ] External access works (test from another machine)
- [ ] SSL/HTTPS enabled (if using domain)
- [ ] Firewall configured
- [ ] Logs are clean (no errors)
- [ ] Monitoring setup (optional)

## What's Next?

1. **Integrate with your application**
   - Use the API endpoints in your treasure hunt app
   - See API documentation in README.md

2. **Scale if needed**
   - Run multiple agent instances
   - See DEPLOYMENT.md for scaling instructions

3. **Monitor**
   - Check logs regularly: `docker-compose logs -f`
   - Set up alerts for health check failures

4. **Backup**
   - Regular database backups
   - See DEPLOYMENT.md for backup commands

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Review DEPLOYMENT.md for detailed troubleshooting
3. Test locally first: `curl http://localhost:9005/health`
4. Check QUICKREF.md for common commands

---

**Deployment Time:** Approximately 20-30 minutes

**Status:** Production Ready ✅
