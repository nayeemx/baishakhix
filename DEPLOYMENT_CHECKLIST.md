# 🚀 VPS Deployment Checklist

## Pre-Deployment Setup

### ✅ VPS Requirements Check
- [ ] Ubuntu 20.04.6 LTS confirmed
- [ ] Nginx installed and running
- [ ] Node.js 20.x installed
- [ ] npm 10.x installed
- [ ] Git installed
- [ ] Docker available (optional)

### ✅ Domain Configuration
- [ ] Domain: `xn--c5b7dta6d.xn--54b7fta0cc`
- [ ] VPS IP: `104.161.43.50`
- [ ] DNS A record pointing to VPS IP
- [ ] Domain propagation verified

## Deployment Steps

### 1. Project Setup
- [ ] SSH into VPS: `ssh root@104.161.43.50`
- [ ] Create web directory: `mkdir -p /var/www`
- [ ] Clone project: `git clone <repo-url> /var/www/baishakhi`
- [ ] Navigate to project: `cd /var/www/baishakhi`
- [ ] Install dependencies: `npm install`

### 2. Environment Configuration
- [ ] Create `.env.production` file
- [ ] Add Firebase API keys
- [ ] Add ImageBB API key
- [ ] Verify all environment variables

### 3. Build Process
- [ ] Run build command: `npm run build`
- [ ] Verify `dist` folder created
- [ ] Check build output size
- [ ] Test build locally if possible

### 4. Nginx Configuration
- [ ] Copy nginx config to `/etc/nginx/sites-available/baishakhi`
- [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/baishakhi /etc/nginx/sites-enabled/`
- [ ] Test nginx config: `sudo nginx -t`
- [ ] Reload nginx: `sudo systemctl reload nginx`

### 5. SSL Certificate
- [ ] Install Certbot: `sudo apt install certbot python3-certbot-nginx`
- [ ] Get SSL certificate: `sudo certbot --nginx -d xn--c5b7dta6d.xn--54b7fta0cc`
- [ ] Verify SSL configuration
- [ ] Test HTTPS access

### 6. Permissions & Security
- [ ] Set proper ownership: `sudo chown -R www-data:www-data /var/www/baishakhi`
- [ ] Set proper permissions: `sudo chmod -R 755 /var/www/baishakhi`
- [ ] Configure firewall (UFW)
- [ ] Enable only necessary ports (80, 443, 22)

### 7. Process Management (Optional)
- [ ] Install PM2: `npm install -g pm2`
- [ ] Create ecosystem file
- [ ] Start application: `pm2 start ecosystem.config.js`
- [ ] Save PM2 configuration: `pm2 save`
- [ ] Setup PM2 startup: `pm2 startup`

## Post-Deployment Verification

### ✅ Functionality Tests
- [ ] Homepage loads correctly
- [ ] Authentication system works
- [ ] Navigation menu displays properly
- [ ] Role-based access control functions
- [ ] All major modules accessible

### ✅ Performance Tests
- [ ] Page load times acceptable
- [ ] Static assets loading properly
- [ ] Gzip compression working
- [ ] Asset caching functioning
- [ ] No console errors

### ✅ Security Tests
- [ ] HTTPS redirect working
- [ ] Security headers present
- [ ] Firebase rules enforced
- [ ] Authentication required for protected routes
- [ ] No sensitive data exposed

### ✅ Monitoring Setup
- [ ] Nginx logs accessible
- [ ] Error monitoring configured
- [ ] Performance monitoring setup
- [ ] Backup strategy implemented
- [ ] Update procedures documented

## Maintenance Tasks

### 🔄 Regular Updates
- [ ] System packages: `sudo apt update && sudo apt upgrade`
- [ ] Node.js dependencies: `npm update`
- [ ] Security patches applied
- [ ] SSL certificate renewal (auto)

### 📊 Monitoring
- [ ] Check nginx logs regularly
- [ ] Monitor disk space usage
- [ ] Check memory usage
- [ ] Monitor Firebase quotas
- [ ] Review error logs

### 🛡️ Security
- [ ] Regular security audits
- [ ] Update dependencies with security patches
- [ ] Monitor access logs
- [ ] Backup configuration files
- [ ] Test disaster recovery procedures

## Troubleshooting Common Issues

### ❌ Build Failures
- [ ] Check Node.js version compatibility
- [ ] Verify all dependencies installed
- [ ] Check environment variables
- [ ] Review build logs

### ❌ Nginx Issues
- [ ] Verify nginx configuration syntax
- [ ] Check nginx error logs
- [ ] Verify file permissions
- [ ] Test nginx status

### ❌ SSL Issues
- [ ] Check certificate validity
- [ ] Verify domain configuration
- [ ] Check firewall settings
- [ ] Review Certbot logs

### ❌ Application Errors
- [ ] Check browser console
- [ ] Review Firebase console
- [ ] Check environment variables
- [ ] Verify API endpoints

## Quick Commands Reference

```bash
# Check nginx status
sudo systemctl status nginx

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Check PM2 status
pm2 status

# Restart PM2 app
pm2 restart baishakhi

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
ps aux | grep nginx
```

## Emergency Procedures

### 🚨 Site Down
1. Check nginx status: `sudo systemctl status nginx`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Restart nginx: `sudo systemctl restart nginx`
4. Check application logs if using PM2
5. Verify file permissions and ownership

### 🚨 SSL Issues
1. Check certificate: `sudo certbot certificates`
2. Renew certificate: `sudo certbot renew --force-renewal`
3. Check nginx SSL configuration
4. Verify domain DNS settings

### 🚨 Performance Issues
1. Check server resources: `htop` or `top`
2. Review nginx access logs
3. Check Firebase quotas and limits
4. Optimize images and assets
5. Enable additional caching if needed

---

**Remember**: Always backup your configuration files before making changes, and test in a staging environment if possible.
