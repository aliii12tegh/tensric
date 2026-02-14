/* ═══════════════════════════════════════════════════════════════
   NEXUS AI - Input Validation Utility
   ═══════════════════════════════════════════════════════════════ */

// Allowed enums
const VALID_MODELS = ['dall-e-3', 'dall-e-2', 'stable-diffusion-xl', 'sdxl'];
const VALID_SIZES = ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'];
const VALID_QUALITIES = ['standard', 'hd'];
const VALID_ENHANCE_TYPES = ['upscale', 'denoise', 'colorize', 'restore', 'sharpen', 'background-remove'];

const MAX_PROMPT_LENGTH = 2000;
const MAX_BASE64_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Validate image generation input
 * @param {object} body - request body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateGenerateInput(body) {
    const errors = [];

    if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body must be a JSON object'] };
    }

    // Prompt — required, string, 1–2000 chars
    if (!body.prompt || typeof body.prompt !== 'string') {
        errors.push('prompt is required and must be a string');
    } else {
        const trimmed = body.prompt.trim();
        if (trimmed.length < 1) {
            errors.push('prompt must not be empty');
        }
        if (trimmed.length > MAX_PROMPT_LENGTH) {
            errors.push(`prompt must be at most ${MAX_PROMPT_LENGTH} characters`);
        }
    }

    // Model — optional, must be in allowed list
    if (body.model !== undefined) {
        if (!VALID_MODELS.includes(body.model)) {
            errors.push(`model must be one of: ${VALID_MODELS.join(', ')}`);
        }
    }

    // Size — optional, must be in allowed list
    if (body.size !== undefined) {
        if (!VALID_SIZES.includes(body.size)) {
            errors.push(`size must be one of: ${VALID_SIZES.join(', ')}`);
        }
    }

    // Quality — optional, must be in allowed list
    if (body.quality !== undefined) {
        if (!VALID_QUALITIES.includes(body.quality)) {
            errors.push(`quality must be one of: ${VALID_QUALITIES.join(', ')}`);
        }
    }

    // Negative prompt — optional, same limits as prompt
    if (body.negativePrompt !== undefined) {
        if (typeof body.negativePrompt !== 'string') {
            errors.push('negativePrompt must be a string');
        } else if (body.negativePrompt.length > MAX_PROMPT_LENGTH) {
            errors.push(`negativePrompt must be at most ${MAX_PROMPT_LENGTH} characters`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate image enhancement input
 * @param {object} body - request body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEnhanceInput(body) {
    const errors = [];

    if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body must be a JSON object'] };
    }

    // Image — required, base64 string
    if (!body.image || typeof body.image !== 'string') {
        errors.push('image is required and must be a base64 string');
    } else {
        // Estimate decoded size from base64 length
        const estimatedSize = Math.ceil(body.image.length * 0.75);
        if (estimatedSize > MAX_BASE64_SIZE) {
            errors.push(`image must be at most ${MAX_BASE64_SIZE / (1024 * 1024)} MB`);
        }
    }

    // Enhancement type — required
    if (!body.type || typeof body.type !== 'string') {
        errors.push('type is required and must be a string');
    } else if (!VALID_ENHANCE_TYPES.includes(body.type)) {
        errors.push(`type must be one of: ${VALID_ENHANCE_TYPES.join(', ')}`);
    }

    // Scale — optional, must be 1-4
    if (body.scale !== undefined) {
        const scale = Number(body.scale);
        if (isNaN(scale) || scale < 1 || scale > 4) {
            errors.push('scale must be a number between 1 and 4');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Check Content-Length against a max body size
 * @param {object} req - request object
 * @param {number} maxBytes - max allowed body size
 * @returns {boolean} true if over limit
 */
function isBodyTooLarge(req, maxBytes) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    return contentLength > maxBytes;
}

module.exports = {
    validateGenerateInput,
    validateEnhanceInput,
    isBodyTooLarge,
    VALID_MODELS,
    VALID_SIZES,
    VALID_QUALITIES,
    VALID_ENHANCE_TYPES,
    MAX_PROMPT_LENGTH,
    MAX_BASE64_SIZE
};
