/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Async Job Queue
   In-memory job tracking with signed download URLs
   ═══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const DOWNLOAD_SECRET = process.env.REQUEST_TOKEN_SECRET || process.env.JWT_SECRET;
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory job store
const jobs = new Map();

// Cleanup completed/failed jobs after 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobs) {
        if (now - job.createdAt > 30 * 60 * 1000) {
            jobs.delete(jobId);
        }
    }
}, 5 * 60 * 1000);

/**
 * Create a new job
 * @param {string} userId
 * @param {string} type - 'generate' | 'enhance'
 * @param {object} params - job parameters
 * @returns {{ jobId: string, status: string }}
 */
function createJob(userId, type, params) {
    const jobId = crypto.randomBytes(16).toString('hex');
    const job = {
        jobId,
        userId,
        type,
        params,
        status: 'pending', // pending → processing → completed | failed
        result: null,
        error: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    jobs.set(jobId, job);
    return { jobId, status: 'pending' };
}

/**
 * Get a job by ID (only if owned by user)
 * @param {string} jobId
 * @param {string} userId
 * @returns {object|null}
 */
function getJob(jobId, userId) {
    const job = jobs.get(jobId);
    if (!job || job.userId !== userId) return null;
    return job;
}

/**
 * Update a job
 * @param {string} jobId
 * @param {object} updates
 */
function updateJob(jobId, updates) {
    const job = jobs.get(jobId);
    if (!job) return null;
    Object.assign(job, updates, { updatedAt: Date.now() });
    return job;
}

/**
 * Create a signed download URL for a completed job
 * @param {string} jobId
 * @param {string} resultUrl - the actual URL or data to serve
 * @returns {{ signedUrl: string, expiresAt: number }}
 */
function createSignedDownloadUrl(jobId, resultUrl) {
    const expiresAt = Date.now() + DOWNLOAD_URL_TTL_MS;
    const payload = `${jobId}:${expiresAt}:${resultUrl}`;
    const signature = crypto.createHmac('sha256', DOWNLOAD_SECRET).update(payload).digest('hex');

    // Encode as query params so the client can use it
    const signedUrl = `/api/download?jobId=${jobId}&expires=${expiresAt}&sig=${signature}`;
    return { signedUrl, expiresAt };
}

/**
 * Verify a signed download URL
 * @param {string} jobId
 * @param {string} expires
 * @param {string} sig
 * @param {string} resultUrl
 * @returns {boolean}
 */
function verifySignedDownloadUrl(jobId, expires, sig, resultUrl) {
    const expiresAt = parseInt(expires, 10);
    if (Date.now() > expiresAt) return false;

    const payload = `${jobId}:${expiresAt}:${resultUrl}`;
    const expectedSig = crypto.createHmac('sha256', DOWNLOAD_SECRET).update(payload).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
    } catch {
        return false;
    }
}

module.exports = {
    createJob,
    getJob,
    updateJob,
    createSignedDownloadUrl,
    verifySignedDownloadUrl
};
