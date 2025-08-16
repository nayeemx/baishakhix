# Baishakhi Project Deployment Guide

## Project Overview
**Baishakhi** is a comprehensive business management system built with React, featuring:

### Core Technologies
- **Frontend**: React 19 + Vite 6 + Tailwind CSS 4
- **State Management**: Redux Toolkit + React Query
- **Authentication**: Firebase Auth + Firestore
- **Database**: Firebase Realtime Database + Firestore
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS with custom components

### Key Features
- **User Management**: Role-based access control (super_user, admin, manager, sales_man, stock_boy, t_staff, user)
- **Inventory Management**: Product management, barcode/QR code generation, stock tracking
- **POS System**: Point of sale with cart management and payment processing
- **Staff Management**: Attendance tracking, salary management, leave management
- **Customer/Supplier Management**: CRM functionality with transaction history
- **Reporting**: Sales reports, purchase reports, expense tracking
- **File Management**: Document uploads, image handling with ImageBB integration
- **Advanced Features**: Rich text editor (TipTap), Kanban boards, Kanban boards, database tools

## VPS Deployment Configuration

### Prerequisites
Your VPS has:
- Ubuntu 20.04.6 LTS
- Nginx
- Node.js 20.x
- npm 10.x
- Git
- Docker

### Domain Configuration
- **Domain**: xn--c5b7dta6d.xn--54b7fta0cc
- **VPS IP**: 104.161.43.50

## Deployment Steps

### 1. Clone and Setup Project
```bash
# Navigate to web directory
cd /var/www/

# Clone your project
git clone <your-repo-url> baishakhi
cd baishakhi

# Install dependencies
npm install

# Create production environment file
cp .env.example .env.production
```

### 2. Environment Configuration
Create `.env.production` with your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_IMGBB_API_KEY=your_imgbb_key
```

### 3. Build Production Bundle
```bash
# Build the project
npm run build

# The build output will be in the `dist` folder
```

### 4. Nginx Configuration
Create `/etc/nginx/sites-available/baishakhi`:
```nginx
server {
    listen 80;
    server_name xn--c5b7dta6d.xn--54b7fta0cc www.xn--c5b7dta6d.xn--54b7fta0cc;
    root /var/www/baishakhi/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Enable Site and SSL
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/baishakhi /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d xn--c5b7dta6d.xn--54b7fta0cc

# Reload nginx
sudo systemctl reload nginx
```

### 6. PM2 Process Management (Optional)
```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'baishakhi',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/baishakhi',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7. Auto-deployment Script
Create `/var/www/baishakhi/deploy.sh`:
```bash
#!/bin/bash
cd /var/www/baishakhi

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build production
npm run build

# Set proper permissions
sudo chown -R www-data:www-data /var/www/baishakhi
sudo chmod -R 755 /var/www/baishakhi

# Reload nginx
sudo systemctl reload nginx

echo "Deployment completed successfully!"
```

Make it executable:
```bash
chmod +x deploy.sh
```

## Project Structure Analysis

### Core Application Files
- **Entry Point**: `src/main.jsx` - React app initialization with Redux, Router, and Query Client
- **Main App**: `src/App.jsx` - Main application component with routing and authentication
- **State Management**: Redux store with auth, theme, and cart slices
- **Firebase Config**: `src/firebase/firebase.config.js` - Firebase services configuration

### Key Components
- **Authentication**: Login, Register, Reset password with Firebase Auth
- **Navigation**: SideNavbar with role-based menu access
- **Protected Routes**: Role-based access control for different pages
- **Inventory**: Product management, barcode generation, stock tracking
- **POS System**: Shopping cart, payment processing, invoice generation
- **Staff Management**: Attendance, salary, leave management
- **Reporting**: Sales, purchase, and expense reports
- **Tools**: Kanban boards, file manager, database tools

### Security Features
- **Firestore Rules**: Comprehensive security rules for data access
- **Role-based Access**: Hierarchical permission system
- **Protected Routes**: Component-level access control
- **Environment Variables**: Secure credential management

## Performance Optimizations

### Build Optimizations
- Vite with React plugin for fast builds
- Tailwind CSS with JIT compilation
- Asset optimization and chunking
- Gzip compression enabled

### Caching Strategy
- Static assets cached for 1 year
- API responses cached appropriately
- Browser caching headers configured

## Monitoring and Maintenance

### Log Monitoring
```bash
# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PM2 logs (if using)
pm2 logs baishakhi
```

### Regular Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Node.js (if needed)
# Use nvm or official NodeSource repository

# Update project dependencies
cd /var/www/baishakhi
npm update
npm audit fix
```

## Troubleshooting

### Common Issues
1. **Build Failures**: Check Node.js version compatibility (requires 20.x)
2. **Permission Errors**: Ensure proper ownership with `www-data` user
3. **Routing Issues**: Verify nginx try_files configuration
4. **Firebase Errors**: Check environment variables and Firebase project settings

### Performance Issues
1. **Slow Loading**: Enable gzip compression and asset caching
2. **Memory Issues**: Monitor PM2 memory usage and restart if needed
3. **Database Issues**: Check Firebase quotas and connection limits

## Security Considerations

1. **Firewall**: Configure UFW to allow only necessary ports
2. **SSL**: Always use HTTPS in production
3. **Environment Variables**: Never commit sensitive data to version control
4. **Regular Updates**: Keep system and dependencies updated
5. **Backup**: Regular backups of configuration and data

This deployment guide provides everything needed to host your Baishakhi project on your VPS with proper configuration, security, and performance optimizations.
