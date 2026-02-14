/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Image Enhancement Endpoint (Secured)
   POST /api/enhance
   ═══════════════════════════════════════════════════════════════ */

const { authMiddleware } = require('./_utils/auth');
const { validateEnhanceInput, isBodyTooLarge } = require('./_utils/validate');
const { createRateLimiter } = require('./_utils/rateLimiter');
const { verifyRequestToken } = require('./_utils/token');
const { createJob, updateJob } = require('./_utils/jobQueue');

// Rate limiter: 3 requests per minute per user
const limiter = createRateLimiter({
    maxRequests: 3,
    windowMs: 60000,
    keyPrefix: 'enh',
    useFingerprint: true
});

// Max body size: 15 MB (base64 images are larger)
const MAX_BODY_BYTES = 15 * 1024 * 1024;

async function handler(req, res) {
    // ── Method check ─────────────────────────────────────────
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Body size check ──────────────────────────────────────
    if (isBodyTooLarge(req, MAX_BODY_BYTES)) {
        return res.status(413).json({ error: 'Request body too large (max 15 MB)' });
    }

    // ── Rate limiting ────────────────────────────────────────
    const blocked = limiter(req, res);
    if (blocked) return;

    try {
        // ── Anti-replay token verification ───────────────────
        const requestToken = req.headers['x-request-token'];
        if (!requestToken) {
            return res.status(400).json({ error: 'Missing request token' });
        }

        const tokenResult = verifyRequestToken(requestToken, req.user.id);
        if (!tokenResult.valid) {
            return res.status(403).json({ error: tokenResult.error || 'Invalid request token' });
        }

        // ── Input validation ─────────────────────────────────
        const validation = validateEnhanceInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
        }

        // ── Create job ───────────────────────────────────────
        const { image, type, scale } = req.body;
        const { jobId } = createJob(req.user.id, 'enhance', {
            type,
            scale: scale || 2,
            imageSize: Math.ceil(image.length * 0.75) // estimate decoded size
        });

        // ── Process asynchronously ───────────────────────────
        processEnhancementJob(jobId, image).catch(err => {
            console.error(`Enhancement job ${jobId} failed:`, err.message);
            updateJob(jobId, { status: 'failed', error: 'Enhancement failed. Please try again.' });
        });

        return res.status(202).json({
            success: true,
            jobId,
            message: 'Enhancement job created. Poll /api/job-status?jobId=' + jobId
        });

    } catch (error) {
        console.error('Enhance endpoint error:', error.message);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
}

/**
 * Process the enhancement job (async)
 * In production, replace with actual AI provider API call
 */
async function processEnhancementJob(jobId, imageData) {
    const { getJob } = require('./_utils/jobQueue');
    const job = getJob(jobId, undefined);

    if (!job) return;

    updateJob(jobId, { status: 'processing' });

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
        // Fallback: try OpenAI
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            updateJob(jobId, { status: 'failed', error: 'AI provider not configured' });
            return;
        }
    }

    try {
        // Timeout: 60 seconds (enhancement can be slower)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        // Use Replicate for image enhancement if available
        if (process.env.REPLICATE_API_TOKEN) {
            const response = await fetch('https://api.replicate.com/v1/predictions', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', // Real-ESRGAN
                    input: {
                        image: `data:image/png;base64,${imageData}`,
                        scale: job.params.scale || 2
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`Replicate API error: ${response.status}`);
            }

            const data = await response.json();
            const resultUrl = data.output || data.urls?.get;

            const { createSignedDownloadUrl } = require('./_utils/jobQueue');
            const { signedUrl, expiresAt } = createSignedDownloadUrl(jobId, resultUrl || '');

            updateJob(jobId, {
                status: 'completed',
                result: { imageUrl: resultUrl, signedUrl, expiresAt }
            });
        } else {
            clearTimeout(timeout);
            updateJob(jobId, { status: 'failed', error: 'No enhancement provider configured' });
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            updateJob(jobId, { status: 'failed', error: 'Enhancement timed out' });
        } else {
            updateJob(jobId, { status: 'failed', error: 'Enhancement failed. Please try again.' });
        }
        console.error(`Enhancement job ${jobId} error:`, err.message);
    }
}

// Wrap with auth middleware
module.exports = authMiddleware(handler);
