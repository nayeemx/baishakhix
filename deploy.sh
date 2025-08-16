#!/bin/bash

# Baishakhi Project Deployment Script
# This script automates the deployment process on your VPS

set -e  # Exit on any error

echo "🚀 Starting Baishakhi deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/baishakhi"
NGINX_SITE="baishakhi"
DOMAIN="xn--c5b7dta6d.xn--54b7fta0cc"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Navigate to project directory
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory $PROJECT_DIR does not exist!"
    exit 1
fi

cd "$PROJECT_DIR"

print_status "Current directory: $(pwd)"

# Check if git repository exists
if [ ! -d ".git" ]; then
    print_error "This is not a git repository!"
    exit 1
fi

# Pull latest changes
print_status "Pulling latest changes from git..."
git pull origin main

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production file not found. Please create it with your Firebase credentials."
    print_status "Creating .env.production template..."
    cat > .env.production << EOF
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyCKZyrYutsdLm5ZjIbXSYtPkJV2tMfJfhI
VITE_FIREBASE_AUTH_DOMAIN=baishakhi-server.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://baishakhi-server-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=baishakhi-server
VITE_FIREBASE_STORAGE_BUCKET=baishakhi-server.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=985648411569
VITE_FIREBASE_APP_ID=1:985648411569:web:3a7e1fc4989c7f01004390
VITE_FIREBASE_MEASUREMENT_ID=G-4K7MNP5EEX

# ImageBB API Key
VITE_IMGBB_API_KEY=d087c97ca944c3b92c2daf2ef1448be0
EOF
    print_warning "Please edit .env.production with your actual Firebase credentials before continuing."
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build production bundle
print_status "Building production bundle..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    print_error "Build failed! dist directory not found."
    exit 1
fi

print_status "Build completed successfully!"

# Set proper permissions
print_status "Setting proper permissions..."
sudo chown -R www-data:www-data "$PROJECT_DIR"
sudo chmod -R 755 "$PROJECT_DIR"
sudo chmod -R 644 "$PROJECT_DIR/dist"

# Check nginx configuration
print_status "Checking nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration is invalid!"
    exit 1
fi

# Reload nginx
print_status "Reloading nginx..."
sudo systemctl reload nginx

# Check nginx status
if sudo systemctl is-active --quiet nginx; then
    print_status "Nginx is running successfully"
else
    print_error "Nginx is not running!"
    exit 1
fi

# Check if site is accessible
print_status "Checking if site is accessible..."
if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302"; then
    print_status "Site is accessible!"
else
    print_warning "Site might not be accessible yet. Please check nginx logs."
fi

# Display deployment summary
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   • Project: Baishakhi"
echo "   • Domain: $DOMAIN"
echo "   • Build: $(date)"
echo "   • Nginx: $(sudo systemctl is-active nginx)"
echo ""
echo "🔧 Next steps:"
echo "   1. Configure SSL certificate: sudo certbot --nginx -d $DOMAIN"
echo "   2. Test your application at: https://$DOMAIN"
echo "   3. Monitor logs: sudo tail -f /var/log/nginx/baishakhi_error.log"
echo ""
echo "📁 Project location: $PROJECT_DIR"
echo "🌐 Nginx config: /etc/nginx/sites-available/$NGINX_SITE"
echo ""
