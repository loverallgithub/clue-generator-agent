# Quick Reference - Clue Generator Agent

## 🚀 One-Line Deploy
```bash
./setup.sh
```

## 📍 Important Locations

### On VPS
- **Project:** `/opt/koopjesjacht/clue-generator-agent`
- **Nginx Config:** `/etc/nginx/sites-available/clue-generator-agent.conf`
- **Nginx Symlink:** `/etc/nginx/sites-enabled/clue-generator-agent.conf`

### Container
- **Name:** `clue-generator-agent`
- **Network:** `koopjesjacht-network`
- **Port:** `9005`

## 🔧 Common Commands

### Container Management
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart clue-generator-agent

# Rebuild
docker-compose up -d --build

# Status
docker-compose ps

# Logs
docker-compose logs -f clue-generator-agent
```

### Health Checks
```bash
# Local
curl http://localhost:9005/health

# External (after nginx setup)
curl http://your-vps-ip/health
```

### Nginx
```bash
# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# Logs
sudo tail -f /var/log/nginx/clue-generator-access.log
sudo tail -f /var/log/nginx/clue-generator-error.log
```

### Database
```bash
# Connect
docker exec -it <postgres-container> psql -U koopjesjacht -d koopjesjacht

# Query clues
SELECT * FROM clues ORDER BY created_at DESC LIMIT 10;

# Count clues
SELECT COUNT(*) FROM clues;
```

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/generate-clue` | POST | Generate single clue |
| `/api/generate-batch` | POST | Generate multiple clues |
| `/api/clues/:hunt_id` | GET | Get clues for hunt |
| `/api/clue/:clue_id` | GET | Get specific clue |
| `/api/clue/:clue_id` | PUT | Update clue |

## 🧪 Quick Tests

### Health Check
```bash
curl http://localhost:9005/health
```

### Generate Clue
```bash
curl -X POST http://localhost:9005/api/generate-clue \
  -H "Content-Type: application/json" \
  -d '{
    "venue_name": "Test Restaurant",
    "venue_type": "restaurant",
    "difficulty_level": 3
  }'
```

### Get Clues
```bash
curl http://localhost:9005/api/clues/your-hunt-id
```

## 🚨 Troubleshooting

### Container Not Starting
```bash
docker-compose logs clue-generator-agent
docker ps -a | grep clue
sudo netstat -tulpn | grep 9005
```

### Database Connection Failed
```bash
docker ps | grep postgres
docker network inspect koopjesjacht-network
docker exec clue-generator-agent wget -qO- http://postgres:5432
```

### Nginx 502 Error
```bash
curl http://localhost:9005/health
sudo nginx -t
sudo tail -f /var/log/nginx/clue-generator-error.log
```

## 🔄 Update Process
```bash
cd /opt/koopjesjacht/clue-generator-agent
git pull origin main
docker-compose up -d --build
docker-compose logs -f clue-generator-agent
```

## 📊 Monitoring
```bash
# Container stats
docker stats clue-generator-agent

# System resources
htop

# Disk usage
docker system df
df -h
```

## 🔒 Security Checklist
- [ ] SSL/HTTPS enabled (certbot)
- [ ] Rate limiting configured (nginx)
- [ ] Firewall rules set (ufw)
- [ ] Health endpoint restricted (nginx)
- [ ] Regular updates scheduled
- [ ] Backups automated

## 🎯 Difficulty Levels

| Level | Type |
|-------|------|
| 1 | Very Easy - Direct hints |
| 2 | Easy - Simple riddles |
| 3 | Medium - Word puzzles |
| 4 | Hard - Abstract riddles |
| 5 | Very Hard - Cryptic clues |

## 📞 Support

1. Check logs: `docker-compose logs -f`
2. Test locally: `curl http://localhost:9005/health`
3. Review DEPLOYMENT.md
4. Check nginx: `sudo nginx -t`
5. GitHub issues

## 🔗 Useful Links

- **Documentation:** README.md
- **Deployment Guide:** DEPLOYMENT.md
- **Nginx Config:** nginx/clue-generator-agent.conf
- **SmythOS Docs:** https://smythos.com/docs

---

**Need help?** Check DEPLOYMENT.md for detailed instructions.
