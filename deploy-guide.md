# Hướng Dẫn Deploy 2FA System lên VPS Linux với PM2

## 🚀 Deploy Nhanh - 2 Bước Đơn Giản

### Bước 1: Setup VPS mới
```bash
# SSH vào VPS với user thường (không phải root)
ssh username@your-vps-ip

# Tải và chạy script setup
curl -fsSL https://raw.githubusercontent.com/mrsaidia/2fasystem/main/setup-vps.sh -o setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```

### Bước 2: Deploy ứng dụng
```bash
# Script setup sẽ tự động clone code, chỉ cần chạy deploy
cd 2fasystem
./deploy.sh
```

## 📋 Truy cập ứng dụng
- **User panel:** `http://your-vps-ip:3000`
- **Admin panel:** `http://your-vps-ip:3000/admin`

---

## 🔧 Hướng Dẫn Chi Tiết

### Bước 1: Chuẩn bị VPS Linux

#### Tạo user (nếu đang dùng root)
```bash
# Nếu đang SSH với root, tạo user thường
adduser deploy
usermod -aG sudo deploy
su - deploy
```

#### Cài đặt thủ công (thay vì dùng script)
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cài đặt PM2 global
sudo npm install -g pm2

# Cài đặt Git
sudo apt install git -y
```

### Bước 2: Clone source code

```bash
# Clone repository từ GitHub
git clone https://github.com/mrsaidia/2fasystem.git
cd 2fasystem
```

### Cách 2: Upload trực tiếp
```bash
# Tạo thư mục cho project
mkdir -p /home/your-username/2fa-system
cd /home/your-username/2fa-system

# Upload files qua SCP hoặc SFTP
# Từ máy local:
scp -r ./* username@your-vps-ip:/home/your-username/2fa-system/
```

### Cách 3: Sử dụng rsync
```bash
# Từ máy local:
rsync -avz --exclude node_modules ./ username@your-vps-ip:/home/your-username/2fa-system/
```

## Bước 3: Cài đặt dependencies

```bash
cd /home/your-username/2fa-system

# Cài đặt packages
npm install --production

# Tạo thư mục logs cho PM2
mkdir -p logs
```

## Bước 4: Cấu hình bảo mật

### Thay đổi JWT Secret (Quan trọng!)
```bash
# Mở file server.js và thay đổi JWT_SECRET
nano server.js

# Tìm và thay đổi dòng này:
const JWT_SECRET = 'your-super-secret-key-change-in-production';
# Thành một chuỗi random phức tạp, ví dụ:
const JWT_SECRET = 'aB3$9Kx7#mP2!vR8@qL5&wN4^tS6*uY1';
```

### Cấu hình Firewall
```bash
# Mở port 3000 (hoặc port bạn muốn)
sudo ufw allow 3000

# Kích hoạt firewall
sudo ufw enable

# Kiểm tra status
sudo ufw status
```

## Bước 5: Deploy với PM2

### Khởi chạy ứng dụng
```bash
# Sử dụng ecosystem file
pm2 start ecosystem.config.js

# Hoặc chạy trực tiếp
pm2 start server.js --name "2fa-system"
```

### Kiểm tra trạng thái
```bash
# Xem list các process
pm2 list

# Xem logs
pm2 logs 2fa-system

# Xem monitoring
pm2 monit
```

### Lưu cấu hình PM2
```bash
# Lưu current processes
pm2 save

# Tạo startup script để auto-start khi reboot
pm2 startup

# Chạy command được suggest bởi PM2 (thường là):
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u your-username --hp /home/your-username
```

## Bước 6: Cấu hình Nginx (Tùy chọn)

### Cài đặt Nginx
```bash
sudo apt install nginx -y
```

### Tạo config file
```bash
sudo nano /etc/nginx/sites-available/2fa-system
```

### Nội dung config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
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

### Kích hoạt site
```bash
sudo ln -s /etc/nginx/sites-available/2fa-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Bước 7: Cài đặt SSL với Let's Encrypt (Tùy chọn)

```bash
# Cài đặt Certbot
sudo apt install certbot python3-certbot-nginx -y

# Lấy SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

## Các lệnh PM2 thường dùng

```bash
# Khởi động
pm2 start ecosystem.config.js

# Dừng
pm2 stop 2fa-system

# Restart
pm2 restart 2fa-system

# Reload (zero-downtime)
pm2 reload 2fa-system

# Delete process
pm2 delete 2fa-system

# Xem logs realtime
pm2 logs 2fa-system --lines 100

# Xem monitoring
pm2 monit

# Xem thông tin chi tiết
pm2 describe 2fa-system
```

## Backup và Update

### Backup database
```bash
# Tạo backup thường xuyên
cp database.json database.backup.$(date +%Y%m%d_%H%M%S).json

# Hoặc tạo script backup tự động
echo "#!/bin/bash
cp /home/your-username/2fa-system/database.json /home/your-username/backups/database.backup.\$(date +%Y%m%d_%H%M%S).json
find /home/your-username/backups -name 'database.backup.*' -mtime +7 -delete" > backup.sh

chmod +x backup.sh

# Thêm vào crontab (backup hàng ngày)
echo "0 2 * * * /home/your-username/2fa-system/backup.sh" | crontab -
```

### Update code
```bash
# Pull code mới từ Git
git pull origin main

# Reinstall dependencies nếu cần
npm install --production

# Restart PM2
pm2 restart 2fa-system
```

## Troubleshooting

### Kiểm tra logs
```bash
# PM2 logs
pm2 logs 2fa-system

# System logs
sudo journalctl -u nginx
sudo tail -f /var/log/nginx/error.log
```

### Kiểm tra port đang sử dụng
```bash
sudo netstat -tlnp | grep :3000
```

### Kiểm tra process
```bash
ps aux | grep node
```

### Restart toàn bộ
```bash
pm2 restart all
sudo systemctl restart nginx
```

## Truy cập ứng dụng

- User panel: `http://your-vps-ip:3000` hoặc `http://your-domain.com`
- Admin panel: `http://your-vps-ip:3000/admin` hoặc `http://your-domain.com/admin`

**Lưu ý:** Thay đổi default admin login code ngay sau khi deploy thành công! 