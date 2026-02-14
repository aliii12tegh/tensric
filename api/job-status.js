/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Job Status Endpoint
   GET /api/job-status?jobId=xxx
   ═══════════════════════════════════════════════════════════════ */

const { authMiddleware } = require('./_utils/auth');
const { getJob } = require('./_utils/jobQueue');

async function handler(req, res) {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const jobId = req.query?.jobId || new URL(req.url, 'http://localhost').searchParams.get('jobId');

        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({ error: 'jobId query parameter is required' });
        }

        // Validate jobId format (hex string, 32 chars)
        if (!/^[a-f0-9]{32}$/.test(jobId)) {
            return res.status(400).json({ error: 'Invalid jobId format' });
        }

        const job = getJob(jobId, req.user.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Build safe response (no internal details)
        const response = {
            jobId: job.jobId,
            status: job.status,
            type: job.type,
            createdAt: job.createdAt
        };

        if (job.status === 'completed' && job.result) {
            response.result = {
                signedUrl: job.result.signedUrl,
                expiresAt: job.result.expiresAt
            };
        }

        if (job.status === 'failed') {
            response.error = job.error || 'Job failed';
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error('Job status error:', error.message);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
}

module.exports = authMiddleware(handler);
