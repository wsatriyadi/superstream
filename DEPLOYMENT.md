# Production Deployment Guide

This guide covers deploying Super Stream to a production environment with best practices for security, performance, and reliability.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Requirements](#server-requirements)
- [Deployment Options](#deployment-options)
- [Manual Deployment](#manual-deployment)
- [Docker Deployment](#docker-deployment)
- [Security Hardening](#security-hardening)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup Strategy](#backup-strategy)
- [Scaling Considerations](#scaling-considerations)

## Prerequisites

### Required Knowledge

- Linux server administration
- Basic networking concepts
- SSL/TLS certificate management
- Database administration
- Process management

### Required Access

- Root or sudo access to production server
- Domain name with DNS control
- SSL certificate (Let's Encrypt recommended)
- Google Cloud Console access

## Server Requirements

### Minimum Specifications

- **CPU**: 4 cores (2.5 GHz or higher)
- **RAM**: 8 GB
- **Storage**: 100 GB SSD (more for video storage)
- **Network**: 100 Mbps upload (per concurrent stream)
- **OS**: Ubuntu 20.04 LTS or higher (recommended)

### Recommended Specifications

- **CPU**: 8 cores (3.0 GHz or higher)
- **RAM**: 16 GB
- **Storage**: 500 GB SSD or NVMe
- **Network**: 1 Gbps upload
- **OS**: Ubuntu 22.04 LTS

### Scaling Guidelines

For each concurrent stream, add:
- 1 CPU core
- 2 GB RAM
- 10 Mbps upload bandwidth

## Deployment Options

### Option 1: Automated Installation Script (Recommended)
- One-command installation with PM2
- Handles all dependencies automatically
- Idempotent and safe to re-run
- See [Automated Installation](#automated-installation) below

### Option 2: Traditional VPS/Dedicated Server
- DigitalOcean, Linode, Vultr, AWS EC2
- Full control over environment
- Manual configuration required

### Option 3: Docker Container
- Easier deployment and updates
- Consistent environment
- Requires Docker knowledge

### Option 4: Platform as a Service (PaaS)
- Heroku, Railway, Render
- Simplified deployment
- May have limitations for FFmpeg

## Automated Installation

The easiest way to deploy Super Stream is using the automated installation script. This script handles all the setup steps automatically.

### Quick Start

```bash
# Download and run the installation script
curl -fsSL https://raw.githubusercontent.com/yourusername/superstream/main/install-superstream.sh -o install-superstream.sh
sudo bash install-superstream.sh https://github.com/yourusername/superstream.git
```

### What the Script Does

The `install-superstream.sh` script automatically:

1. Updates and upgrades system packages
2. Installs Node.js 18 and npm
3. Installs PM2 process manager globally
4. Clones the repository to `/opt/superstream`
5. Installs all Node.js dependencies
6. Creates `.env` file from template
7. Starts the application with PM2
8. Configures PM2 to start on system boot
9. Saves the PM2 process list

### Usage

```bash
# With GitHub repository URL
sudo bash install-superstream.sh https://github.com/yourusername/superstream.git

# Without URL (if app is already in /opt/superstream)
sudo bash install-superstream.sh
```

### Features

- **Idempotent**: Safe to run multiple times without breaking existing installations
- **Smart Updates**: Pulls latest changes if repository already exists
- **Dependency Checks**: Verifies Node.js version and installs if needed
- **Color-Coded Output**: Easy to follow progress with clear status messages
- **Error Handling**: Exits gracefully on errors with helpful messages
- **PM2 Integration**: Automatic process management and auto-restart on boot

### After Installation

1. **Configure Environment Variables**:
   ```bash
   sudo nano /opt/superstream/.env
   ```
   Update MongoDB URI, session secret, and other settings.

2. **Restart Application**:
   ```bash
   pm2 restart superstream
   ```

3. **View Logs**:
   ```bash
   pm2 logs superstream
   ```

4. **Check Status**:
   ```bash
   pm2 status
   ```

### Post-Installation Steps

You still need to:
- Install and configure MongoDB (see [Manual Deployment](#manual-deployment))
- Install FFmpeg for video processing
- Configure Nginx reverse proxy
- Set up SSL certificate with Let's Encrypt
- Configure firewall rules
- Set up backups

The script handles the application installation, but infrastructure components require manual setup for security and customization.

## Manual Deployment

### Step 1: Prepare the Server

#### Update System

```bash
sudo apt update
sudo apt upgrade -y
```

#### Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify v18+
```

#### Install MongoDB

```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Install FFmpeg

```bash
sudo apt install -y ffmpeg
ffmpeg -version  # Verify v4.4+
```

#### Install Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### Step 2: Configure MongoDB

#### Enable Authentication

```bash
# Connect to MongoDB
mongosh

# Switch to admin database
use admin

# Create admin user
db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD_HERE",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Exit
exit
```

#### Enable Auth in MongoDB Config

```bash
sudo nano /etc/mongod.conf
```

Add:
```yaml
security:
  authorization: enabled
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

#### Create Application Database User

```bash
mongosh -u admin -p --authenticationDatabase admin

use superstream

db.createUser({
  user: "superstream_user",
  pwd: "STRONG_PASSWORD_HERE",
  roles: [{ role: "readWrite", db: "superstream" }]
})

exit
```

### Step 3: Deploy Application

#### Create Application User

```bash
sudo useradd -m -s /bin/bash superstream
sudo su - superstream
```

#### Clone Repository

```bash
cd /home/superstream
git clone <repository-url> app
cd app
```

#### Install Dependencies

```bash
npm ci --production
```

#### Configure Environment

```bash
cp .env.example .env
nano .env
```

Production `.env`:
```env
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

MONGODB_URI=mongodb://superstream_user:PASSWORD@localhost:27017/superstream?authSource=superstream

SESSION_SECRET=<generate-64-char-random-string>
ENCRYPTION_KEY=<generate-32-char-random-string>

GOOGLE_CLIENT_ID=<your-production-client-id>
GOOGLE_CLIENT_SECRET=<your-production-client-secret>
GOOGLE_REDIRECT_URI=https://yourdomain.com/channels/oauth/callback

UPLOAD_DIR=/home/superstream/uploads
MAX_UPLOAD_SIZE=5368709120
SCHEDULER_INTERVAL=5
FFMPEG_PATH=/usr/bin/ffmpeg

LOG_LEVEL=info
```

#### Create Upload Directory

```bash
mkdir -p /home/superstream/uploads/videos
chmod 755 /home/superstream/uploads
```

#### Create Initial Admin User

```bash
mongosh "mongodb://superstream_user:PASSWORD@localhost:27017/superstream?authSource=superstream"

db.users.insertOne({
  username: "admin",
  passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu",
  email: "admin@yourdomain.com",
  createdAt: new Date(),
  updatedAt: new Date()
})

exit
```

### Step 4: Configure PM2

#### Create PM2 Ecosystem File

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'superstream',
    script: './src/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};
```

#### Start Application with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Follow the instructions to enable PM2 on system boot.

### Step 5: Configure Nginx

#### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/superstream
```

```nginx
upstream superstream_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Client body size (for video uploads)
    client_max_body_size 6G;
    client_body_timeout 300s;
    
    # Proxy settings
    location / {
        proxy_pass http://superstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Static files
    location /public {
        alias /home/superstream/app/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Logs
    access_log /var/log/nginx/superstream-access.log;
    error_log /var/log/nginx/superstream-error.log;
}
```

#### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/superstream /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Configure SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 7: Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### Step 8: Verify Deployment

1. Visit `https://yourdomain.com`
2. Login with admin credentials
3. Connect a YouTube channel
4. Upload a test video
5. Monitor logs: `pm2 logs superstream`

## Docker Deployment

### Create Dockerfile

```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads/videos

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "src/index.js"]
```

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/superstream
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:5.0
    volumes:
      - mongo-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=strongpassword
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongo-data:
```

### Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

## Security Hardening

### Application Security

1. **Environment Variables**: Never commit `.env` to version control
2. **Strong Secrets**: Use 64+ character random strings
3. **HTTPS Only**: Enforce HTTPS in production
4. **Rate Limiting**: Configure in application
5. **Input Validation**: Sanitize all user inputs

### Server Security

```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Install fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# Configure automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### MongoDB Security

- Enable authentication (done in Step 2)
- Use strong passwords
- Bind to localhost only
- Regular backups
- Keep MongoDB updated

### Regular Security Tasks

- Update system packages weekly
- Rotate secrets quarterly
- Review access logs monthly
- Audit user accounts monthly
- Test backups monthly

## Monitoring and Logging

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs superstream

# Application metrics
pm2 describe superstream
```

### System Monitoring

Install monitoring tools:

```bash
# Install htop
sudo apt install -y htop

# Install netdata (comprehensive monitoring)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### Log Management

Configure log rotation:

```bash
sudo nano /etc/logrotate.d/superstream
```

```
/home/superstream/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 superstream superstream
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### External Monitoring (Optional)

Consider using:
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **APM**: New Relic, DataDog
- **Error Tracking**: Sentry
- **Log Aggregation**: Papertrail, Loggly

## Backup Strategy

### Database Backups

Create backup script:

```bash
nano /home/superstream/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/superstream/backups"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_URI="mongodb://superstream_user:PASSWORD@localhost:27017/superstream?authSource=superstream"

mkdir -p $BACKUP_DIR

mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/db_$DATE"

# Compress backup
tar -czf "$BACKUP_DIR/db_$DATE.tar.gz" -C "$BACKUP_DIR" "db_$DATE"
rm -rf "$BACKUP_DIR/db_$DATE"

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.tar.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.tar.gz"
```

```bash
chmod +x /home/superstream/backup-db.sh
```

### Schedule Backups

```bash
crontab -e
```

Add:
```
# Daily database backup at 2 AM
0 2 * * * /home/superstream/backup-db.sh >> /home/superstream/logs/backup.log 2>&1

# Weekly video backup (adjust as needed)
0 3 * * 0 rsync -av /home/superstream/uploads/ /backup/location/uploads/
```

### Restore from Backup

```bash
# Extract backup
tar -xzf db_20231207_020000.tar.gz

# Restore to MongoDB
mongorestore --uri="mongodb://superstream_user:PASSWORD@localhost:27017/superstream?authSource=superstream" db_20231207_020000/superstream
```

## Scaling Considerations

### Vertical Scaling

Increase server resources:
- More CPU cores for concurrent streams
- More RAM for better performance
- Faster storage for video I/O

### Horizontal Scaling

For multiple servers:

1. **Load Balancer**: Nginx or HAProxy
2. **Shared Storage**: NFS or S3 for videos
3. **Distributed Locking**: Redis for scheduler
4. **Session Store**: Redis for sessions
5. **Database Replication**: MongoDB replica set

### Performance Optimization

```bash
# Enable hardware acceleration in FFmpeg
# Edit FFmpeg command generation to use:
# -hwaccel cuda (NVIDIA)
# -hwaccel qsv (Intel)

# Optimize Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Use PM2 cluster mode (if stateless)
pm2 start ecosystem.config.js -i max
```

## Maintenance

### Regular Tasks

**Daily**:
- Check application logs
- Monitor disk space
- Verify backups completed

**Weekly**:
- Review error logs
- Check system updates
- Monitor resource usage

**Monthly**:
- Update dependencies
- Review security logs
- Test backup restoration
- Audit user accounts

### Update Application

```bash
cd /home/superstream/app
git pull origin main
npm ci --production
pm2 restart superstream
```

## Troubleshooting Production Issues

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs superstream --lines 100

# Check system resources
htop

# Check disk space
df -h
```

### High CPU Usage

- Check number of concurrent streams
- Monitor FFmpeg processes
- Consider hardware acceleration
- Scale vertically or horizontally

### Database Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh "mongodb://superstream_user:PASSWORD@localhost:27017/superstream?authSource=superstream"
```

## Support

For production deployment assistance:
- Review this guide thoroughly
- Check application logs
- Consult main README troubleshooting section
- Open an issue with deployment details

## Checklist

Before going live:

- [ ] Server meets minimum requirements
- [ ] All software installed and updated
- [ ] MongoDB authentication enabled
- [ ] Strong secrets generated
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Nginx reverse proxy configured
- [ ] PM2 process manager configured
- [ ] Backups scheduled and tested
- [ ] Monitoring configured
- [ ] Logs rotating properly
- [ ] Security hardening completed
- [ ] Google OAuth configured for production domain
- [ ] Initial admin user created
- [ ] Application tested end-to-end
- [ ] Documentation reviewed

## Success!

Your Super Stream application is now deployed to production with security, monitoring, and backup strategies in place.

Remember to:
- Monitor regularly
- Keep software updated
- Test backups
- Review logs
- Scale as needed

Happy streaming! 🚀
