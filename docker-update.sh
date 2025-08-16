#!/bin/bash

# Baishakhi Project - Docker Update Script
# Quick script to update and redeploy your project

echo "🔄 Updating Baishakhi project..."

cd /var/www/baishakhi

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Rebuild and restart containers
echo "🔨 Rebuilding Docker containers..."
docker-compose down
docker-compose up --build -d

# Check status
echo "✅ Checking container status..."
docker ps | grep baishakhi

echo "🎉 Update completed! Your site is now running the latest version."
echo "🌐 Access: http://xn--c5b7dta6d.xn--54b7fta0cc"
