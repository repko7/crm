#!/bin/bash
set -e

# Run on a fresh Ubuntu 22.04 VPS to set up the CRM production environment

DOMAIN=${1:?Usage: ./setup.sh yourdomain.com}

echo "=== Installing Docker ==="
apt-get update -q
apt-get install -y -q docker.io docker-compose-plugin curl

echo "=== Creating app directory ==="
mkdir -p /opt/crm/deploy/nginx/conf.d

echo "=== Copying nginx config ==="
cp -r deploy/nginx /opt/crm/deploy/

echo "=== Getting SSL certificate ==="
docker run --rm \
  -v /opt/crm/certbot-www:/var/www/certbot \
  -v /opt/crm/certbot-certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email admin@"$DOMAIN" \
  --agree-tos --non-interactive

echo "=== Creating .env ==="
cat > /opt/crm/.env <<EOF
DOMAIN=$DOMAIN
DOCKER_USERNAME=changeme
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
SERVICE_KEY=$(openssl rand -hex 16)
FRONTEND_URL=https://$DOMAIN
# Fill in the rest:
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://$DOMAIN/api/email/gmail/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EOF

echo ""
echo "✅ Setup complete!"
echo "1. Edit /opt/crm/.env and fill in API keys"
echo "2. Copy docker-compose.prod.yml to /opt/crm/"
echo "3. Run: docker compose -f /opt/crm/docker-compose.prod.yml up -d"
echo ""
echo "🔐 Database password saved to /opt/crm/.env"
