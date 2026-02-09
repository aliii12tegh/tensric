/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Authentication Utilities (Backend)
   ═══════════════════════════════════════════════════════════════ */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-ai-super-secret-key-2026';
const JWT_EXPIRY = '7d';
const SALT_ROUNDS = 12;

// Generate JWT token
function generateToken(userId, email) {
    return jwt.sign(
        {
            id: userId,
            email,
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Hash password
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// Compare password
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Extract token from request
function extractToken(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) return null;

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return authHeader;
}

// Auth middleware
function authMiddleware(handler) {
    return async (req, res) => {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = decoded;
        return handler(req, res);
    };
}

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 60000) {
    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
        const key = `${ip}:${req.url}`;
        const now = Date.now();

        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, { count: 1, startTime: now });
            return next ? next() : true;
        }

        const entry = rateLimitMap.get(key);

        if (now - entry.startTime > windowMs) {
            rateLimitMap.set(key, { count: 1, startTime: now });
            return next ? next() : true;
        }

        if (entry.count >= maxRequests) {
            return res.status(429).json({
                error: 'Too many requests. Please try again later.'
            });
        }

        entry.count++;
        return next ? next() : true;
    };
}

// Input validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

function sanitizeInput(str) {
    if (!str) return '';
    return str
        .replace(/[<>]/g, '')
        .trim();
}

module.exports = {
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,
    extractToken,
    authMiddleware,
    rateLimit,
    validateEmail,
    validatePassword,
    sanitizeInput,
    JWT_SECRET
};
