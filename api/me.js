/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Get Current User Endpoint
   ═══════════════════════════════════════════════════════════════ */

const { verifyToken, extractToken } = require('./_utils/auth');
const { getUserById } = require('./_utils/db');

module.exports = async (req, res) => {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Extract and verify token
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user from database
        const user = getUserById(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user data (without sensitive info)
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            credits: user.credits,
            plan: user.plan,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        res.status(200).json({
            success: true,
            user: userData
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
