/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Anti-Replay Request Tokens
   HMAC-SHA256 signed short-lived tokens with nonce
   ═══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const TOKEN_SECRET = process.env.REQUEST_TOKEN_SECRET || process.env.JWT_SECRET;
if (!TOKEN_SECRET) {
    throw new Error('FATAL: REQUEST_TOKEN_SECRET or JWT_SECRET environment variable is not set');
}

const TOKEN_TTL_MS = 60 * 1000; // 60 seconds

// Track used nonces to prevent replay (auto-cleanup)
const usedNonces = new Map();

// Cleanup expired nonces every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [nonce, expiresAt] of usedNonces) {
        if (now > expiresAt) {
            usedNonces.delete(nonce);
        }
    }
}, 2 * 60 * 1000);

/**
 * Create a signed request token
 * @param {string} userId - the authenticated user's ID
 * @returns {{ token: string, expiresAt: number }}
 */
function createRequestToken(userId) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const expiresAt = timestamp + TOKEN_TTL_MS;

    const payload = `${userId}:${nonce}:${timestamp}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    const token = Buffer.from(JSON.stringify({ userId, nonce, timestamp, expiresAt, signature })).toString('base64url');

    return { token, expiresAt };
}

/**
 * Verify a request token
 * @param {string} token - the base64url-encoded token string
 * @param {string} expectedUserId - the authenticated user's ID to match against
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyRequestToken(token, expectedUserId) {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
        const { userId, nonce, timestamp, expiresAt, signature } = decoded;

        // Check all fields exist
        if (!userId || !nonce || !timestamp || !expiresAt || !signature) {
            return { valid: false, error: 'Malformed token' };
        }

        // Check user matches
        if (userId !== expectedUserId) {
            return { valid: false, error: 'Token user mismatch' };
        }

        // Check expiry
        if (Date.now() > expiresAt) {
            return { valid: false, error: 'Token expired' };
        }

        // Verify signature
        const payload = `${userId}:${nonce}:${timestamp}:${expiresAt}`;
        const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
            return { valid: false, error: 'Invalid token signature' };
        }

        // Check nonce uniqueness (prevent replay)
        if (usedNonces.has(nonce)) {
            return { valid: false, error: 'Token already used (replay detected)' };
        }

        // Mark nonce as used
        usedNonces.set(nonce, expiresAt + 60000); // Keep for 1 min past expiry

        return { valid: true };
    } catch (err) {
        return { valid: false, error: 'Invalid token format' };
    }
}

module.exports = {
    createRequestToken,
    verifyRequestToken,
    TOKEN_TTL_MS
};
