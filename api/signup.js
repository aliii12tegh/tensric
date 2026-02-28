/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Signup Endpoint
   ═══════════════════════════════════════════════════════════════ */

const {
    generateToken,
    hashPassword,
    validateEmail,
    validatePassword,
    sanitizeInput,
    rateLimit
} = require('./_utils/auth');
const { getUserByEmail, createUser } = require('./_utils/db');

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const rateLimitCheck = rateLimit(5, 60000);
    const limited = rateLimitCheck(req, res);
    if (limited === false) return;

    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const cleanName = sanitizeInput(name);
        const cleanEmail = sanitizeInput(email.toLowerCase());

        if (cleanName.length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters' });
        }

        if (!validateEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user exists
        const existingUser = getUserByEmail(cleanEmail);

        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const user = createUser({
            name: cleanName,
            email: cleanEmail,
            passwordHash
        });

        // Generate token
        const token = generateToken(user.id, user.email);

        // Return user data (without sensitive info)
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            credits: user.credits,
            plan: user.plan,
            isAdmin: user.isAdmin || false,
            createdAt: user.createdAt
        };

        res.status(201).json({
            success: true,
            token,
            user: userData
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
