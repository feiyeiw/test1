import {
    jsonResponse,
    requireAdmin,
    requireKv
} from '../_blogStore.js';

const MEDIA_PREFIX = 'media_v1:';
const MAX_BASE64_LENGTH = 2_000_000;

function makeMediaId() {
    return `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function normalizeImagePayload(body) {
    const dataUrl = String(body?.dataUrl || '');
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { error: 'Only JPEG, PNG, or WebP image data is supported.' };

    const [, contentType, base64] = match;
    if (base64.length > MAX_BASE64_LENGTH) {
        return { error: 'Image is too large. Please choose a smaller image.' };
    }

    return {
        contentType,
        base64,
        filename: String(body?.filename || 'image').replace(/[^\w.-]+/g, '-').slice(0, 100),
        width: Number(body?.width || 0),
        height: Number(body?.height || 0),
    };
}

export async function onRequestPost({ request, env }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const body = await request.json();
        const image = normalizeImagePayload(body);
        if (image.error) return jsonResponse({ error: image.error }, 400);

        const id = makeMediaId();
        const media = {
            id,
            filename: image.filename,
            contentType: image.contentType,
            base64: image.base64,
            width: image.width,
            height: image.height,
            createdAt: new Date().toISOString(),
        };

        await requireKv(env).put(`${MEDIA_PREFIX}${id}`, JSON.stringify(media));
        return jsonResponse({
            id,
            url: `/api/media/${encodeURIComponent(id)}`,
            width: image.width,
            height: image.height,
            contentType: image.contentType,
        }, 201);
    } catch (error) {
        console.error('Admin image upload error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
