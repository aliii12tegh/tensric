/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Stripe Checkout Session Endpoint
   POST /api/checkout
   Creates a Stripe Checkout session server-side — no secret keys
   ever reach the client
   ═══════════════════════════════════════════════════════════════ */

const { authMiddleware } = require('./_utils/auth');
const { createRateLimiter } = require('./_utils/rateLimiter');

// Rate limiter: 5 checkout attempts per minute
const limiter = createRateLimiter({
    maxRequests: 5,
    windowMs: 60000,
    keyPrefix: 'checkout'
});

// Plan → Stripe Price ID mapping (from env vars)
const PLAN_PRICES = {
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE
};

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const blocked = limiter(req, res);
    if (blocked) return;

    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            console.error('STRIPE_SECRET_KEY not configured');
            return res.status(503).json({ error: 'Payment service unavailable' });
        }

        const { plan } = req.body;

        // Validate plan
        if (!plan || !['pro', 'enterprise'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "enterprise"' });
        }

        const priceId = PLAN_PRICES[plan];
        if (!priceId) {
            console.error(`STRIPE_PRICE_${plan.toUpperCase()} not configured`);
            return res.status(503).json({ error: 'Payment service unavailable' });
        }

        const appUrl = process.env.APP_URL || 'https://tensric.vercel.app';

        // Initialize Stripe (lazy require to avoid issues if not installed)
        const stripe = require('stripe')(stripeKey);

        // Create Checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1
                }
            ],
            success_url: `${appUrl}/billing.html?session_id={CHECKOUT_SESSION_ID}&status=success`,
            cancel_url: `${appUrl}/billing.html?status=cancelled`,
            client_reference_id: req.user.id,
            customer_email: req.user.email,
            metadata: {
                userId: req.user.id,
                plan: plan
            }
        });

        return res.status(200).json({
            success: true,
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Checkout error:', error.message);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
}

module.exports = authMiddleware(handler);
