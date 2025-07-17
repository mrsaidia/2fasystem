// DOM elements
const codeInputSection = document.getElementById('codeInputSection');
const accountInfoSection = document.getElementById('accountInfoSection');
const codeForm = document.getElementById('codeForm');
const codeError = document.getElementById('codeError');
const codeLoading = document.getElementById('codeLoading');

// Account data
let accountData = null;
let codeData = null;
let isPasswordVisible = false;
let is2FAVisible = false;
let twoFAInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    // Auto-focus on code input
    document.getElementById('uniqueCode').focus();
});



// Event listeners
function setupEventListeners() {
    // Code form submission
    codeForm.addEventListener('submit', handleCodeSubmit);
    
    // Auto-format code input (uppercase, no spaces)
    document.getElementById('uniqueCode').addEventListener('input', function(e) {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length > 12) {
            value = value.substring(0, 12);
        }
        e.target.value = value;
    });
    
    // Enter key on code input
    document.getElementById('uniqueCode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleCodeSubmit(e);
        }
    });
    
    // Copy buttons with data-copy attribute
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-copy]')) {
            const button = e.target.closest('[data-copy]');
            const copyTarget = button.getAttribute('data-copy');
            copyToClipboard(copyTarget);
        }
    });
    
    // Back button
    document.addEventListener('click', function(e) {
        if (e.target.closest('#backBtn')) {
            resetForm();
        }
    });
    
    // Copy All button
    document.addEventListener('click', function(e) {
        if (e.target.closest('#copyAllBtn')) {
            copyAllInfo();
        }
    });
}

// Main functions
async function handleCodeSubmit(e) {
    e.preventDefault();
    
    const code = document.getElementById('uniqueCode').value.trim();
    
    if (!code) {
        showError('Please enter unique code');
        return;
    }
    
    if (code.length !== 12) {
        showError('Unique code must be exactly 12 characters');
        return;
    }
    
    showLoading(true);
    hideError();
    
    try {
        const response = await fetch('/api/user/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            accountData = data.account;
            codeData = data.codeInfo;
            showAccountInfo();
        } else {
            showError(getErrorMessage(data.error));
        }
    } catch (error) {
        showError('Server connection error. Please try again.');
    } finally {
        showLoading(false);
    }
}

function showAccountInfo() {
    // Hide code input section
    codeInputSection.classList.add('hidden');
    
    // Fill account information
    document.getElementById('accountPlatform').textContent = accountData.platform;
    
    // Handle username (optional)
    const usernameElement = document.getElementById('accountUsername');
    const usernameItem = usernameElement.closest('.credential-item');
    
    if (accountData.username) {
        usernameElement.textContent = accountData.username;
        usernameItem.style.display = 'flex';
    } else {
        usernameItem.style.display = 'none';
    }
    
    // Handle password (optional)
    const passwordElement = document.getElementById('accountPassword');
    const passwordItem = passwordElement.closest('.credential-item');
    
    if (accountData.password) {
        passwordElement.textContent = accountData.password;
        passwordItem.style.display = 'flex';
    } else {
        passwordItem.style.display = 'none';
    }
    
    // Handle email (optional)
    const emailElement = document.getElementById('accountEmail');
    const emailItem = document.getElementById('emailItem');
    
    if (accountData.email) {
        emailElement.textContent = accountData.email;
        emailItem.style.display = 'flex';
    } else {
        emailItem.style.display = 'none';
    }
    
    // Handle 2FA secret (might be empty)
    const twoFAElement = document.getElementById('account2FA');
    const twoFAItem = document.getElementById('twoFAItem');
    
    if (accountData.twoFASecret) {
        // Start generating 6-digit 2FA codes
        start2FACodeGeneration();
        twoFAItem.style.display = 'block';
    } else {
        twoFAItem.style.display = 'none';
    }
    
    // Fill code information
    if (codeData) {
        // Code expiry date
        if (codeData.expiresAt) {
            const expiryDate = new Date(codeData.expiresAt);
            document.getElementById('codeExpiryDate').textContent = expiryDate.toLocaleString();
        } else {
            document.getElementById('codeExpiryDate').textContent = 'Never';
        }
        
        // Usage count and remaining
        document.getElementById('usageCount').textContent = codeData.usageCount || 0;
        
        if (codeData.usageLimit) {
            const remaining = codeData.usageLimit - (codeData.usageCount || 0);
            document.getElementById('remainingUses').textContent = remaining;
        } else {
            document.getElementById('remainingUses').textContent = '∞';
        }
    }
    
    // Show account info section
    accountInfoSection.classList.remove('hidden');
    
    // Scroll to account info
    accountInfoSection.scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    // Clear any running 2FA intervals
    if (twoFAInterval) {
        clearInterval(twoFAInterval);
        twoFAInterval = null;
    }
    
    // Hide account info section
    accountInfoSection.classList.add('hidden');
    
    // Show code input section
    codeInputSection.classList.remove('hidden');
    
    // Clear form and data
    document.getElementById('uniqueCode').value = '';
    accountData = null;
    codeData = null;
    hideError();
    
    // Focus on input
    document.getElementById('uniqueCode').focus();
    
    // Scroll to top
    codeInputSection.scrollIntoView({ behavior: 'smooth' });
}

function togglePassword() {
    isPasswordVisible = !isPasswordVisible;
    updatePasswordDisplay();
}

function toggle2FA() {
    is2FAVisible = !is2FAVisible;
    update2FADisplay();
}

function updatePasswordDisplay() {
    const passwordElement = document.getElementById('accountPassword');
    const toggleIcon = document.getElementById('passwordToggleIcon');
    
    if (isPasswordVisible) {
        passwordElement.textContent = accountData.password;
        passwordElement.classList.remove('password-hidden');
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passwordElement.textContent = '••••••••';
        passwordElement.classList.add('password-hidden');
        toggleIcon.className = 'fas fa-eye';
    }
}

function update2FADisplay() {
    const twoFAElement = document.getElementById('account2FA');
    const toggleIcon = document.getElementById('twoFAToggleIcon');
    
    if (accountData.twoFASecret) {
        if (is2FAVisible) {
            twoFAElement.textContent = accountData.twoFASecret;
            twoFAElement.classList.remove('password-hidden');
            toggleIcon.className = 'fas fa-eye-slash';
        } else {
            twoFAElement.textContent = '••••••••';
            twoFAElement.classList.add('password-hidden');
            toggleIcon.className = 'fas fa-eye';
        }
    }
}

// Copy functions
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    let textToCopy = element.textContent;
    
    // For password, copy the actual password even if hidden
    if (elementId === 'accountPassword' && !isPasswordVisible) {
        textToCopy = accountData.password;
    }
    
    // For 2FA code, copy the 6-digit code without spaces
    if (elementId === 'account2FA') {
        // Remove spaces from the displayed 2FA code
        textToCopy = textToCopy.replace(/\s/g, '');
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showCopySuccess(elementId);
    }).catch(err => {
        // Fallback for older browsers
        fallbackCopyTextToClipboard(textToCopy, elementId);
    });
}

function fallbackCopyTextToClipboard(text, elementId) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopySuccess(elementId);
    } catch (err) {
        showError('Cannot copy. Please copy manually.');
    }
    
    document.body.removeChild(textArea);
}

function copyAllInfo() {
    let allInfo = `Platform: ${accountData.platform}\n`;
    
    if (accountData.username) {
        allInfo += `Username: ${accountData.username}\n`;
    }
    
    if (accountData.password) {
        allInfo += `Password: ${accountData.password}\n`;
    }
    
    if (accountData.email) {
        allInfo += `Email: ${accountData.email}\n`;
    }
    
    if (accountData.twoFASecret) {
        const twoFAElement = document.getElementById('account2FA');
        const currentCode = twoFAElement ? twoFAElement.textContent.replace(/\s/g, '') : '';
        allInfo += `2FA Code: ${currentCode}\n`;
    }
    
    // Add code information
    if (codeData) {
        if (codeData.expiresAt) {
            const expiryDate = new Date(codeData.expiresAt);
            allInfo += `Code Expires: ${expiryDate.toLocaleString()}\n`;
        }
        allInfo += `Usage Count: ${codeData.usageCount || 0}\n`;
        if (codeData.usageLimit) {
            const remaining = codeData.usageLimit - (codeData.usageCount || 0);
            allInfo += `Remaining Uses: ${remaining}\n`;
        }
    }
    
    navigator.clipboard.writeText(allInfo).then(() => {
        showCopySuccess('all');
    }).catch(err => {
        fallbackCopyTextToClipboard(allInfo, 'all');
    });
}

function showCopySuccess(elementId) {
    // Create a temporary success message
    const successMessage = document.createElement('div');
    successMessage.className = 'copy-success';
    successMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1001;
        font-weight: 600;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
    `;
    
    const messages = {
        'accountUsername': 'Username copied!',
        'accountPassword': 'Password copied!',
        'accountEmail': 'Email copied!',
        'account2FA': '2FA Code copied!',
        'all': 'All information copied!'
    };
    
    successMessage.textContent = messages[elementId] || 'Copied!';
    document.body.appendChild(successMessage);
    
    // Animate in
    setTimeout(() => {
        successMessage.style.opacity = '1';
        successMessage.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 2 seconds
    setTimeout(() => {
        successMessage.style.opacity = '0';
        successMessage.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            document.body.removeChild(successMessage);
        }, 300);
    }, 2000);
}

// Utility functions
function showError(message) {
    codeError.textContent = message;
    codeError.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

function hideError() {
    codeError.classList.remove('show');
    codeError.textContent = '';
}

function showLoading(show) {
    if (show) {
        codeLoading.classList.remove('hidden');
        document.querySelector('#codeForm button').disabled = true;
    } else {
        codeLoading.classList.add('hidden');
        document.querySelector('#codeForm button').disabled = false;
    }
}

function getErrorMessage(errorCode) {
    const errorMessages = {
        'Invalid code': 'Invalid code. Please check and try again.',
        'Code already used': 'This code has already been used.',
        'Code expired': 'This code has expired.',
        'Account not available': 'Account is not currently available.'
    };
    
    return errorMessages[errorCode] || 'An error occurred. Please try again.';
}

// Auto-format code as user types
function formatCodeInput() {
    const input = document.getElementById('uniqueCode');
    input.addEventListener('input', function(e) {
        // Remove any non-alphanumeric characters and convert to uppercase
        let value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
        
        // Limit to 12 characters
        if (value.length > 12) {
            value = value.substring(0, 12);
        }
        
        e.target.value = value;
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape key to reset form when viewing account info
    if (e.key === 'Escape' && !accountInfoSection.classList.contains('hidden')) {
        resetForm();
    }
    
    // Ctrl+A to copy all info when viewing account
    if (e.ctrlKey && e.key === 'a' && !accountInfoSection.classList.contains('hidden')) {
        e.preventDefault();
        copyAllInfo();
    }
});

// Add some visual feedback for better UX
function addVisualFeedback() {
    // Add focus effect to code input
    const codeInput = document.getElementById('uniqueCode');
    
    codeInput.addEventListener('focus', function() {
        this.parentElement.style.transform = 'scale(1.02)';
        this.parentElement.style.transition = 'transform 0.2s ease';
    });
    
    codeInput.addEventListener('blur', function() {
        this.parentElement.style.transform = 'scale(1)';
    });
}

// 2FA Code Generation Functions
function start2FACodeGeneration() {
    // Clear any existing interval
    if (twoFAInterval) {
        clearInterval(twoFAInterval);
    }
    
    // Generate and display the first code immediately
    update2FACode();
    
    // Update every 30 seconds
    twoFAInterval = setInterval(update2FACode, 30000);
}

async function update2FACode() {
    if (!accountData || !accountData.twoFASecret) return;
    
    try {
        // Generate 6-digit TOTP code using custom implementation
        const code = await generateTOTP(accountData.twoFASecret);
        
        // Display the 6-digit code
        const twoFAElement = document.getElementById('account2FA');
        if (twoFAElement) {
            // Format as XXX XXX for better readability
            const formattedCode = code.substring(0, 3) + ' ' + code.substring(3, 6);
            twoFAElement.textContent = formattedCode;
        }
        
        // Update timer display
        updateTimer();
        
    } catch (error) {
        console.error('Error generating 2FA code:', error);
        const twoFAElement = document.getElementById('account2FA');
        if (twoFAElement) {
            twoFAElement.textContent = 'Error';
        }
    }
}

function updateTimer() {
    // Calculate seconds until next 30-second interval
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = 30 - (now % 30);
    
    const timerElement = document.getElementById('twoFATimer');
    if (timerElement) {
        const timerSpan = timerElement.querySelector('span');
        if (timerSpan) {
            timerSpan.textContent = `Expires in ~${timeLeft}s`;
        }
    }
    
    // Continue updating timer every second
    setTimeout(() => {
        if (accountData && accountData.twoFASecret) {
            updateTimer();
        }
    }, 1000);
}

// TOTP Implementation
async function generateTOTP(secret) {
    try {
        // Convert base32 secret to bytes
        const secretBytes = base32ToBytes(secret);
        
        // Get current time step (30-second intervals)
        const timeStep = Math.floor(Date.now() / 1000 / 30);
        
        // Convert time step to bytes
        const timeBytes = new ArrayBuffer(8);
        const timeView = new DataView(timeBytes);
        timeView.setUint32(4, timeStep, false); // Big endian
        
        // Import secret as crypto key
        const key = await crypto.subtle.importKey(
            'raw',
            secretBytes,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        
        // Generate HMAC
        const signature = await crypto.subtle.sign('HMAC', key, timeBytes);
        const hmac = new Uint8Array(signature);
        
        // Dynamic truncation
        const offset = hmac[hmac.length - 1] & 0x0f;
        const truncated = (
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff)
        );
        
        // Generate 6-digit code
        const code = (truncated % 1000000).toString().padStart(6, '0');
        return code;
        
    } catch (error) {
        console.error('Error generating TOTP:', error);
        return '000000';
    }
}

// Base32 to bytes converter
function base32ToBytes(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    
    // Remove padding and convert to uppercase
    base32 = base32.replace(/=/g, '').toUpperCase();
    
    // Convert each character to 5-bit binary
    for (let i = 0; i < base32.length; i++) {
        const val = alphabet.indexOf(base32[i]);
        if (val === -1) throw new Error('Invalid base32 character');
        bits += val.toString(2).padStart(5, '0');
    }
    
    // Convert bits to bytes
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
    }
    
    return bytes;
}

// Initialize additional features
document.addEventListener('DOMContentLoaded', function() {
    formatCodeInput();
    addVisualFeedback();
}); 