import {
    jsonResponse,
    requireAdmin,
    requireKv,
    normalizeBlog,
    validateBlog,
    putBlog,
    listBlogs
} from '../_blogStore.js';

export async function onRequestGet({ request, env }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const kv = requireKv(env);
        const blogs = await listBlogs(kv, { includeDrafts: true });
        return jsonResponse(blogs);
    } catch (error) {
        console.error('Admin blog list error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const kv = requireKv(env);
        const body = await request.json();
        const blog = normalizeBlog(body);
        const validationError = validateBlog(blog);
        if (validationError) return jsonResponse({ error: validationError }, 400);

        const saved = await putBlog(kv, blog);
        return jsonResponse(saved, 201);
    } catch (error) {
        console.error('Admin blog create error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
