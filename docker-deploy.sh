#!/bin/bash

# Baishakhi Project - Docker Deployment Script
# This script automates the Docker deployment process on your VPS

set -e  # Exit on any error

echo "🐳 Starting Baishakhi Docker deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/baishakhi"
DOMAIN="xn--c5b7dta6d.xn--54b7fta0cc"
VPS_IP="104.161.43.50"

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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Installing Docker first..."
    sudo apt update
    sudo apt install -y docker.io docker-compose
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    print_warning "Docker installed. Please log out and log back in, then run this script again."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Installing..."
    sudo apt install -y docker-compose
fi

print_status "Docker and Docker Compose are ready!"

# Create project directory
if [ ! -d "$PROJECT_DIR" ]; then
    print_step "Creating project directory..."
    sudo mkdir -p "$PROJECT_DIR"
    sudo chown $USER:$USER "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Check if git repository exists
if [ ! -d ".git" ]; then
    print_step "Cloning project from GitHub..."
    git clone https://github.com/nayeemx/baishakhix.git .
else
    print_step "Pulling latest changes from GitHub..."
    git pull origin main
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production file not found. Creating template..."
    cat > .env.production << EOF
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# ImageBB API Key
VITE_IMGBB_API_KEY=your_imgbb_key_here
EOF
    print_warning "Please edit .env.production with your actual Firebase credentials before continuing."
    print_status "You can edit it with: nano .env.production"
    read -p "Press Enter after you've updated the .env.production file..."
fi

# Create necessary directories
print_step "Creating Docker volumes and directories..."
mkdir -p ssl logs

# Set proper permissions
print_step "Setting proper permissions..."
sudo chown -R $USER:$USER "$PROJECT_DIR"
chmod +x docker-deploy.sh

# Stop and remove existing containers
print_step "Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Remove existing images (optional, for clean build)
print_step "Removing existing images for clean build..."
docker rmi baishakhi_baishakhi 2>/dev/null || true

# Build and start containers
print_step "Building and starting Docker containers..."
docker-compose up --build -d

# Wait for container to be ready
print_step "Waiting for container to be ready..."
sleep 10

# Check container status
print_step "Checking container status..."
if docker ps | grep -q "baishakhi-app"; then
    print_status "Container is running successfully!"
else
    print_error "Container failed to start. Checking logs..."
    docker-compose logs
    exit 1
fi

# Check if site is accessible
print_step "Checking if site is accessible..."
if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302"; then
    print_status "Site is accessible via HTTP!"
else
    print_warning "Site might not be accessible yet. Checking container logs..."
    docker-compose logs baishakhi
fi

# Setup SSL with Certbot (optional)
print_step "Setting up SSL certificate..."
read -p "Do you want to setup SSL certificate now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Setting up SSL certificate..."
    
    # Stop nginx temporarily for certbot
    docker-compose stop baishakhi
    
    # Run certbot
    docker run --rm -it \
        -v "$(pwd)/ssl:/etc/letsencrypt" \
        -v "$(pwd)/logs:/var/log/letsencrypt" \
        certbot/certbot certonly \
        --standalone \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # Update nginx.conf for SSL
    if [ -f "ssl/live/$DOMAIN/fullchain.pem" ]; then
        print_status "SSL certificate obtained successfully!"
        print_status "Updating nginx configuration for HTTPS..."
        
        # Create SSL-enabled nginx config
        cat > nginx-ssl.conf << EOF
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN www.$DOMAIN;
        root /usr/share/nginx/html;
        index index.html;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/live/$DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/$DOMAIN/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Handle React Router
        location / {
            try_files \$uri \$uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
        
        # Update docker-compose to use SSL config
        sed -i 's|./nginx.conf:/etc/nginx/nginx.conf:ro|./nginx-ssl.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
        
        # Restart with SSL
        docker-compose up -d
        print_status "HTTPS enabled! Your site is now accessible via https://$DOMAIN"
    else
        print_warning "SSL certificate setup failed. Continuing with HTTP only."
        docker-compose up -d
    fi
else
    print_status "SSL setup skipped. Site will run on HTTP only."
fi

# Display deployment summary
echo ""
echo "🎉 Docker deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   • Project: Baishakhi"
echo "   • Domain: $DOMAIN"
echo "   • VPS IP: $VPS_IP"
echo "   • Build: $(date)"
echo "   • Container: $(docker ps --format 'table {{.Names}}\t{{.Status}}' | grep baishakhi)"
echo ""
echo "🔧 Container Management:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop: docker-compose down"
echo "   • Restart: docker-compose restart"
echo "   • Update: git pull && docker-compose up --build -d"
echo ""
echo "🌐 Access your site:"
if [ -f "ssl/live/$DOMAIN/fullchain.pem" ]; then
    echo "   • HTTPS: https://$DOMAIN"
else
    echo "   • HTTP: http://$DOMAIN"
fi
echo ""
echo "📁 Project location: $PROJECT_DIR"
echo "🐳 Docker files: docker-compose.yml, Dockerfile, nginx.conf"
echo ""

# Check disk usage
print_step "Checking disk usage..."
df -h /var/www

# Check Docker disk usage
print_step "Checking Docker disk usage..."
docker system df

print_status "Deployment completed! Your Baishakhi project is now running in Docker containers."
