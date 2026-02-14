/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Image Generation Endpoint (Secured)
   POST /api/generate
   ═══════════════════════════════════════════════════════════════ */

const { authMiddleware } = require('./_utils/auth');
const { validateGenerateInput, isBodyTooLarge } = require('./_utils/validate');
const { createRateLimiter } = require('./_utils/rateLimiter');
const { verifyRequestToken } = require('./_utils/token');
const { createJob, updateJob } = require('./_utils/jobQueue');

// Rate limiter: 5 requests per minute per user
const limiter = createRateLimiter({
    maxRequests: 5,
    windowMs: 60000,
    keyPrefix: 'gen',
    useFingerprint: true
});

// Max body size: 1 MB
const MAX_BODY_BYTES = 1 * 1024 * 1024;

async function handler(req, res) {
    // ── Method check ─────────────────────────────────────────
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Body size check ──────────────────────────────────────
    if (isBodyTooLarge(req, MAX_BODY_BYTES)) {
        return res.status(413).json({ error: 'Request body too large' });
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
        const validation = validateGenerateInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
        }

        // ── Create job ───────────────────────────────────────
        const { prompt, model, size, quality, negativePrompt } = req.body;
        const { jobId } = createJob(req.user.id, 'generate', {
            prompt: prompt.trim(),
            model: model || 'dall-e-3',
            size: size || '1024x1024',
            quality: quality || 'standard',
            negativePrompt: negativePrompt || ''
        });

        // ── Process asynchronously ───────────────────────────
        // In production, this would call OpenAI/Replicate API
        // For now, simulate async processing
        processGenerationJob(jobId).catch(err => {
            console.error(`Job ${jobId} failed:`, err.message);
            updateJob(jobId, { status: 'failed', error: 'Generation failed. Please try again.' });
        });

        return res.status(202).json({
            success: true,
            jobId,
            message: 'Generation job created. Poll /api/job-status?jobId=' + jobId
        });

    } catch (error) {
        console.error('Generate endpoint error:', error.message);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
}

/**
 * Process the generation job (async)
 * In production, replace with actual AI provider API call
 */
async function processGenerationJob(jobId) {
    const { getJob } = require('./_utils/jobQueue');
    const job = getJob(jobId, undefined); // internal access

    if (!job) return;

    updateJob(jobId, { status: 'processing' });

    // ── Call AI Provider ─────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        updateJob(jobId, { status: 'failed', error: 'AI provider not configured' });
        return;
    }

    try {
        // Timeout: 30 seconds
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: job.params.model || 'dall-e-3',
                prompt: job.params.prompt,
                n: 1,
                size: job.params.size || '1024x1024',
                quality: job.params.quality || 'standard'
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

        if (!imageUrl) {
            throw new Error('No image returned from AI provider');
        }

        const { createSignedDownloadUrl } = require('./_utils/jobQueue');
        const { signedUrl, expiresAt } = createSignedDownloadUrl(jobId, imageUrl);

        updateJob(jobId, {
            status: 'completed',
            result: { imageUrl, signedUrl, expiresAt }
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            updateJob(jobId, { status: 'failed', error: 'Generation timed out' });
        } else {
            updateJob(jobId, { status: 'failed', error: 'Generation failed. Please try again.' });
        }
        console.error(`Generation job ${jobId} error:`, err.message);
    }
}

// Wrap with auth middleware
module.exports = authMiddleware(handler);
