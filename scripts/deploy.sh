#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TRADE_APP="$PROJECT_ROOT/trade-app"

usage() {
  echo "Usage: $0 <environment>"
  echo "  environments: local, staging, production"
  exit 1
}

if [ $# -ne 1 ]; then
  usage
fi

ENV="$1"

deploy_local() {
  echo "=== Deploying locally with Docker Compose ==="
  cd "$TRADE_APP"
  docker compose build
  docker compose up -d
  echo "Waiting for services..."
  sleep 5
  echo "Running database migrations..."
  docker compose run --rm backend alembic upgrade head
  echo ""
  echo "=== Local deployment ready ==="
  echo "  Frontend:  http://localhost:3000"
  echo "  Backend:   http://localhost:8001"
  echo "  MailHog:   http://localhost:8025"
  echo "  PostgreSQL: localhost:5435"
  echo "  Redis:     localhost:6379"
}

deploy_staging() {
  echo "=== Deploying to staging ==="
  echo "Frontend (Vercel)..."
  cd "$TRADE_APP/nextjs-frontend"
  pnpm install
  pnpm run build
  npx vercel --yes --scope=trade-app 2>/dev/null || echo "Vercel CLI not configured. Run 'npx vercel login' first."

  echo ""
  echo "Backend (Railway)..."
  cd "$TRADE_APP/fastapi_backend"
  if command -v railway &> /dev/null; then
    railway up || echo "Railway not linked. Run 'railway init' first."
    railway run alembic upgrade head 2>/dev/null || true
  else
    echo "Railway CLI not installed. Install with: npm i -g @railway/cli"
    echo "Then run: railway login && railway init && railway up"
  fi
  echo ""
  echo "=== Staging deployment complete ==="
}

deploy_production() {
  echo "=== Deploying to production ==="
  echo "WARNING: This deploys to production. Are you sure? [y/N]"
  read -r confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi

  echo "Frontend (Vercel)..."
  cd "$TRADE_APP/nextjs-frontend"
  pnpm install
  pnpm run build
  npx vercel --prod --yes --scope=trade-app 2>/dev/null || echo "Vercel CLI not configured."

  echo ""
  echo "Backend (Railway)..."
  cd "$TRADE_APP/fastapi_backend"
  if command -v railway &> /dev/null; then
    railway up || echo "Railway not linked."
    railway run alembic upgrade head 2>/dev/null || true
  else
    echo "Railway CLI not installed."
  fi
  echo ""
  echo "=== Production deployment complete ==="
}

case "$ENV" in
  local)
    deploy_local
    ;;
  staging)
    deploy_staging
    ;;
  production)
    deploy_production
    ;;
  *)
    usage
    ;;
esac
