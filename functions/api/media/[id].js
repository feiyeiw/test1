import {
    jsonResponse,
    requireKv
} from '../_blogStore.js';

const MEDIA_PREFIX = 'media_v1:';

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export async function onRequestGet({ env, params }) {
    try {
        const data = await requireKv(env).get(`${MEDIA_PREFIX}${params.id}`);
        if (!data) return jsonResponse({ error: 'Image not found' }, 404);

        const media = JSON.parse(data);
        if (!media.base64 || !media.contentType) {
            return jsonResponse({ error: 'Image not found' }, 404);
        }

        return new Response(base64ToBytes(media.base64), {
            status: 200,
            headers: {
                'Content-Type': media.contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Content-Type-Options': 'nosniff',
            }
        });
    } catch (error) {
        console.error('Public image get error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
