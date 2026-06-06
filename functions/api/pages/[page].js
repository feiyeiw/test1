import {
    jsonResponse,
    requireKv,
    getPage
} from '../_pageStore.js';

export async function onRequestGet({ env, params }) {
    try {
        const page = await getPage(requireKv(env), params.page);
        return jsonResponse(page, 200, { 'Cache-Control': 'public, max-age=60' });
    } catch (error) {
        console.error('Public page get error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
