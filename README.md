# Clue Generator Agent - SmythOS with HTTP API

AI-Powered Clue Generation Agent built with SmythOS SDK, containerized with Docker, and accessible via HTTP API through nginx reverse proxy.

## 🏗️ Architecture

```
External Requests → Nginx (Reverse Proxy) → Agent Container → PostgreSQL Container
                                                    ↓
                                           SmythOS Agent Skills
```

### Key Components:
- **SmythOS SDK/SRE**: Installed on host VPS
- **Agent Container**: Runs in Docker, exposes HTTP API on port 9005
- **PostgreSQL Container**: Existing database (koopjesjacht/koopjesjacht)
- **Nginx**: Reverse proxy for external access
- **Docker Network**: `koopjesjacht-network` connects all containers

## 🚀 Quick Start

### Prerequisites
- SmythOS SDK/SRE installed on host VPS
- Docker and Docker Compose installed
- Existing PostgreSQL container running
- Nginx installed
- Docker network `koopjesjacht-network` exists

### Deploy in 3 Commands

```bash
# 1. Clone and configure
git clone <repo> && cd clue-generator-agent
cp .env.example .env

# 2. Build and start
docker-compose up -d

# 3. Configure nginx (see DEPLOYMENT.md)
sudo cp nginx/clue-generator-agent.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/clue-generator-agent.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 📡 API Endpoints

All endpoints are accessible via nginx reverse proxy:

### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "service": "clue-generator-agent",
  "database": "connected",
  "timestamp": "2024-11-05T..."
}
```

### Generate Single Clue
```bash
POST /api/generate-clue

Request:
{
  "venue_name": "De Gouden Leeuw",
  "venue_type": "restaurant",
  "location": "Amsterdam",
  "difficulty_level": 3,
  "hunt_theme": "historical"
}

Response:
{
  "success": true,
  "data": {
    "clue_id": "uuid",
    "venue_name": "De Gouden Leeuw",
    "clue_text": "Seek a restaurant where...",
    "hint": "Count the letters...",
    "solution": "De Gouden Leeuw"
  }
}
```

### Generate Batch Clues
```bash
POST /api/generate-batch

Request:
{
  "venues": [
    {
      "id": "venue-1",
      "name": "Café Amsterdam",
      "type": "cafe",
      "difficulty_level": 2
    },
    {
      "id": "venue-2",
      "name": "Restaurant Roma",
      "type": "restaurant",
      "difficulty_level": 3
    }
  ],
  "hunt_id": "hunt-uuid",
  "hunt_theme": "food",
  "difficulty_level": 3
}

Response:
{
  "success": true,
  "count": 2,
  "clues": [...]
}
```

### Get Hunt Clues
```bash
GET /api/clues/:hunt_id

Response:
{
  "hunt_id": "uuid",
  "count": 5,
  "data": [...]
}
```

### Get Specific Clue
```bash
GET /api/clue/:clue_id

Response:
{
  "data": {
    "clue_id": "uuid",
    "venue_name": "...",
    "clue_text": "...",
    ...
  }
}
```

### Update Clue
```bash
PUT /api/clue/:clue_id

Request:
{
  "clue_text": "Updated clue text",
  "difficulty_level": 4
}

Response:
{
  "success": true,
  "data": {...}
}
```

## 🎨 Difficulty Levels

| Level | Type | Description |
|-------|------|-------------|
| 1 | Very Easy | Direct venue name mention |
| 2 | Easy | Simple rhyming riddles |
| 3 | Medium | Letter counting, word puzzles |
| 4 | Hard | Abstract thematic riddles |
| 5 | Very Hard | Cryptic encoded clues |

## 🗄️ Database Schema

The agent automatically creates this schema in your existing PostgreSQL:

```sql
CREATE TABLE clues (
    clue_id UUID PRIMARY KEY,
    hunt_id UUID,
    venue_id UUID,
    venue_name VARCHAR(255) NOT NULL,
    venue_type VARCHAR(100),
    difficulty_level INTEGER CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    clue_text TEXT NOT NULL,
    hint TEXT,
    solution VARCHAR(255),
    hunt_theme VARCHAR(100),
    ai_generated BOOLEAN DEFAULT false,
    context_data JSONB,
    order_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🐳 Docker Configuration

### Environment Variables

```bash
# PostgreSQL (connects to existing container)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=koopjesjacht
DB_USER=koopjesjacht
DB_PASSWORD=koopjesjacht

# Server
PORT=9005
NODE_ENV=production
```

### Network Configuration

The agent connects to the existing `koopjesjacht-network` Docker network where your PostgreSQL container is running.

### Resource Limits

Default configuration:
- CPU: 0.25-0.5 cores
- Memory: 256-512 MB

Adjust in `docker-compose.yml` if needed.

## 🔧 Management Commands

### Start Agent
```bash
docker-compose up -d
```

### Stop Agent
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f clue-generator-agent
```

### Restart Agent
```bash
docker-compose restart clue-generator-agent
```

### Rebuild Agent
```bash
docker-compose up -d --build
```

### Check Status
```bash
docker-compose ps
curl http://localhost:9005/health
```

## 🌐 External Access via Nginx

### Local Access
```bash
curl http://localhost:9005/health
```

### External Access (after nginx config)
```bash
# Via IP
curl http://your-vps-ip/health

# Via domain
curl http://clue-agent.yourdomain.com/health
```

### From Other Services
```python
# Python example
import requests

response = requests.post(
    'http://your-vps-ip/api/generate-clue',
    json={
        'venue_name': 'Test Restaurant',
        'venue_type': 'restaurant',
        'difficulty_level': 3
    }
)
print(response.json())
```

```javascript
// JavaScript example
const response = await fetch('http://your-vps-ip/api/generate-clue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    venue_name: 'Test Restaurant',
    venue_type: 'restaurant',
    difficulty_level: 3
  })
});
const data = await response.json();
console.log(data);
```

## 📊 Monitoring

### Health Check
```bash
# Internal
curl http://localhost:9005/health

# External
curl http://your-vps-ip/health
```

### Container Stats
```bash
docker stats clue-generator-agent
```

### Logs
```bash
# Application logs
docker-compose logs -f

# Nginx access logs
sudo tail -f /var/log/nginx/clue-generator-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/clue-generator-error.log
```

### Database Queries
```bash
# Connect to PostgreSQL
docker exec -it <postgres-container-name> psql -U koopjesjacht -d koopjesjacht

# Query clues
SELECT COUNT(*) FROM clues;
SELECT * FROM clues ORDER BY created_at DESC LIMIT 5;
```

## 🔒 Security

### Built-in Security Features
- ✅ Non-root container user
- ✅ Environment-based secrets
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configured
- ✅ Health check isolation option in nginx

### Recommended Additional Security

1. **Enable SSL/HTTPS:**
```bash
sudo certbot --nginx -d clue-agent.yourdomain.com
```

2. **Rate Limiting in Nginx:**
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req zone=api_limit burst=10 nodelay;
```

3. **Restrict Health Endpoint:**
```nginx
location /health {
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;
    proxy_pass http://clue_generator_backend/health;
}
```

## 🚨 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs clue-generator-agent

# Verify network
docker network inspect koopjesjacht-network

# Check port availability
sudo netstat -tulpn | grep 9005
```

### Cannot Connect to Database
```bash
# Check PostgreSQL container
docker ps | grep postgres

# Test connection from agent
docker exec clue-generator-agent wget -qO- http://postgres:5432 || echo "Cannot reach PostgreSQL"

# Verify both containers are on same network
docker network inspect koopjesjacht-network
```

### Nginx 502 Bad Gateway
```bash
# Check agent is responding
curl http://localhost:9005/health

# Check nginx config
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/clue-generator-error.log
```

### External Access Not Working
```bash
# Check firewall
sudo ufw status

# Check nginx is running
sudo systemctl status nginx

# Test locally first
curl http://localhost:9005/health

# Then through nginx
curl http://localhost/health
```

## 📁 Project Structure

```
clue-generator-agent/
├── src/
│   └── agent.ts              # Main agent with HTTP API
├── nginx/
│   └── clue-generator-agent.conf  # Nginx configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── Dockerfile                # Container build
├── docker-compose.yml        # Container orchestration
├── .env.example              # Environment template
├── .env                      # Your configuration (create this)
├── DEPLOYMENT.md             # Detailed deployment guide
└── README.md                 # This file
```

## 🔄 Updating the Agent

### Pull and Rebuild
```bash
cd /opt/koopjesjacht/clue-generator-agent
git pull origin main
docker-compose up -d --build
```

### Quick Restart
```bash
docker-compose restart clue-generator-agent
```

## 📈 Scaling

To run multiple agent instances:

1. Update `docker-compose.yml`:
```yaml
clue-generator-agent-1:
  ports:
    - "9005:9005"

clue-generator-agent-2:
  ports:
    - "9006:9005"
```

2. Update nginx upstream:
```nginx
upstream clue_generator_backend {
    server localhost:9005;
    server localhost:9006;
}
```

3. Deploy:
```bash
docker-compose up -d
sudo systemctl reload nginx
```

## 📚 Documentation

- **README.md** (this file) - Overview and API reference
- **DEPLOYMENT.md** - Detailed deployment steps
- **nginx/clue-generator-agent.conf** - Nginx configuration with comments

## 🤝 Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Test locally: `curl http://localhost:9005/health`
3. Check nginx: `sudo nginx -t`
4. Review DEPLOYMENT.md
5. Create GitHub issue

## 📄 License

MIT License

---

**Built with SmythOS SDK** | **Dockerized** | **Production Ready**
