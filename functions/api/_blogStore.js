const BLOG_PREFIX = 'blog_v2:';
const BLOG_INDEX_KEY = 'blog_v2_index';
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

function base64UrlDecode(str) {
    str += '='.repeat((4 - (str.length % 4)) % 4);
    str = str.replace(/\-/g, '+').replace(/\_/g, '/');
    const bytes = atob(str).split('').map(c => c.charCodeAt(0));
    return new Uint8Array(bytes);
}

async function importJwtSecret(secret) {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey('raw', encoder.encode(secret), ALGORITHM, false, ['verify']);
}

async function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, signatureB64] = parts;
        const key = await importJwtSecret(secret);
        const encoder = new TextEncoder();
        const signature = base64UrlDecode(signatureB64);
        const valid = await crypto.subtle.verify(ALGORITHM, key, signature, encoder.encode(`${headerB64}.${payloadB64}`));
        if (!valid) return null;
        const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) return null;
        return payload;
    } catch (error) {
        console.error('JWT verification error:', error);
        return null;
    }
}

function extractBearerToken(request) {
    const auth = request.headers.get('Authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}

async function requireAdmin(request, env) {
    const token = extractBearerToken(request);
    if (!token || !env.JWT_SECRET) {
        return null;
    }
    const payload = await verifyToken(token, env.JWT_SECRET);
    return payload && payload.role === 'admin' ? payload : null;
}

function requireKv(env) {
    if (!env.BLOG_DATA) {
        throw new Error('KV storage not available');
    }
    return env.BLOG_DATA;
}

function makeId() {
    return `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function slugify(value, fallback) {
    const slug = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 90);
    return slug || fallback;
}

function stripHtml(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeStatus(status) {
    return status === 'published' ? 'published' : 'draft';
}

function normalizeBlog(input = {}, existing = null) {
    const now = new Date().toISOString();
    const id = existing?.id || input.id || makeId();
    const title = String(input.title || existing?.title || '').trim();
    const contentHtml = String(input.contentHtml ?? input.content ?? existing?.contentHtml ?? existing?.content ?? '').trim();
    const status = normalizeStatus(input.status || existing?.status);
    const date = input.date || existing?.date || now.split('T')[0];
    const previousPublishedAt = existing?.status === 'published' ? existing.publishedAt : null;
    const publishedAt = status === 'published'
        ? (input.publishedAt || previousPublishedAt || now)
        : null;

    return {
        id,
        slug: slugify(input.slug || title, id),
        title,
        summary: String(input.summary || '').trim(),
        coverImage: String(input.coverImage || '').trim(),
        category: String(input.category || '').trim(),
        author: String(input.author || '13ASRS').trim(),
        contentHtml,
        plainText: String(input.plainText || stripHtml(contentHtml)).trim(),
        status,
        seoTitle: String(input.seoTitle || '').trim(),
        seoDescription: String(input.seoDescription || '').trim(),
        createdAt: existing?.createdAt || input.createdAt || now,
        updatedAt: now,
        publishedAt,
        date
    };
}

function validateBlog(blog) {
    if (!blog.title) return 'Title is required';
    if (!blog.contentHtml) return 'Content is required';
    return null;
}

function toIndexEntry(blog) {
    return {
        id: blog.id,
        slug: blog.slug,
        title: blog.title,
        summary: blog.summary,
        coverImage: blog.coverImage,
        category: blog.category,
        author: blog.author,
        status: blog.status,
        date: blog.date,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt,
        publishedAt: blog.publishedAt
    };
}

function toPublicBlog(blog) {
    return {
        ...blog,
        content: blog.contentHtml,
        youtubeUrl: '',
        tocEnabled: true,
        relatedCase: '',
        relatedProjects: '',
        relatedSolutions: ''
    };
}

async function readIndex(kv) {
    const data = await kv.get(BLOG_INDEX_KEY);
    if (!data) return [];
    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeIndex(kv, index) {
    const sorted = [...index].sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
    await kv.put(BLOG_INDEX_KEY, JSON.stringify(sorted));
    return sorted;
}

async function getBlog(kv, id) {
    const data = await kv.get(`${BLOG_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
}

async function putBlog(kv, blog) {
    await kv.put(`${BLOG_PREFIX}${blog.id}`, JSON.stringify(blog));
    const index = await readIndex(kv);
    const nextIndex = index.filter(item => item.id !== blog.id);
    nextIndex.unshift(toIndexEntry(blog));
    await writeIndex(kv, nextIndex);
    return blog;
}

async function deleteBlog(kv, id) {
    await kv.delete(`${BLOG_PREFIX}${id}`);
    const index = await readIndex(kv);
    await writeIndex(kv, index.filter(item => item.id !== id));
}

async function listBlogs(kv, { includeDrafts = false } = {}) {
    const index = await readIndex(kv);
    const filtered = includeDrafts ? index : index.filter(item => item.status === 'published');
    return filtered.sort((a, b) => new Date(b.date || b.updatedAt) - new Date(a.date || a.updatedAt));
}

export {
    jsonResponse,
    requireAdmin,
    requireKv,
    normalizeBlog,
    validateBlog,
    toPublicBlog,
    getBlog,
    putBlog,
    deleteBlog,
    listBlogs
};
