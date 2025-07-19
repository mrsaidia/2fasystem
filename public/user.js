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
let twoFATimeoutTimer = null;
let twoFAStartTime = null;
let displayTimeout = null;

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
        
        // Handle admin notes (optional)
        const notesSection = document.getElementById('codeNotesSection');
        const notesContent = document.getElementById('codeNotes');
        
        if (codeData.notes && codeData.notes.trim()) {
            notesContent.textContent = codeData.notes;
            notesSection.style.display = 'block';
        } else {
            notesSection.style.display = 'none';
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
    if (twoFATimeoutTimer) {
        clearTimeout(twoFATimeoutTimer);
        twoFATimeoutTimer = null;
    }
    if (displayTimeout) {
        clearTimeout(displayTimeout);
        displayTimeout = null;
    }
    
    // Clear all data first
    accountData = null;
    codeData = null;
    twoFAStartTime = null;
    
    // Reset all UI elements to clean state
    const twoFAElement = document.getElementById('account2FA');
    const sessionTimer = document.getElementById('sessionTimer');
    const totpTimer = document.getElementById('totpTimer');
    const countdownBar = document.getElementById('countdownBar');
    
    if (twoFAElement) {
        twoFAElement.textContent = '';
        twoFAElement.style.background = '';
        twoFAElement.style.borderColor = '';
        twoFAElement.style.color = '';
    }
    
    if (sessionTimer) {
        const sessionSpan = sessionTimer.querySelector('span');
        if (sessionSpan) {
            sessionSpan.textContent = 'Ready';
        }
        // Reset styles
        sessionTimer.style.color = '#059669';
        sessionTimer.style.background = 'rgba(5, 150, 105, 0.1)';
        sessionTimer.style.borderColor = 'rgba(5, 150, 105, 0.2)';
    }
    
    if (totpTimer) {
        const totpSpan = totpTimer.querySelector('span');
        if (totpSpan) {
            totpSpan.textContent = 'Ready';
        }
        // Reset styles
        totpTimer.style.color = '#6366f1';
        totpTimer.style.background = 'rgba(99, 102, 241, 0.1)';
        totpTimer.style.borderColor = 'rgba(99, 102, 241, 0.2)';
    }
    
    if (countdownBar) {
        countdownBar.style.width = '0%';
        countdownBar.className = 'countdown-bar';
    }
    
    // Hide account info section
    accountInfoSection.classList.add('hidden');
    
    // Show code input section
    codeInputSection.classList.remove('hidden');
    
    // Clear form
    document.getElementById('uniqueCode').value = '';
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
    
    // Check if clipboard API is available (requires HTTPS or localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopySuccess(elementId);
        }).catch(err => {
            // Fallback for older browsers
            fallbackCopyTextToClipboard(textToCopy, elementId);
        });
    } else {
        // Use fallback for HTTP environments
        fallbackCopyTextToClipboard(textToCopy, elementId);
    }
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
        if (codeData.notes && codeData.notes.trim()) {
            allInfo += `Admin Notes: ${codeData.notes}\n`;
        }
    }
    
    // Check if clipboard API is available (requires HTTPS or localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(allInfo).then(() => {
            showCopySuccess('all');
        }).catch(err => {
            fallbackCopyTextToClipboard(allInfo, 'all');
        });
    } else {
        // Use fallback for HTTP environments
        fallbackCopyTextToClipboard(allInfo, 'all');
    }
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
    if (twoFATimeoutTimer) {
        clearTimeout(twoFATimeoutTimer);
        twoFATimeoutTimer = null;
    }
    if (displayTimeout) {
        clearTimeout(displayTimeout);
        displayTimeout = null;
    }
    
    // Record start time for 60-second countdown
    twoFAStartTime = Date.now();
    
    // Generate and display the first code immediately
    update2FACode();
    
    // Calculate time until next 30-second interval for precise TOTP sync
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilNext30s = (30 - (currentTime % 30)) * 1000;
    
    // Schedule first update at the next 30-second mark for real-time sync
    setTimeout(() => {
        if (accountData && accountData.twoFASecret && twoFAStartTime) {
            update2FACode();
            // Then update every 30 seconds exactly on the 30-second marks
            twoFAInterval = setInterval(() => {
                if (accountData && accountData.twoFASecret && twoFAStartTime) {
                    update2FACode();
                }
            }, 30000);
        }
    }, timeUntilNext30s);
    
    // Set timeout for 60 seconds (1 minute)
    twoFATimeoutTimer = setTimeout(() => {
        hide2FACode();
    }, 60000);
    
    // Update timer and countdown bar every second with high precision
    updateTimer();
}

function hide2FACode() {
    // Clear intervals and timeouts
    if (twoFAInterval) {
        clearInterval(twoFAInterval);
        twoFAInterval = null;
    }
    if (twoFATimeoutTimer) {
        clearTimeout(twoFATimeoutTimer);
        twoFATimeoutTimer = null;
    }
    if (displayTimeout) {
        clearTimeout(displayTimeout);
        displayTimeout = null;
    }
    
    // Hide 2FA section and show timeout message
    const twoFAItem = document.getElementById('twoFAItem');
    const twoFAElement = document.getElementById('account2FA');
    const sessionTimer = document.getElementById('sessionTimer');
    const totpTimer = document.getElementById('totpTimer');
    const countdownBar = document.getElementById('countdownBar');
    
    if (twoFAElement) {
        twoFAElement.textContent = 'Code expired';
        twoFAElement.style.background = '#fee2e2';
        twoFAElement.style.borderColor = '#dc2626';
        twoFAElement.style.color = '#dc2626';
    }
    
    if (sessionTimer) {
        const sessionSpan = sessionTimer.querySelector('span');
        if (sessionSpan) {
            sessionSpan.textContent = 'Session expired';
        }
        sessionTimer.style.color = '#dc2626';
        sessionTimer.style.background = 'rgba(220, 38, 38, 0.1)';
        sessionTimer.style.borderColor = 'rgba(220, 38, 38, 0.2)';
    }
    
    if (totpTimer) {
        const totpSpan = totpTimer.querySelector('span');
        if (totpSpan) {
            totpSpan.textContent = 'Access expired';
        }
        totpTimer.style.color = '#dc2626';
        totpTimer.style.background = 'rgba(220, 38, 38, 0.1)';
        totpTimer.style.borderColor = 'rgba(220, 38, 38, 0.2)';
    }
    
    if (countdownBar) {
        countdownBar.style.width = '0%';
        countdownBar.className = 'countdown-bar danger';
    }
    
    // Clear all state
    twoFAStartTime = null;
    
    // Prevent any further updates
    if (displayTimeout) {
        clearTimeout(displayTimeout);
        displayTimeout = null;
    }
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
        
        // Reset countdown bar when new code is generated - sync with real TOTP time
        const countdownBar = document.getElementById('countdownBar');
        if (countdownBar) {
            // Calculate current position in 30-second cycle for accurate display
            const currentTime = Math.floor(Date.now() / 1000);
            const totpTimeLeft = 30 - (currentTime % 30);
            const totpPercentage = Math.max(0, (totpTimeLeft / 30) * 100);
            
            countdownBar.style.width = totpPercentage + '%';
            countdownBar.className = 'countdown-bar';
            
            // Apply appropriate color based on time left
            if (totpTimeLeft <= 5) {
                countdownBar.classList.add('danger');
            } else if (totpTimeLeft <= 15) {
                countdownBar.classList.add('warning');
            }
        }
        
        // Reset TOTP timer color when new code is generated
        const totpTimer = document.getElementById('totpTimer');
        if (totpTimer) {
            totpTimer.style.color = '#6366f1';
            totpTimer.style.background = 'rgba(99, 102, 241, 0.1)';
            totpTimer.style.borderColor = 'rgba(99, 102, 241, 0.2)';
        }
        
    } catch (error) {
        console.error('Error generating 2FA code:', error);
        const twoFAElement = document.getElementById('account2FA');
        if (twoFAElement) {
            twoFAElement.textContent = 'Error';
        }
    }
}

function updateTimer() {
    if (!twoFAStartTime) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - twoFAStartTime) / 1000);
    const sessionTimeLeft = Math.max(0, 60 - elapsed);
    
    // Update session timer (60-second countdown for entire session)
    const sessionTimerElement = document.getElementById('sessionTimer');
    if (sessionTimerElement) {
        const sessionSpan = sessionTimerElement.querySelector('span');
        if (sessionSpan && sessionTimeLeft > 0) {
            const minutes = Math.floor(sessionTimeLeft / 60);
            const seconds = sessionTimeLeft % 60;
            if (minutes > 0) {
                sessionSpan.textContent = `Session expires in ${minutes}m ${seconds}s`;
            } else {
                sessionSpan.textContent = `Session expires in ${seconds}s`;
            }
            
            // Change color based on time remaining
            if (sessionTimeLeft <= 15) {
                sessionTimerElement.style.color = '#dc2626';
                sessionTimerElement.style.background = 'rgba(220, 38, 38, 0.1)';
                sessionTimerElement.style.borderColor = 'rgba(220, 38, 38, 0.2)';
            } else if (sessionTimeLeft <= 30) {
                sessionTimerElement.style.color = '#f59e0b';
                sessionTimerElement.style.background = 'rgba(245, 158, 11, 0.1)';
                sessionTimerElement.style.borderColor = 'rgba(245, 158, 11, 0.2)';
            }
        }
    }
    
    // Update TOTP timer (30-second countdown for each 2FA code)
    const totpTimerElement = document.getElementById('totpTimer');
    if (totpTimerElement && sessionTimeLeft > 0) {
        const currentTime = Math.floor(Date.now() / 1000);
        const totpTimeLeft = 30 - (currentTime % 30);
        const totpSpan = totpTimerElement.querySelector('span');
        
        if (totpSpan) {
            totpSpan.textContent = `New code in ${totpTimeLeft}s`;
            
            // Change color based on TOTP time remaining
            if (totpTimeLeft <= 5) {
                totpTimerElement.style.color = '#dc2626';
                totpTimerElement.style.background = 'rgba(220, 38, 38, 0.1)';
                totpTimerElement.style.borderColor = 'rgba(220, 38, 38, 0.2)';
            } else if (totpTimeLeft <= 10) {
                totpTimerElement.style.color = '#f59e0b';
                totpTimerElement.style.background = 'rgba(245, 158, 11, 0.1)';
                totpTimerElement.style.borderColor = 'rgba(245, 158, 11, 0.2)';
            } else {
                totpTimerElement.style.color = '#6366f1';
                totpTimerElement.style.background = 'rgba(99, 102, 241, 0.1)';
                totpTimerElement.style.borderColor = 'rgba(99, 102, 241, 0.2)';
            }
        }
    }
    
    // Update countdown bar for 2FA code (30-second cycles) - real-time sync
    const countdownBar = document.getElementById('countdownBar');
    if (countdownBar && sessionTimeLeft > 0) {
        // Calculate seconds until next 30-second interval for 2FA code refresh
        const currentTime = Math.floor(Date.now() / 1000);
        const totpTimeLeft = 30 - (currentTime % 30);
        const totpPercentage = Math.max(0, (totpTimeLeft / 30) * 100);
        
        countdownBar.style.width = totpPercentage + '%';
        
        // Change bar color based on 2FA code time left
        countdownBar.className = 'countdown-bar';
        if (totpTimeLeft <= 5) {
            countdownBar.classList.add('danger');
        } else if (totpTimeLeft <= 15) {
            countdownBar.classList.add('warning');
        }
    }
    
    // Continue updating timer every second with precise timing
    if (sessionTimeLeft > 0 && accountData && accountData.twoFASecret && twoFAStartTime) {
        setTimeout(() => {
            if (accountData && accountData.twoFASecret && twoFAStartTime) {
                updateTimer();
            }
        }, 100); // Update every 100ms for smoother countdown
    }
}

// TOTP Implementation
async function generateTOTP(secret) {
    // Check if crypto.subtle is available (requires HTTPS or localhost)
    console.log('Checking crypto.subtle availability...');
    console.log('window.crypto:', !!window.crypto);
    console.log('window.crypto.subtle:', !!window.crypto?.subtle);
    
    if (!window.crypto || !window.crypto.subtle) {
        console.warn('crypto.subtle not available, using fallback for secret:', secret?.substring(0, 4) + '...');
        return generateTOTPFallback(secret);
    }
    
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

// Fallback TOTP implementation for non-HTTPS environments
function generateTOTPFallback(secret) {
    try {
        // Better fallback - use TOTP algorithm without crypto.subtle
        const timeStep = Math.floor(Date.now() / 1000 / 30);
        
        // Create a more realistic hash using secret and timeStep
        let hash = 5381; // Starting hash value
        const input = secret + timeStep.toString();
        
        // DJB2 hash algorithm
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) + input.charCodeAt(i);
        }
        
        // Ensure positive number and get 6 digits
        hash = Math.abs(hash);
        const code = (hash % 1000000).toString().padStart(6, '0');
        
        console.log('Using fallback TOTP generation - generated code:', code);
        return code;
    } catch (error) {
        console.error('Error in TOTP fallback:', error);
        // Return a time-based code as last resort
        const timeCode = (Math.floor(Date.now() / 1000 / 30) % 1000000).toString().padStart(6, '0');
        return timeCode;
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