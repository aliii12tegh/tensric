/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Login Endpoint
   ═══════════════════════════════════════════════════════════════ */

const {
    generateToken,
    comparePassword,
    validateEmail,
    sanitizeInput,
    rateLimit
} = require('./_utils/auth');
const { getUserByEmail } = require('./_utils/db');

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const rateLimitCheck = rateLimit(10, 60000);
    const limited = rateLimitCheck(req, res);
    if (limited === false) return;

    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const cleanEmail = sanitizeInput(email.toLowerCase());

        if (!validateEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Find user
        const user = getUserByEmail(cleanEmail);

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await comparePassword(password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user.id, user.email);

        // Return user data (without sensitive info)
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            credits: user.credits,
            plan: user.plan,
            createdAt: user.createdAt
        };

        res.status(200).json({
            success: true,
            token,
            user: userData
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
