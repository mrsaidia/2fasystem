const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-super-secret-key-change-in-production';
const HIDDEN_CODE = '55555'; // Hidden code to change admin login code

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database file paths
const DATABASE_FILE = 'database.json';

// Load database
function loadDatabase() {
  try {
    if (fs.existsSync(DATABASE_FILE)) {
      const data = fs.readFileSync(DATABASE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading database:', error);
  }
  
  // Default database structure
  return {
    admin: {
      loginCode: 'ADMIN123',
      secret: null,
      isSetup: false
    },
    accounts: [],
    uniqueCodes: [],
    users: []
  };
}

// Save database
function saveDatabase(data) {
  try {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Routes

// Admin login with code
app.post('/api/admin/login', async (req, res) => {
  try {
    const { loginCode, twoFACode } = req.body;
    const db = loadDatabase();
    
    if (loginCode !== db.admin.loginCode) {
      return res.status(401).json({ error: 'Invalid login code' });
    }
    
    // Check 2FA if setup
    if (db.admin.secret && db.admin.isSetup) {
      if (!twoFACode) {
        return res.status(401).json({ error: '2FA code required' });
      }
      
      const verified = speakeasy.totp.verify({
        secret: db.admin.secret,
        encoding: 'base32',
        token: twoFACode,
        window: 1
      });
      
      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }
    
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, requires2FA: db.admin.secret && db.admin.isSetup });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Change admin login code
app.post('/api/admin/change-code', (req, res) => {
  try {
    const { hiddenCode, newLoginCode } = req.body;
    
    if (hiddenCode !== HIDDEN_CODE) {
      return res.status(401).json({ error: 'Invalid hidden code' });
    }
    
    if (!newLoginCode || newLoginCode.length < 6) {
      return res.status(400).json({ error: 'New login code must be at least 6 characters' });
    }
    
    const db = loadDatabase();
    db.admin.loginCode = newLoginCode.toUpperCase();
    saveDatabase(db);
    
    res.json({ success: true, message: 'Login code changed successfully' });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Setup 2FA for admin
app.post('/api/admin/setup-2fa', authenticateToken, (req, res) => {
  try {
    const db = loadDatabase();
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const secret = speakeasy.generateSecret({
      name: 'Share Account System',
      issuer: 'Your Company'
    });
    
    db.admin.secret = secret.base32;
    db.admin.isSetup = false;
    saveDatabase(db);
    
    qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) {
        return res.status(500).json({ error: 'Error generating QR code' });
      }
      
      res.json({
        secret: secret.base32,
        qrCodeUrl: dataUrl
      });
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify and complete 2FA setup
app.post('/api/admin/verify-2fa', authenticateToken, (req, res) => {
  try {
    const { token } = req.body;
    const db = loadDatabase();
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const verified = speakeasy.totp.verify({
      secret: db.admin.secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
    
    if (verified) {
      db.admin.isSetup = true;
      saveDatabase(db);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid 2FA code' });
    }
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all accounts (admin only)
app.get('/api/admin/accounts', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const db = loadDatabase();
    res.json(db.accounts);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new account (admin only)
app.post('/api/admin/accounts', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { platform, username, password, email, twoFASecret, notes } = req.body;
    const db = loadDatabase();
    
    const newAccount = {
      id: uuidv4(),
      platform,
      username,
      password,
      email,
      twoFASecret: twoFASecret || null,
      notes,
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    db.accounts.push(newAccount);
    saveDatabase(db);
    
    res.json(newAccount);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update account (admin only)
app.put('/api/admin/accounts/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    const updates = req.body;
    const db = loadDatabase();
    
    const accountIndex = db.accounts.findIndex(acc => acc.id === id);
    if (accountIndex === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Ensure twoFASecret is handled properly
    if (updates.twoFASecret === '') {
      updates.twoFASecret = null;
    }
    
    db.accounts[accountIndex] = { ...db.accounts[accountIndex], ...updates };
    saveDatabase(db);
    
    res.json(db.accounts[accountIndex]);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete account (admin only)
app.delete('/api/admin/accounts/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    const db = loadDatabase();
    
    const accountIndex = db.accounts.findIndex(acc => acc.id === id);
    if (accountIndex === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    db.accounts.splice(accountIndex, 1);
    saveDatabase(db);
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all unique codes (admin only)
app.get('/api/admin/codes', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const db = loadDatabase();
    res.json(db.uniqueCodes);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate unique code (admin only)
app.post('/api/admin/codes', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { accountId, expiresIn, usageLimit, notes } = req.body;
    const db = loadDatabase();
    
    // Check if account exists
    const account = db.accounts.find(acc => acc.id === accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const uniqueCode = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString() : null;
    
    const newCode = {
      id: uuidv4(),
      code: uniqueCode,
      accountId,
      accountInfo: {
        platform: account.platform,
        username: account.username
      },
      createdAt: new Date().toISOString(),
      expiresAt,
      isUsed: false,
      usedAt: null,
      usageCount: 0,
      usageLimit: usageLimit,
      notes
    };
    
    db.uniqueCodes.push(newCode);
    saveDatabase(db);
    
    res.json(newCode);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update unique code (admin only)
app.put('/api/admin/codes/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    const { accountId, expiresIn, usageLimit, notes } = req.body;
    const db = loadDatabase();
    
    const codeIndex = db.uniqueCodes.findIndex(code => code.id === id);
    if (codeIndex === -1) {
      return res.status(404).json({ error: 'Code not found' });
    }
    
    // Check if new account exists
    if (accountId) {
      const account = db.accounts.find(acc => acc.id === accountId);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      // Update account info
      db.uniqueCodes[codeIndex].accountId = accountId;
      db.uniqueCodes[codeIndex].accountInfo = {
        platform: account.platform,
        username: account.username
      };
    }
    
    // Update expiration
    if (expiresIn !== undefined) {
      db.uniqueCodes[codeIndex].expiresAt = expiresIn ? 
        new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString() : null;
    }
    
    // Update usage limit
    if (usageLimit !== undefined) {
      db.uniqueCodes[codeIndex].usageLimit = usageLimit;
    }
    
    // Update notes
    if (notes !== undefined) {
      db.uniqueCodes[codeIndex].notes = notes;
    }
    
    saveDatabase(db);
    res.json(db.uniqueCodes[codeIndex]);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete unique code (admin only)
app.delete('/api/admin/codes/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    const db = loadDatabase();
    
    const codeIndex = db.uniqueCodes.findIndex(code => code.id === id);
    if (codeIndex === -1) {
      return res.status(404).json({ error: 'Code not found' });
    }
    
    db.uniqueCodes.splice(codeIndex, 1);
    saveDatabase(db);
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User: Verify unique code and get account
app.post('/api/user/verify-code', (req, res) => {
  try {
    const { code } = req.body;
    const db = loadDatabase();
    
    const uniqueCode = db.uniqueCodes.find(c => c.code === code.toUpperCase());
    
    if (!uniqueCode) {
      return res.status(404).json({ error: 'Invalid code' });
    }
    
    if (uniqueCode.expiresAt && new Date() > new Date(uniqueCode.expiresAt)) {
      return res.status(400).json({ error: 'Code expired' });
    }
    
    // Check usage limit
    if (uniqueCode.usageLimit && uniqueCode.usageCount >= uniqueCode.usageLimit) {
      return res.status(400).json({ error: 'Code usage limit reached' });
    }
    
    const account = db.accounts.find(acc => acc.id === uniqueCode.accountId);
    if (!account || !account.isActive) {
      return res.status(404).json({ error: 'Account not available' });
    }
    
    // Increment usage count
    uniqueCode.usageCount = (uniqueCode.usageCount || 0) + 1;
    uniqueCode.usedAt = new Date().toISOString();
    if (!uniqueCode.isUsed) {
      uniqueCode.isUsed = true; // Mark as used for first time
    }
    saveDatabase(db);
    
    res.json({
      account: {
        platform: account.platform,
        username: account.username,
        password: account.password,
        email: account.email,
        twoFASecret: account.twoFASecret
      },
      codeInfo: {
        code: uniqueCode.code,
        expiresAt: uniqueCode.expiresAt,
        usageCount: uniqueCode.usageCount,
        usageLimit: uniqueCode.usageLimit
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve static files
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`User panel: http://localhost:${PORT}`);
  
  // Initialize database with default values
  const db = loadDatabase();
  saveDatabase(db);
  console.log(`Default admin login code: ${db.admin.loginCode}`);
}); 