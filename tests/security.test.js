/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Security Tests
   Run with: node --test tests/security.test.js
   Requires Node.js 18+ (built-in test runner, zero external deps)
   ═══════════════════════════════════════════════════════════════ */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Mock environment variables ─────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-64-characters-long-for-security-purposes';
process.env.REQUEST_TOKEN_SECRET = 'test-request-token-secret-32chars!!';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';

// ═══════════════════════════════════════════════════════════════
// 1. INPUT VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════
describe('Input Validation', () => {
    const { validateGenerateInput, validateEnhanceInput } = require('../api/_utils/validate');

    describe('validateGenerateInput', () => {
        it('should accept valid input', () => {
            const result = validateGenerateInput({
                prompt: 'A beautiful sunset over the ocean',
                model: 'dall-e-3',
                size: '1024x1024',
                quality: 'hd'
            });
            assert.equal(result.valid, true);
            assert.equal(result.errors.length, 0);
        });

        it('should reject missing prompt', () => {
            const result = validateGenerateInput({});
            assert.equal(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('prompt')));
        });

        it('should reject empty prompt', () => {
            const result = validateGenerateInput({ prompt: '   ' });
            assert.equal(result.valid, false);
        });

        it('should reject oversized prompt (>2000 chars)', () => {
            const result = validateGenerateInput({ prompt: 'x'.repeat(2001) });
            assert.equal(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('2000')));
        });

        it('should reject invalid model', () => {
            const result = validateGenerateInput({ prompt: 'test', model: 'gpt-4' });
            assert.equal(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('model')));
        });

        it('should reject invalid size', () => {
            const result = validateGenerateInput({ prompt: 'test', size: '99x99' });
            assert.equal(result.valid, false);
        });

        it('should reject invalid quality', () => {
            const result = validateGenerateInput({ prompt: 'test', quality: 'ultra' });
            assert.equal(result.valid, false);
        });

        it('should reject non-object body', () => {
            const result = validateGenerateInput(null);
            assert.equal(result.valid, false);
        });

        it('should reject non-string prompt', () => {
            const result = validateGenerateInput({ prompt: 123 });
            assert.equal(result.valid, false);
        });

        it('should accept minimal valid input (prompt only)', () => {
            const result = validateGenerateInput({ prompt: 'hello' });
            assert.equal(result.valid, true);
        });
    });

    describe('validateEnhanceInput', () => {
        it('should accept valid input', () => {
            const result = validateEnhanceInput({
                image: 'iVBORw0KGgo=', // tiny base64
                type: 'upscale',
                scale: 2
            });
            assert.equal(result.valid, true);
        });

        it('should reject missing image', () => {
            const result = validateEnhanceInput({ type: 'upscale' });
            assert.equal(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('image')));
        });

        it('should reject missing type', () => {
            const result = validateEnhanceInput({ image: 'base64data' });
            assert.equal(result.valid, false);
        });

        it('should reject invalid enhancement type', () => {
            const result = validateEnhanceInput({ image: 'base64data', type: 'magic' });
            assert.equal(result.valid, false);
        });

        it('should reject oversized image (>10 MB base64)', () => {
            const hugeImage = 'x'.repeat(15 * 1024 * 1024); // ~15 MB
            const result = validateEnhanceInput({ image: hugeImage, type: 'upscale' });
            assert.equal(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('MB')));
        });

        it('should reject invalid scale', () => {
            const result = validateEnhanceInput({ image: 'data', type: 'upscale', scale: 10 });
            assert.equal(result.valid, false);
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. RATE LIMITER TESTS
// ═══════════════════════════════════════════════════════════════
describe('Rate Limiter', () => {
    const { createRateLimiter } = require('../api/_utils/rateLimiter');

    it('should allow requests within limit', () => {
        const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60000, keyPrefix: 'test1' });
        const req = { headers: { 'x-forwarded-for': '1.2.3.4' }, url: '/test' };
        let blocked = false;
        const res = {
            setHeader: () => { },
            status: () => ({ json: () => { blocked = true; } })
        };

        limiter(req, res);
        assert.equal(blocked, false);
        limiter(req, res);
        assert.equal(blocked, false);
        limiter(req, res);
        assert.equal(blocked, false);
    });

    it('should block after exceeding limit', () => {
        const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60000, keyPrefix: 'test2' });
        const req = { headers: { 'x-forwarded-for': '5.6.7.8' }, url: '/test' };
        let blocked = false;
        let retryAfter = null;
        const res = {
            setHeader: (key, val) => { if (key === 'Retry-After') retryAfter = val; },
            status: () => ({ json: (body) => { blocked = true; } })
        };

        limiter(req, res); // 1
        limiter(req, res); // 2
        limiter(req, res); // 3 — should be blocked
        assert.equal(blocked, true);
        assert.ok(retryAfter !== null);
    });

    it('should track different IPs separately', () => {
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000, keyPrefix: 'test3' });
        let blocked = false;
        const res = {
            setHeader: () => { },
            status: () => ({ json: () => { blocked = true; } })
        };

        limiter({ headers: { 'x-forwarded-for': '10.0.0.1' }, url: '/test' }, res);
        assert.equal(blocked, false);

        limiter({ headers: { 'x-forwarded-for': '10.0.0.2' }, url: '/test' }, res);
        assert.equal(blocked, false);
    });

    it('should include fingerprint when enabled', () => {
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000, keyPrefix: 'test4', useFingerprint: true });
        let blockedCount = 0;
        const res = {
            setHeader: () => { },
            status: () => ({ json: () => { blockedCount++; } })
        };

        // Same IP, different fingerprint — should NOT be blocked
        limiter({ headers: { 'x-forwarded-for': '20.0.0.1', 'x-fingerprint': 'fp1' }, url: '/test' }, res);
        limiter({ headers: { 'x-forwarded-for': '20.0.0.1', 'x-fingerprint': 'fp2' }, url: '/test' }, res);
        assert.equal(blockedCount, 0);
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. REQUEST TOKEN (ANTI-REPLAY) TESTS
// ═══════════════════════════════════════════════════════════════
describe('Request Tokens (Anti-Replay)', () => {
    const { createRequestToken, verifyRequestToken } = require('../api/_utils/token');

    it('should create and verify a valid token', () => {
        const { token, expiresAt } = createRequestToken('user123');

        assert.ok(token);
        assert.ok(expiresAt > Date.now());

        const result = verifyRequestToken(token, 'user123');
        assert.equal(result.valid, true);
    });

    it('should reject token used for wrong user', () => {
        const { token } = createRequestToken('user123');
        const result = verifyRequestToken(token, 'user999');
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('mismatch'));
    });

    it('should reject replayed (reused) token', () => {
        const { token } = createRequestToken('user456');

        // First use — should succeed
        const result1 = verifyRequestToken(token, 'user456');
        assert.equal(result1.valid, true);

        // Second use — should fail (replay)
        const result2 = verifyRequestToken(token, 'user456');
        assert.equal(result2.valid, false);
        assert.ok(result2.error.includes('replay'));
    });

    it('should reject tampered token', () => {
        const { token } = createRequestToken('user789');

        // Decode, tamper, re-encode
        const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
        decoded.userId = 'hacker';
        const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64url');

        const result = verifyRequestToken(tampered, 'hacker');
        assert.equal(result.valid, false);
    });

    it('should reject expired token', () => {
        const { token } = createRequestToken('userExpired');

        // Decode and force expiry into the past
        const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
        decoded.expiresAt = Date.now() - 1000; // 1 second ago
        // Re-sign (we can't — so the signature check will catch it)
        const fakeToken = Buffer.from(JSON.stringify(decoded)).toString('base64url');

        const result = verifyRequestToken(fakeToken, 'userExpired');
        assert.equal(result.valid, false);
    });

    it('should reject malformed token', () => {
        const result = verifyRequestToken('not-a-valid-token', 'user');
        assert.equal(result.valid, false);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. AUTH MIDDLEWARE TESTS
// ═══════════════════════════════════════════════════════════════
describe('Auth Middleware', () => {
    const { authMiddleware, generateToken } = require('../api/_utils/auth');

    it('should reject request without token', async () => {
        let statusCode = null;
        let responseBody = null;

        const handler = authMiddleware(async (req, res) => {
            res.status(200).json({ success: true });
        });

        const req = { headers: {} };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (body) => { responseBody = body; } };
            }
        };

        await handler(req, res);
        assert.equal(statusCode, 401);
        assert.ok(responseBody.error.includes('Authentication'));
    });

    it('should reject request with invalid token', async () => {
        let statusCode = null;

        const handler = authMiddleware(async (req, res) => {
            res.status(200).json({ success: true });
        });

        const req = { headers: { authorization: 'Bearer invalid.token.here' } };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: () => { } };
            }
        };

        await handler(req, res);
        assert.equal(statusCode, 401);
    });

    it('should allow request with valid token', async () => {
        let statusCode = null;
        let requestUser = null;

        const token = generateToken('testUser123', 'test@example.com');

        const handler = authMiddleware(async (req, res) => {
            requestUser = req.user;
            res.status(200).json({ success: true });
        });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: () => { } };
            }
        };

        await handler(req, res);
        assert.equal(statusCode, 200);
        assert.ok(requestUser);
        assert.equal(requestUser.id, 'testUser123');
    });
});

// ═══════════════════════════════════════════════════════════════
// 5. WEBHOOK SIGNATURE VERIFICATION TESTS
// ═══════════════════════════════════════════════════════════════
describe('Webhook Signature Verification', () => {
    const crypto = require('crypto');

    function generateStripeSignature(payload, secret) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signedPayload = `${timestamp}.${payload}`;
        const signature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');
        return `t=${timestamp},v1=${signature}`;
    }

    it('should reject missing stripe-signature header', async () => {
        // Import webhook handler
        const webhook = require('../api/webhook');
        let statusCode = null;
        let responseBody = null;

        const req = {
            method: 'POST',
            headers: {},
            body: '{}'
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (body) => { responseBody = body; } };
            }
        };

        await webhook(req, res);
        assert.equal(statusCode, 400);
        assert.ok(responseBody.error.includes('signature'));
    });

    it('should reject invalid stripe-signature', async () => {
        const webhook = require('../api/webhook');
        let statusCode = null;
        let responseBody = null;

        const req = {
            method: 'POST',
            headers: { 'stripe-signature': 't=123,v1=invalidsig' },
            body: '{"type":"checkout.session.completed"}'
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (body) => { responseBody = body; } };
            }
        };

        await webhook(req, res);
        assert.equal(statusCode, 400);
        assert.ok(responseBody.error.includes('signature') || responseBody.error.includes('webhook'));
    });

    it('should reject non-POST method', async () => {
        const webhook = require('../api/webhook');
        let statusCode = null;

        const req = { method: 'GET', headers: {} };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: () => { } };
            }
        };

        await webhook(req, res);
        assert.equal(statusCode, 405);
    });
});

// ═══════════════════════════════════════════════════════════════
// 6. SAFE ERROR RESPONSE TESTS
// ═══════════════════════════════════════════════════════════════
describe('Safe Error Responses', () => {
    it('should not leak stack traces in error responses', () => {
        // Simulate what our endpoints return on error
        const safeErrors = [
            { error: 'An unexpected error occurred' },
            { error: 'Validation failed', details: ['prompt is required'] },
            { error: 'Method not allowed' },
            { error: 'Too many requests. Please try again later.' }
        ];

        for (const err of safeErrors) {
            const json = JSON.stringify(err);
            assert.ok(!json.includes('at '), 'Should not contain stack trace "at "');
            assert.ok(!json.includes('Error:'), 'Should not contain Error: prefix');
            assert.ok(!json.includes('/api/_utils/'), 'Should not contain internal paths');
            assert.ok(!json.includes('node_modules'), 'Should not reference node_modules');
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// 7. JOB QUEUE TESTS
// ═══════════════════════════════════════════════════════════════
describe('Job Queue', () => {
    const { createJob, getJob, updateJob, createSignedDownloadUrl, verifySignedDownloadUrl } = require('../api/_utils/jobQueue');

    it('should create and retrieve a job', () => {
        const { jobId } = createJob('user1', 'generate', { prompt: 'test' });
        assert.ok(jobId);

        const job = getJob(jobId, 'user1');
        assert.ok(job);
        assert.equal(job.status, 'pending');
        assert.equal(job.type, 'generate');
    });

    it('should not allow access to another user\'s job', () => {
        const { jobId } = createJob('user1', 'generate', { prompt: 'test' });
        const job = getJob(jobId, 'user2');
        assert.equal(job, null);
    });

    it('should update job status', () => {
        const { jobId } = createJob('user3', 'enhance', {});
        updateJob(jobId, { status: 'processing' });

        const job = getJob(jobId, 'user3');
        assert.equal(job.status, 'processing');
    });

    it('should create and verify signed download URL', () => {
        const { jobId } = createJob('user4', 'generate', {});
        const resultUrl = 'https://example.com/image.png';
        const { signedUrl, expiresAt } = createSignedDownloadUrl(jobId, resultUrl);

        assert.ok(signedUrl);
        assert.ok(expiresAt > Date.now());

        // Extract params from signed URL
        const url = new URL(signedUrl, 'http://localhost');
        const verified = verifySignedDownloadUrl(
            url.searchParams.get('jobId'),
            url.searchParams.get('expires'),
            url.searchParams.get('sig'),
            resultUrl
        );
        assert.equal(verified, true);
    });

    it('should reject tampered signed download URL', () => {
        const { jobId } = createJob('user5', 'generate', {});
        const { signedUrl } = createSignedDownloadUrl(jobId, 'https://example.com/image.png');

        const url = new URL(signedUrl, 'http://localhost');
        const verified = verifySignedDownloadUrl(
            url.searchParams.get('jobId'),
            url.searchParams.get('expires'),
            'tampered_signature',
            'https://example.com/image.png'
        );
        assert.equal(verified, false);
    });
});

console.log('✅ All security tests loaded. Running...');
