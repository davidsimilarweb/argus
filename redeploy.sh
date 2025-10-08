#!/bin/bash

# Redeploy Argus - Build backend, frontend, and restart services
set -e  # Exit on any error

echo "🔨 Building backend..."
cd backend
npm run build

echo "🎨 Building frontend..."
cd ../frontend
npm run build

echo "🔄 Restarting backend (PM2)..."
cd ..
pm2 restart argus-backend

echo "🔄 Restarting Caddy..."
./restart-caddy.sh

echo "✅ Redeploy complete!"
