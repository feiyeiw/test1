import {
    jsonResponse,
    requireKv,
    toPublicBlog,
    getBlog,
    listBlogs
} from './_blogStore.js';

export async function onRequest({ request, env }) {
    if (request.method !== 'GET') {
        return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
    }

    try {
        const kv = requireKv(env);
        const index = await listBlogs(kv, { includeDrafts: false });
        const blogs = [];

        for (const item of index) {
            const blog = await getBlog(kv, item.id);
            if (blog && blog.status === 'published') {
                blogs.push(toPublicBlog(blog));
            }
        }

        return jsonResponse(blogs, 200, { 'Cache-Control': 'public, max-age=60' });
    } catch (error) {
        console.error('Public blog list error:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
}
