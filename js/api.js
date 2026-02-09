/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - API Client
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = '/api';

class NexusAPI {
    constructor() {
        this.token = localStorage.getItem('nexus_token');
    }

    // Set auth token
    setToken(token) {
        this.token = token;
        localStorage.setItem('nexus_token', token);
    }

    // Clear auth
    clearAuth() {
        this.token = null;
        localStorage.removeItem('nexus_token');
        localStorage.removeItem('nexus_user');
    }

    // Make authenticated request
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                this.clearAuth();
                window.location.href = 'login.html';
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;

        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async signup(name, email, password) {
        return this.request('/signup', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
    }

    async getMe() {
        return this.request('/me');
    }

    // Image endpoints
    async generateImage(prompt, options = {}) {
        return this.request('/generate', {
            method: 'POST',
            body: JSON.stringify({ prompt, ...options })
        });
    }

    async enhanceImage(imageData, options = {}) {
        return this.request('/enhance', {
            method: 'POST',
            body: JSON.stringify({ image: imageData, ...options })
        });
    }

    // User endpoints
    async updateProfile(data) {
        return this.request('/user/update', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/user/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }
}

// Create global instance
window.NexusAPI = new NexusAPI();
