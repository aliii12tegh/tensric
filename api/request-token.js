/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Request Token Endpoint
   POST /api/request-token
   Issues short-lived anti-replay tokens for AI endpoints
   ═══════════════════════════════════════════════════════════════ */

const { authMiddleware } = require('./_utils/auth');
const { createRequestToken } = require('./_utils/token');
const { createRateLimiter } = require('./_utils/rateLimiter');

// Rate limiter: 30 tokens per minute (generous — client needs one per AI request)
const limiter = createRateLimiter({
    maxRequests: 30,
    windowMs: 60000,
    keyPrefix: 'tok'
});

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const blocked = limiter(req, res);
    if (blocked) return;

    try {
        const { token, expiresAt } = createRequestToken(req.user.id);

        return res.status(200).json({
            success: true,
            token,
            expiresAt
        });

    } catch (error) {
        console.error('Request token error:', error.message);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
}

module.exports = authMiddleware(handler);
