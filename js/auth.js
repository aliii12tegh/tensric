/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Authentication JavaScript
   Local Storage Based Auth (for demo/development)
   ═══════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────
// PASSWORD STRENGTH CHECKER
// ─────────────────────────────────────────────────────────────────
function checkPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 1) return { level: 'weak', text: 'Weak' };
    if (strength === 2) return { level: 'fair', text: 'Fair' };
    if (strength === 3) return { level: 'good', text: 'Good' };
    return { level: 'strong', text: 'Strong' };
}

// Password strength indicator
const passwordInput = document.getElementById('password');
const strengthContainer = document.getElementById('passwordStrength');
const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');

if (passwordInput && strengthContainer) {
    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value;

        if (password.length > 0) {
            strengthContainer.style.display = 'flex';
            const strength = checkPasswordStrength(password);

            strengthFill.className = 'strength-fill ' + strength.level;
            strengthText.textContent = strength.text;
        } else {
            strengthContainer.style.display = 'none';
        }
    });
}

// ─────────────────────────────────────────────────────────────────
// LOCAL STORAGE DATABASE (Demo Mode)
// ─────────────────────────────────────────────────────────────────
const DB_KEY = 'nexus_users_db';

function getUsers() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
}

function findUserByEmail(email) {
    const users = getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function createUser(name, email, password) {
    const users = getUsers();

    // Check if user exists
    if (findUserByEmail(email)) {
        throw new Error('Email already registered');
    }

    const newUser = {
        id: Date.now().toString(),
        name: name,
        email: email.toLowerCase(),
        password: password, // In real app, this would be hashed
        credits: 50,
        plan: 'free',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    return newUser;
}

function generateToken(userId) {
    // Simple token for demo (in production, use JWT)
    return btoa(JSON.stringify({ id: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
}

// ─────────────────────────────────────────────────────────────────
// LOGIN FORM HANDLER
// ─────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        // Clear previous errors
        if (typeof NexusUI !== 'undefined') {
            NexusUI.clearFieldError(document.getElementById('email'));
            NexusUI.clearFieldError(document.getElementById('password'));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showFieldError(document.getElementById('email'), 'Please enter a valid email');
            }
            return;
        }

        if (!password) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showFieldError(document.getElementById('password'), 'Password is required');
            }
            return;
        }

        // Show loading
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;"></span> Signing in...';
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            // Find user
            const user = findUserByEmail(email);

            if (!user) {
                throw new Error('Invalid email or password');
            }

            // Check password (simple comparison for demo)
            if (user.password !== password) {
                throw new Error('Invalid email or password');
            }

            // Generate token
            const token = generateToken(user.id);

            // Store auth data
            localStorage.setItem('nexus_token', token);
            localStorage.setItem('nexus_user', JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email,
                credits: user.credits,
                plan: user.plan
            }));

            // Initialize stats if not exists
            if (!localStorage.getItem('nexus_stats')) {
                localStorage.setItem('nexus_stats', JSON.stringify({
                    totalImages: 0,
                    enhanced: 0,
                    credits: user.credits
                }));
            }

            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast('Welcome back, ' + user.name + '!', 'success');
            }

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);

        } catch (error) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast(error.message, 'error');
            } else {
                alert(error.message);
            }

            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Sign In';
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────
// SIGNUP FORM HANDLER
// ─────────────────────────────────────────────────────────────────
const signupForm = document.getElementById('signupForm');

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const terms = document.getElementById('terms')?.checked;
        const signupBtn = document.getElementById('signupBtn');

        // Validate
        if (!name || name.length < 2) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast('Please enter your name', 'warning');
            }
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast('Please enter a valid email', 'warning');
            }
            return;
        }

        if (!password || password.length < 8) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast('Password must be at least 8 characters', 'warning');
            }
            return;
        }

        if (!terms) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast('Please accept the terms and conditions', 'warning');
            }
            return;
        }

        // Show loading
        if (signupBtn) {
            signupBtn.disabled = true;
            signupBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;"></span> Creating account...';
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            // Create user
            const user = createUser(name, email, password);

            // Generate token
            const token = generateToken(user.id);

            // Store auth data
            localStorage.setItem('nexus_token', token);
            localStorage.setItem('nexus_user', JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email,
                credits: user.credits,
                plan: user.plan
            }));

            // Initialize stats
            localStorage.setItem('nexus_stats', JSON.stringify({
                totalImages: 0,
                enhanced: 0,
                credits: user.credits
            }));

            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast('Account created successfully!', 'success');
            }

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);

        } catch (error) {
            if (typeof NexusUI !== 'undefined') {
                NexusUI.showToast(error.message, 'error');
            } else {
                alert(error.message);
            }

            if (signupBtn) {
                signupBtn.disabled = false;
                signupBtn.innerHTML = 'Create Account';
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────
// CHECK AUTH STATUS
// ─────────────────────────────────────────────────────────────────
function isAuthenticated() {
    const token = localStorage.getItem('nexus_token');
    if (!token) return false;

    try {
        const decoded = JSON.parse(atob(token));
        return decoded.exp > Date.now();
    } catch {
        return false;
    }
}

function getCurrentUser() {
    const userStr = localStorage.getItem('nexus_user');
    return userStr ? JSON.parse(userStr) : null;
}

function logout() {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    window.location.href = 'login.html';
}

// ─────────────────────────────────────────────────────────────────
// PROTECTED PAGE CHECK
// ─────────────────────────────────────────────────────────────────
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Export auth functions
window.NexusAuth = {
    isAuthenticated,
    getCurrentUser,
    logout,
    requireAuth,
    getUsers,
    findUserByEmail
};

// Log for debugging
console.log('🔐 Nexus Auth initialized (Local Storage Mode)');
