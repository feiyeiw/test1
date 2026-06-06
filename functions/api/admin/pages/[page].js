import {
    jsonResponse,
    requireAdmin,
    requireKv,
    normalizePage,
    getPage,
    putPage
} from '../../_pageStore.js';

export async function onRequestGet({ request, env, params }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        return jsonResponse(await getPage(requireKv(env), params.page));
    } catch (error) {
        console.error('Admin page get error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}

export async function onRequestPut({ request, env, params }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const body = await request.json();
        const page = normalizePage({ ...body, page: params.page }, params.page);
        return jsonResponse(await putPage(requireKv(env), page));
    } catch (error) {
        console.error('Admin page save error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
