// Global variables
let authToken = localStorage.getItem('adminToken');
let currentEditingAccount = null;
let currentEditingCode = null;
let accounts = [];
let uniqueCodes = [];

// DOM elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

const logoutBtn = document.getElementById('logoutBtn');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    if (authToken) {
        // Try to validate token by loading data
        loadDashboard();
    } else {
        showLogin();
    }
    
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    

    
    // Change code functionality
    document.getElementById('changeCodeBtn').addEventListener('click', showChangeCodeForm);
    document.getElementById('submitChangeCode').addEventListener('click', handleChangeCode);
    document.getElementById('cancelChangeCode').addEventListener('click', hideChangeCodeForm);
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // Account management
    document.getElementById('addAccountBtn').addEventListener('click', showAddAccountModal);
    document.getElementById('accountForm').addEventListener('submit', handleAccountSubmit);
    
    // Code management
    document.getElementById('generateCodeBtn').addEventListener('click', showGenerateCodeModal);
    document.getElementById('codeForm').addEventListener('submit', handleCodeSubmit);
    
    // Modal close buttons (X button and Cancel buttons)
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-modal]')) {
            const button = e.target.closest('[data-close-modal]');
            const modalId = button.getAttribute('data-close-modal');
            closeModal(modalId);
        }
    });
    
    // 2FA verification
    document.getElementById('verify2FABtn').addEventListener('click', verify2FA);
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const loginCode = document.getElementById('loginCode').value;
    const twoFACode = document.getElementById('twoFACode').value;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ loginCode, twoFACode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            loadDashboard();
        } else {
            showError(data.error);
            
            // Show 2FA input if required
            if (data.error === '2FA code required') {
                document.getElementById('twoFAGroup').style.display = 'block';
            }
        }
    } catch (error) {
        showError('Server connection error');
    }
}

// Change code functions
function showChangeCodeForm() {
    document.getElementById('changeCodeForm').classList.remove('hidden');
    document.getElementById('changeCodeBtn').classList.add('hidden');
}

function hideChangeCodeForm() {
    document.getElementById('changeCodeForm').classList.add('hidden');
    document.getElementById('changeCodeBtn').classList.remove('hidden');
    document.getElementById('hiddenCode').value = '';
    document.getElementById('newLoginCode').value = '';
}

async function handleChangeCode() {
    const hiddenCode = document.getElementById('hiddenCode').value;
    const newLoginCode = document.getElementById('newLoginCode').value;
    
    if (!hiddenCode || !newLoginCode) {
        showError('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/change-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hiddenCode, newLoginCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Login code changed successfully');
            hideChangeCodeForm();
            // Clear the login code field for security
            document.getElementById('loginCode').value = '';
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Error changing login code');
    }
}

function handleLogout() {
    authToken = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('activeTab'); // Clear saved tab
    showLogin();
}

function showLogin() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    clearForms();
}

function loadDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    
    // Restore active tab from localStorage
    restoreActiveTab();
    
    loadAccounts();
    loadUniqueCodes();
}

function restoreActiveTab() {
    const savedTab = localStorage.getItem('activeTab');
    
    if (savedTab) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Set active tab based on saved preference
        const tabButton = document.querySelector(`[data-tab="${savedTab}"]`);
        const tabContent = document.getElementById(savedTab + 'Tab');
        
        if (tabButton && tabContent) {
            tabButton.classList.add('active');
            tabContent.classList.add('active');
        } else {
            // Fallback to accounts tab if saved tab doesn't exist
            setDefaultTab();
        }
    } else {
        // No saved tab, use default (accounts)
        setDefaultTab();
    }
}

function setDefaultTab() {
    document.querySelector('[data-tab="accounts"]').classList.add('active');
    document.getElementById('accountsTab').classList.add('active');
}

// Dashboard functions
async function loadAccounts() {
    try {
        const response = await fetch('/api/admin/accounts', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            accounts = await response.json();
            renderAccountsTable();
            updateAccountSelect();
        } else {
            handleApiError(response);
        }
    } catch (error) {
        showError('Error loading accounts list');
    }
}

async function loadUniqueCodes() {
    try {
        const response = await fetch('/api/admin/codes', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            uniqueCodes = await response.json();
            renderCodesTable();
        } else {
            handleApiError(response);
        }
    } catch (error) {
        showError('Error loading unique codes list');
    }
}

function renderAccountsTable() {
    const tbody = document.querySelector('#accountsTable tbody');
    tbody.innerHTML = '';
    
    accounts.forEach(account => {
        const row = document.createElement('tr');
        const has2FA = account.twoFASecret ? 'Yes' : 'No';
        
        row.innerHTML = `
            <td>${account.platform}</td>
            <td>${account.username}</td>
            <td>${account.email || '-'}</td>
            <td>
                <span class="status-badge ${account.twoFASecret ? 'status-active' : 'status-inactive'}">
                    ${has2FA}
                </span>
            </td>
            <td>${formatDate(account.createdAt)}</td>
            <td>
                <span class="status-badge ${account.isActive ? 'status-active' : 'status-inactive'}">
                    ${account.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-secondary edit-account-btn" data-account-id="${account.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger delete-account-btn" data-account-id="${account.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Add event listeners for action buttons
    document.querySelectorAll('.edit-account-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const accountId = this.getAttribute('data-account-id');
            editAccount(accountId);
        });
    });
    
    document.querySelectorAll('.delete-account-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const accountId = this.getAttribute('data-account-id');
            deleteAccount(accountId);
        });
    });
}

function renderCodesTable() {
    const tbody = document.querySelector('#codesTable tbody');
    tbody.innerHTML = '';
    
    uniqueCodes.forEach(code => {
        const row = document.createElement('tr');
        const status = getCodeStatus(code);
        
        row.innerHTML = `
            <td><code>${code.code}</code></td>
            <td>${code.accountInfo.platform} - ${code.accountInfo.username}</td>
            <td>${formatDate(code.createdAt)}</td>
            <td>${code.expiresAt ? formatDate(code.expiresAt) : 'No expiration'}</td>
            <td>
                <span class="usage-count">${code.usageCount || 0}</span>
            </td>
            <td>
                <span class="usage-limit">${code.usageLimit || 'Unlimited'}</span>
            </td>
            <td>
                <div class="code-notes-cell" title="${code.notes || ''}">
                    ${code.notes ? (code.notes.length > 30 ? code.notes.substring(0, 30) + '...' : code.notes) : '-'}
                </div>
            </td>
            <td>
                <span class="status-badge ${status.class}">
                    ${status.text}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-secondary edit-code-btn" data-code-id="${code.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger delete-code-btn" data-code-id="${code.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Add event listeners for action buttons
    document.querySelectorAll('.edit-code-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const codeId = this.getAttribute('data-code-id');
            editCode(codeId);
        });
    });
    
    document.querySelectorAll('.delete-code-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const codeId = this.getAttribute('data-code-id');
            deleteCode(codeId);
        });
    });
}

function getCodeStatus(code) {
    if (code.expiresAt && new Date() > new Date(code.expiresAt)) {
        return { class: 'status-expired', text: 'Expired' };
    }
    
    if (code.usageLimit && code.usageCount >= code.usageLimit) {
        return { class: 'status-expired', text: 'Limit Reached' };
    }
    
    if (code.usageCount && code.usageCount > 0) {
        return { class: 'status-used', text: 'Used' };
    }
    
    return { class: 'status-active', text: 'Not Used' };
}

// Tab switching
function switchTab(e) {
    const tabName = e.target.dataset.tab;
    
    // Save active tab to localStorage
    localStorage.setItem('activeTab', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// Account management
function showAddAccountModal() {
    currentEditingAccount = null;
    document.getElementById('accountModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add Account';
    clearAccountForm();
    showModal('accountModal');
}

function editAccount(accountId) {
    currentEditingAccount = accounts.find(acc => acc.id === accountId);
    if (currentEditingAccount) {
        document.getElementById('accountModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Account';
        fillAccountForm(currentEditingAccount);
        showModal('accountModal');
    }
}

async function deleteAccount(accountId) {
    if (confirm('Are you sure you want to delete this account?')) {
        try {
            const response = await fetch(`/api/admin/accounts/${accountId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                loadAccounts();
                showSuccess('Account deleted successfully');
            } else {
                handleApiError(response);
            }
        } catch (error) {
            showError('Error deleting account');
        }
    }
}

async function handleAccountSubmit(e) {
    e.preventDefault();
    
    // Validate required fields
    const platform = document.getElementById('platform').value.trim();
    const twoFASecret = document.getElementById('twoFASecret').value.trim();
    
    if (!platform) {
        showError('Platform is required');
        return;
    }
    
    if (!twoFASecret) {
        showError('2FA Secret is required');
        return;
    }
    
    const accountData = {
        platform: platform,
        username: document.getElementById('accountUsername').value.trim() || null,
        password: document.getElementById('accountPassword').value.trim() || null,
        email: document.getElementById('email').value.trim() || null,
        twoFASecret: twoFASecret,
        notes: document.getElementById('notes').value.trim() || null,
        isActive: true
    };
    
    try {
        const url = currentEditingAccount 
            ? `/api/admin/accounts/${currentEditingAccount.id}`
            : '/api/admin/accounts';
        
        const method = currentEditingAccount ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(accountData)
        });
        
        if (response.ok) {
            closeModal('accountModal');
            loadAccounts();
            showSuccess(currentEditingAccount ? 'Account updated' : 'New account added');
        } else {
            handleApiError(response);
        }
    } catch (error) {
        showError('Error saving account');
    }
}

// Code management
function showGenerateCodeModal() {
    // Reset modal for generating new code
    document.querySelector('#codeModal .modal-header h3').innerHTML = '<i class="fas fa-key"></i> Generate Unique Code';
    currentEditingCode = null;
    
    clearCodeForm();
    updateAccountSelect();
    showModal('codeModal');
}

async function handleCodeSubmit(e) {
    e.preventDefault();
    
    const codeData = {
        accountId: document.getElementById('accountSelect').value,
        expiresIn: parseInt(document.getElementById('expiresIn').value) || null,
        usageLimit: parseInt(document.getElementById('usageLimit').value) || null,
        notes: document.getElementById('codeNotes').value
    };
    
    try {
        let response;
        let successMessage;
        
        if (currentEditingCode) {
            // Edit existing code
            response = await fetch(`/api/admin/codes/${currentEditingCode}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(codeData)
            });
            successMessage = 'Unique code updated successfully';
        } else {
            // Generate new code
            response = await fetch('/api/admin/codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(codeData)
            });
            const newCode = await response.json();
            successMessage = `Unique code generated: ${newCode.code}`;
        }
        
        if (response.ok) {
            closeModal('codeModal');
            loadUniqueCodes();
            showSuccess(successMessage);
        } else {
            handleApiError(response);
        }
    } catch (error) {
        showError(currentEditingCode ? 'Error updating unique code' : 'Error generating unique code');
    }
}

async function deleteCode(codeId) {
    console.log('Delete button clicked for code:', codeId);
    if (confirm('Are you sure you want to delete this unique code?')) {
        try {
            const response = await fetch(`/api/admin/codes/${codeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                loadUniqueCodes();
                showSuccess('Unique code deleted');
            } else {
                handleApiError(response);
            }
        } catch (error) {
            showError('Error deleting unique code');
        }
    }
}

function editCode(codeId) {
    console.log('Edit button clicked for code:', codeId);
    const code = uniqueCodes.find(c => c.id === codeId);
    console.log('Found code:', code);
    if (code) {
        // Set modal title to Edit
        document.querySelector('#codeModal .modal-header h3').innerHTML = '<i class="fas fa-edit"></i> Edit Unique Code';
        
        // Fill form with existing data
        document.getElementById('accountSelect').value = code.accountId;
        
        // Calculate remaining days for expiration
        if (code.expiresAt) {
            const now = new Date();
            const expiry = new Date(code.expiresAt);
            const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            document.getElementById('expiresIn').value = diffDays > 0 ? diffDays : '';
        } else {
            document.getElementById('expiresIn').value = '';
        }
        
        document.getElementById('usageLimit').value = code.usageLimit || '';
        document.getElementById('codeNotes').value = code.notes || '';
        
        // Store current editing code ID
        currentEditingCode = codeId;
        
        // Show modal
        showModal('codeModal');
    }
}



// Utility functions
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function clearForms() {
    document.getElementById('loginForm').reset();
    document.getElementById('twoFAGroup').style.display = 'none';
    hideChangeCodeForm();
}

function clearAccountForm() {
    document.getElementById('accountForm').reset();
}

function clearCodeForm() {
    document.getElementById('codeForm').reset();
}

function fillAccountForm(account) {
    document.getElementById('platform').value = account.platform;
    document.getElementById('accountUsername').value = account.username;
    document.getElementById('accountPassword').value = account.password;
    document.getElementById('email').value = account.email || '';
    document.getElementById('twoFASecret').value = account.twoFASecret || '';
    document.getElementById('notes').value = account.notes || '';
}

function updateAccountSelect() {
    const select = document.getElementById('accountSelect');
    select.innerHTML = '<option value="">-- Select account --</option>';
    
    accounts.forEach(account => {
        if (account.isActive) {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.platform} - ${account.username}`;
            select.appendChild(option);
        }
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('show');
    setTimeout(() => {
        loginError.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'error-message show';
    successDiv.style.color = '#059669';
    successDiv.style.backgroundColor = '#D1FAE5';
    successDiv.style.borderColor = '#A7F3D0';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

async function handleApiError(response) {
    if (response.status === 401 || response.status === 403) {
        handleLogout();
        showError('Session expired');
    } else {
        const data = await response.json();
        showError(data.error || 'An error occurred');
    }
} 