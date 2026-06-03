import {
    jsonResponse,
    requireAdmin,
    requireKv,
    normalizeBlog,
    validateBlog,
    getBlog,
    putBlog,
    deleteBlog
} from '../../_blogStore.js';

export async function onRequestGet({ request, env, params }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const blog = await getBlog(requireKv(env), params.id);
        if (!blog) return jsonResponse({ error: 'Blog not found' }, 404);
        return jsonResponse(blog);
    } catch (error) {
        console.error('Admin blog get error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}

export async function onRequestPut({ request, env, params }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const kv = requireKv(env);
        const existing = await getBlog(kv, params.id);
        if (!existing) return jsonResponse({ error: 'Blog not found' }, 404);

        const body = await request.json();
        const blog = normalizeBlog({ ...body, id: params.id }, existing);
        const validationError = validateBlog(blog);
        if (validationError) return jsonResponse({ error: validationError }, 400);

        return jsonResponse(await putBlog(kv, blog));
    } catch (error) {
        console.error('Admin blog update error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}

export async function onRequestDelete({ request, env, params }) {
    const admin = await requireAdmin(request, env);
    if (!admin) return jsonResponse({ error: 'Unauthorized' }, 401);

    try {
        const kv = requireKv(env);
        const existing = await getBlog(kv, params.id);
        if (!existing) return jsonResponse({ error: 'Blog not found' }, 404);
        await deleteBlog(kv, params.id);
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Admin blog delete error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
