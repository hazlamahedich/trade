#!/bin/bash
set -euo pipefail

ENVIRONMENT="${1:-production}"

echo "=== Deploying to ${ENVIRONMENT} ==="

echo "--- Backend: Deploying to Railway ---"
if command -v railway &>/dev/null; then
    railway up --environment "${ENVIRONMENT}"
    railway status --environment "${ENVIRONMENT}"
    echo "Backend deployed successfully."
else
    echo "ERROR: Railway CLI not installed. Install with: npm i -g @railway/cli"
    echo "Then run: railway login && railway link"
    exit 1
fi

echo "--- Frontend: Deploying to Vercel ---"
if command -v vercel &>/dev/null; then
    cd trade-app/nextjs-frontend
    vercel --prod
    echo "Frontend deployed successfully."
else
    echo "ERROR: Vercel CLI not installed. Install with: npm i -g vercel"
    echo "Then run: vercel login && vercel link"
    exit 1
fi

echo "=== Deployment complete ==="
