#!/bin/bash

# Setup script cho VPS Linux mới
# Chạy với user có sudo privileges (không phải root)

echo "🚀 Setting up VPS for 2FA System deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root. Create a regular user first."
    echo "To create a user: sudo adduser deploy && sudo usermod -aG sudo deploy"
    exit 1
fi

print_status "Starting VPS setup..."

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y curl wget git unzip htop nano ufw

# Install Node.js 18.x LTS
print_status "Installing Node.js 18.x LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js $(node --version) installed"
    print_status "npm $(npm --version) installed"
else
    print_status "Node.js already installed: $(node --version)"
fi

# Install PM2 globally
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    print_status "PM2 installed successfully"
else
    print_status "PM2 already installed"
fi

# Configure firewall
print_status "Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw allow 80
sudo ufw allow 443
print_status "Firewall configured (ports: 22, 3000, 80, 443)"

# Create project directory
PROJECT_DIR="/home/$(whoami)/2fasystem"
print_status "Creating project directory: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"

# Clone project from GitHub
print_status "Cloning project from GitHub..."
cd "/home/$(whoami)"
if [ -d "2fasystem" ]; then
    print_warning "Project directory exists, updating..."
    cd 2fasystem
    git pull origin main
else
    git clone https://github.com/mrsaidia/2fasystem.git
    cd 2fasystem
fi

# Make deploy script executable
chmod +x deploy.sh

print_status "✅ VPS setup completed!"
echo ""
echo "📋 Next steps:"
echo "  1. Run the deploy script: ./deploy.sh"
echo "  2. Your app will be available at: http://$(curl -s ifconfig.me):3000"
echo "  3. Admin panel: http://$(curl -s ifconfig.me):3000/admin"
echo ""
echo "🔧 Useful commands:"
echo "  pm2 list                 - Show all processes"
echo "  pm2 logs 2fa-system      - Show logs"
echo "  pm2 restart 2fa-system   - Restart app"
echo "  pm2 monit                - Monitor resources"
echo ""
print_status "Ready to deploy! 🎉" 