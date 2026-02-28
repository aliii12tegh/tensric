/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - API Client (Secured)
   Handles anti-replay tokens, job polling, and authenticated requests
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

    // ── Core request method ─────────────────────────────────────
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

    // ── Anti-replay token ───────────────────────────────────────
    async getRequestToken() {
        const data = await this.request('/request-token', {
            method: 'POST'
        });
        return data.token;
    }

    // ── Secured request (auto-fetches request token) ────────────
    async securedRequest(endpoint, body) {
        const requestToken = await this.getRequestToken();

        return this.request(endpoint, {
            method: 'POST',
            headers: {
                'x-request-token': requestToken
            },
            body: JSON.stringify(body)
        });
    }

    // ── Job polling ─────────────────────────────────────────────
    // Polls /api/job-status until completed or failed
    // onProgress(status) is called on each poll
    // Returns the final job data with signedUrl on success
    async pollJobStatus(jobId, onProgress, maxWaitMs = 120000) {
        const startTime = Date.now();
        let pollInterval = 2000; // start at 2s
        const MAX_INTERVAL = 8000;

        while (Date.now() - startTime < maxWaitMs) {
            const data = await this.request(`/job-status?jobId=${encodeURIComponent(jobId)}`);

            if (onProgress) {
                onProgress(data.status, data);
            }

            if (data.status === 'completed') {
                return data;
            }

            if (data.status === 'failed') {
                throw new Error(data.error || 'Job failed');
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            // Increase interval gradually (exponential backoff capped at MAX_INTERVAL)
            pollInterval = Math.min(pollInterval * 1.3, MAX_INTERVAL);
        }

        throw new Error('Generation timed out. Please try again.');
    }

    // ── Auth endpoints ──────────────────────────────────────────
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

    // ── Image generation (secured) ──────────────────────────────
    // Returns { jobId } — caller should use pollJobStatus() to get result
    async generateImage(prompt, options = {}) {
        return this.securedRequest('/generate', { prompt, ...options });
    }

    // ── Image enhancement (secured) ─────────────────────────────
    async enhanceImage(imageData, options = {}) {
        return this.securedRequest('/enhance', { image: imageData, ...options });
    }

    // ── Video generation (secured) ──────────────────────────────
    async generateVideo(prompt, options = {}) {
        return this.securedRequest('/generate', {
            prompt,
            type: 'video',
            ...options
        });
    }

    // ── User endpoints ──────────────────────────────────────────
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
