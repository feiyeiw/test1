import {
    jsonResponse,
    requireAdmin,
    requireKv,
    normalizeBlog,
    validateBlog,
    getBlog,
    putBlog
} from '../../../_blogStore.js';

export async function onRequestPost({ request, env, params }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const kv = requireKv(env);
        const existing = await getBlog(kv, params.id);
        if (!existing) return jsonResponse({ error: 'Blog not found' }, 404);

        const blog = normalizeBlog({ ...existing, status: 'published' }, existing);
        const validationError = validateBlog(blog);
        if (validationError) return jsonResponse({ error: validationError }, 400);

        return jsonResponse(await putBlog(kv, blog));
    } catch (error) {
        console.error('Admin blog publish error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
