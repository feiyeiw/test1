/**
 * Blog API - Handles GET (list all blogs) and POST (create new blog)
 *
 * GET /api/blogs - Public, returns all blogs
 * POST /api/blogs - Requires JWT Bearer token or legacy API key
 */

// ====== JWT Utilities (inlined for Cloudflare Pages Functions compatibility) ======
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

function base64UrlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
    str += new Array(5 - (str.length % 4)).join('=');
    str = str.replace(/\-/g, '+').replace(/\_/g, '/');
    const bytes = atob(str).split('').map(c => c.charCodeAt(0));
    return new Uint8Array(bytes);
}

async function importJwtSecret(secret) {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey('raw', encoder.encode(secret), ALGORITHM, false, ['sign', 'verify']);
}

async function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, signatureB64] = parts;
        const key = await importJwtSecret(secret);
        const encoder = new TextEncoder();
        const expectedSig = base64UrlDecode(signatureB64);
        const isValid = await crypto.subtle.verify(ALGORITHM, key, expectedSig, encoder.encode(`${headerB64}.${payloadB64}`));
        if (!isValid) return null;
        const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));
        const payload = JSON.parse(payloadStr);
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

function unauthorizedResponse(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
// ====== End JWT Utilities ======

// Validate request: supports JWT Bearer token (preferred) or legacy X-API-Key
async function validateAuth(request, env) {
    const token = extractBearerToken(request);
    if (token && env.JWT_SECRET) {
        const payload = await verifyToken(token, env.JWT_SECRET);
        if (payload && payload.role === 'admin') {
            return { valid: true, method: 'jwt', user: payload.sub };
        }
    }
    const apiKey = request.headers.get('X-API-Key');
    const expectedKey = env.API_KEY;
    if (expectedKey && apiKey === expectedKey) {
        return { valid: true, method: 'apikey' };
    }
    if (!expectedKey && !env.JWT_SECRET) {
        console.error('Neither JWT_SECRET nor API_KEY environment variable is set');
    }
    return { valid: false };
}

// Helper function to get all blog keys from KV
async function getAllBlogKeys(kv) {
    try {
        const listResult = await kv.list({ prefix: 'blog:' });
        return listResult.keys;
    } catch (error) {
        console.error('Error listing blog keys from KV:', error);
        return [];
    }
}

// Helper function to get all blogs from KV
async function getAllBlogsFromKV(kv) {
    try {
        const keys = await getAllBlogKeys(kv);

        if (keys.length === 0) {
            return [];
        }

        const blogs = [];
        for (const key of keys) {
            try {
                const data = await kv.get(key.name);
                if (data) {
                    const blog = JSON.parse(data);
                    blogs.push(blog);
                }
            } catch (error) {
                console.error(`Error parsing blog ${key.name}:`, error);
            }
        }

        // Sort by date (newest first)
        blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        return blogs;
    } catch (error) {
        console.error('Error getting all blogs from KV:', error);
        return [];
    }
}

// Helper function to save blog to KV
async function saveBlogToKV(kv, blog) {
    try {
        await kv.put(`blog:${blog.id}`, JSON.stringify(blog));
        return true;
    } catch (error) {
        console.error(`Error saving blog ${blog.id} to KV:`, error);
        return false;
    }
}

// GET handler - returns all blogs
async function handleGet(request, env) {
    try {
        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const blogs = await getAllBlogsFromKV(kv);

        return new Response(JSON.stringify(blogs), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60' // Cache for 1 minute
            }
        });
    } catch (error) {
        console.error('Error in GET handler:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// POST handler - creates new blog
async function handlePost(request, env) {
    try {
        // Validate authentication (JWT preferred, fallback to API key)
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
            return unauthorizedResponse('Unauthorized: Invalid or missing authentication');
        }

        // Parse request body
        let blogData;
        try {
            blogData = await request.json();
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate required fields
        if (!blogData.title || !blogData.content) {
            return new Response(JSON.stringify({ error: 'Title and content are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Generate blog ID (timestamp + random suffix to avoid collisions)
        const blogId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create blog object
        const blog = {
            id: blogId,
            title: blogData.title.trim(),
            content: blogData.content.trim(),
            plainText: blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
            date: blogData.date || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Save to KV
        const saved = await saveBlogToKV(kv, blog);
        if (!saved) {
            return new Response(JSON.stringify({ error: 'Failed to save blog' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(blog), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error in POST handler:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Main handler
export async function onRequest(context) {
    const { request, env } = context;

    // Route based on HTTP method
    switch (request.method) {
        case 'GET':
            return await handleGet(request, env);

        case 'POST':
            return await handlePost(request, env);

        default:
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            });
    }
}