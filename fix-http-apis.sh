#!/bin/bash
echo "🔧 Fixing HTTP API issues..."

echo "📤 Pushing to GitHub..."
git add .
git commit -m "Fix crypto.subtle and clipboard API for HTTP deployment"
git push origin main

echo "✅ Code pushed! Now run on VPS:"
echo ""
echo "ssh your-user@your-vps-ip"
echo "cd 2fasystem"
echo "git pull origin main"
echo "pm2 restart 2fa-system"
echo ""
echo "🎯 After update:"
echo "- 2FA codes will generate with fallback algorithm"
echo "- Copy buttons will use fallback text selection"
echo "- No more crypto.subtle or clipboard API errors"
echo ""
echo "🌐 Test: http://your-vps-ip:3000" 