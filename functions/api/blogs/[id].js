import {
    jsonResponse,
    requireKv,
    toPublicBlog,
    getBlog
} from '../_blogStore.js';

export async function onRequest({ request, env, params }) {
    if (request.method !== 'GET') {
        return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
    }

    try {
        const blog = await getBlog(requireKv(env), params.id);
        if (!blog || blog.status !== 'published') {
            return jsonResponse({ error: 'Blog not found' }, 404);
        }
        return jsonResponse(toPublicBlog(blog), 200, { 'Cache-Control': 'public, max-age=60' });
    } catch (error) {
        console.error('Public blog detail error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
