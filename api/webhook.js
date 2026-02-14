/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Stripe Webhook Endpoint
   POST /api/webhook
   Verifies Stripe webhook signatures and grants access
   ═══════════════════════════════════════════════════════════════ */

const { updateUser, getUserById } = require('./_utils/db');

// Track processed event IDs to prevent replay
const processedEvents = new Set();

// Cleanup old event IDs every 10 minutes
setInterval(() => {
    if (processedEvents.size > 10000) {
        processedEvents.clear();
    }
}, 10 * 60 * 1000);

// Plan configuration
const PLAN_CREDITS = {
    free: 10,
    pro: 500,
    enterprise: 9999
};

module.exports = async (req, res) => {
    // ── Only POST ────────────────────────────────────────────
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        return res.status(503).json({ error: 'Webhook not configured' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error('STRIPE_SECRET_KEY not configured');
        return res.status(503).json({ error: 'Payment service unavailable' });
    }

    try {
        const stripe = require('stripe')(stripeKey);

        // ── Get raw body for signature verification ──────────
        // Vercel provides the raw body in req.body when Content-Type is not JSON
        // We need to read the raw body for Stripe signature verification
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return res.status(400).json({ error: 'Missing Stripe signature' });
        }

        let event;
        try {
            // req.body should be the raw body string/buffer for webhook verification
            const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        // ── Idempotency check ────────────────────────────────
        if (processedEvents.has(event.id)) {
            // Already processed — acknowledge silently
            return res.status(200).json({ received: true, duplicate: true });
        }
        processedEvents.add(event.id);

        // ── Handle event types ───────────────────────────────
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.metadata?.userId || session.client_reference_id;
                const plan = session.metadata?.plan || 'pro';

                if (userId) {
                    const credits = PLAN_CREDITS[plan] || PLAN_CREDITS.pro;
                    updateUser(userId, {
                        plan,
                        credits,
                        stripeCustomerId: session.customer,
                        stripeSubscriptionId: session.subscription,
                        planActivatedAt: new Date().toISOString()
                    });
                    console.log(`✅ User ${userId} upgraded to ${plan} plan`);
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;
                const customerId = invoice.customer;
                // Find user by Stripe customer ID and refresh credits
                // In production, you'd have a lookup by stripeCustomerId
                console.log(`✅ Invoice paid for customer ${customerId}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                // Downgrade user to free plan
                console.log(`⚠️ Subscription cancelled for customer ${customerId}`);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                if (subscription.cancel_at_period_end) {
                    console.log(`⚠️ Subscription will cancel at period end for ${subscription.customer}`);
                }
                break;
            }

            default:
                // Unhandled event type — log but don't error
                console.log(`Unhandled webhook event: ${event.type}`);
        }

        // Always acknowledge receipt
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error.message);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
};
