#!/bin/bash

# Deploy script cho 2FA System
# Chạy script này trên VPS Linux

echo "🚀 Starting deployment for 2FA System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
# if [ "$EUID" -eq 0 ]; then
#     print_error "Please don't run this script as root"
#     exit 1
# fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 is not installed. Installing PM2..."
    sudo npm install -g pm2
fi

# Create project directory if it doesn't exist
PROJECT_DIR="/home/$(whoami)/2fa-system"
print_status "Creating project directory: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs

# Create .env file from config
print_status "Creating .env file..."
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
JWT_SECRET=aB3$9Kx7#mP2!vR8@qL5&wN4^tS6*uY1$9zM3&nQ8@rT4
HIDDEN_CODE=98765
EOF
    chmod 600 .env
    print_status ".env file created with secure permissions"
fi

# Install dependencies
if [ -f "package.json" ]; then
    print_status "Installing Node.js dependencies..."
    npm install --production
else
    print_error "package.json not found. Please upload your project files first."
    exit 1
fi

# Check if ecosystem.config.js exists
if [ ! -f "ecosystem.config.js" ]; then
    print_warning "ecosystem.config.js not found. Creating default configuration..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: '2fa-system',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF
fi

# Stop existing PM2 process if running
print_status "Stopping existing PM2 processes..."
pm2 stop 2fa-system 2>/dev/null || true
pm2 delete 2fa-system 2>/dev/null || true

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save

# Setup PM2 startup
print_status "Setting up PM2 startup..."
pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami)) | grep "sudo env" | bash || true

# Show status
print_status "Checking application status..."
pm2 list
pm2 logs 2fa-system --lines 10

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 3000 2>/dev/null || true

echo ""
print_status "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Your application is running at: http://$(curl -s ifconfig.me):3000"
echo "  2. Admin panel: http://$(curl -s ifconfig.me):3000/admin"
echo "  3. Remember to change JWT_SECRET in server.js for production"
echo "  4. Consider setting up Nginx as reverse proxy"
echo "  5. Set up SSL certificate for HTTPS"
echo ""
echo "🔧 Useful commands:"
echo "  pm2 list                 - Show all processes"
echo "  pm2 logs 2fa-system      - Show application logs"
echo "  pm2 restart 2fa-system   - Restart application"
echo "  pm2 stop 2fa-system      - Stop application"
echo "  pm2 monit                - Monitor resources"
echo ""
print_status "Happy coding! 🎉" 