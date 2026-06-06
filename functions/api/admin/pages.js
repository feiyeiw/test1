import {
    jsonResponse,
    requireAdmin,
    requireKv,
    listPages
} from '../_pageStore.js';

export async function onRequestGet({ request, env }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        return jsonResponse(await listPages(requireKv(env)));
    } catch (error) {
        console.error('Admin page list error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
