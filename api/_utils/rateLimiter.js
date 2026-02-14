/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Enhanced Rate Limiter
   Per-IP + per-fingerprint sliding window rate limiting
   ═══════════════════════════════════════════════════════════════ */

// In-memory store (reset on cold start — acceptable for Vercel serverless)
const store = new Map();

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now - entry.windowStart > entry.windowMs * 2) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Extract client IP from request
 */
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.connection?.remoteAddress || 'unknown';
}

/**
 * Create a rate limiter middleware
 * @param {object} options
 * @param {number} options.maxRequests - max requests per window (default: 10)
 * @param {number} options.windowMs - window time in ms (default: 60000)
 * @param {string} options.keyPrefix - prefix for the rate limit key (default: 'rl')
 * @param {boolean} options.useFingerprint - also rate limit by x-fingerprint header (default: false)
 * @returns {function} middleware (req, res) => boolean — returns true if rate limited (blocked)
 */
function createRateLimiter({ maxRequests = 10, windowMs = 60000, keyPrefix = 'rl', useFingerprint = false } = {}) {
    return function rateLimitCheck(req, res) {
        const ip = getClientIP(req);
        const fingerprint = useFingerprint ? (req.headers['x-fingerprint'] || '') : '';
        const key = `${keyPrefix}:${ip}:${fingerprint}`;
        const now = Date.now();

        let entry = store.get(key);

        if (!entry || now - entry.windowStart > windowMs) {
            // New window
            entry = { count: 1, windowStart: now, windowMs };
            store.set(key, entry);
            return false; // Not limited
        }

        entry.count++;

        if (entry.count > maxRequests) {
            const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfter
            });
            return true; // Blocked
        }

        return false; // Not limited
    };
}

module.exports = {
    createRateLimiter,
    getClientIP
};
