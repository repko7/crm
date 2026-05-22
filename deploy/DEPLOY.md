# Deployment Guide

## Prerequisites
- VPS with Ubuntu 22.04+ (min 2GB RAM, 2 vCPU)
- Domain pointed to server IP
- GitHub repo with secrets configured

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_TOKEN` | Docker Hub access token |
| `PROD_HOST` | Server IP or hostname |
| `PROD_USER` | SSH user (e.g. `ubuntu`) |
| `PROD_SSH_KEY` | Private SSH key |
| `PROD_API_URL` | e.g. `https://yourdomain.com/api` |

## First-Time Server Setup

```bash
# On your server
git clone https://github.com/youruser/crm.git /opt/crm
cd /opt/crm
bash deploy/setup.sh yourdomain.com
```

Edit `/opt/crm/.env` with your API keys, then:

```bash
docker compose -f /opt/crm/docker-compose.prod.yml up -d
# Run DB migration
docker compose -f docker-compose.prod.yml exec backend node src/models/migrate.js
```

## Auto-Deploy (CI/CD)

Push to `main` → GitHub Actions builds images → SSH deploys to server.

## Monitoring

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Check reminder worker
docker compose -f docker-compose.prod.yml logs -f reminder-worker

# Database backup
docker exec crm-db-1 pg_dump -U crm_user crm_db > backup.sql
```
