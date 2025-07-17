#!/bin/bash
echo "🔧 Quick update for crypto API fix..."

# Add changes to git
git add .
git commit -m "Fix crypto.subtle API for HTTP environments"
git push origin main

echo "✅ Code pushed to GitHub!"
echo ""
echo "📋 Now run on VPS:"
echo "ssh your-user@your-vps-ip"
echo "cd 2fasystem"
echo "git pull origin main"
echo "pm2 restart 2fa-system"
echo ""
echo "🌐 Then test: http://your-vps-ip:3000" 