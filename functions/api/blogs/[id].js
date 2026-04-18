/**
 * Single Blog API - Handles GET, PUT, DELETE for a specific blog
 *
 * GET /api/blogs/:id - Public, returns single blog
 * PUT /api/blogs/:id - Requires JWT Bearer token or legacy API key
 * DELETE /api/blogs/:id - Requires JWT Bearer token or legacy API key
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

// Helper function to get blog by ID from KV
async function getBlogByIdFromKV(kv, id) {
    try {
        const data = await kv.get(`blog:${id}`);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error getting blog ${id} from KV:`, error);
        return null;
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

// Helper function to delete blog from KV
async function deleteBlogFromKV(kv, id) {
    try {
        await kv.delete(`blog:${id}`);
        return true;
    } catch (error) {
        console.error(`Error deleting blog ${id} from KV:`, error);
        return false;
    }
}

// GET handler - returns single blog by ID
async function handleGet(request, env, id) {
    try {
        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const blog = await getBlogByIdFromKV(kv, id);
        if (!blog) {
            return new Response(JSON.stringify({ error: 'Blog not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(blog), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60'
            }
        });
    } catch (error) {
        console.error(`Error in GET handler for blog ${id}:`, error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// PUT handler - updates existing blog
async function handlePut(request, env, id) {
    try {
        // Validate authentication (JWT preferred, fallback to API key)
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
            return unauthorizedResponse('Unauthorized: Invalid or missing authentication');
        }

        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if blog exists
        const existingBlog = await getBlogByIdFromKV(kv, id);
        if (!existingBlog) {
            return new Response(JSON.stringify({ error: 'Blog not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
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

        // Validate required fields if provided
        if (blogData.title !== undefined && !blogData.title.trim()) {
            return new Response(JSON.stringify({ error: 'Title cannot be empty' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (blogData.content !== undefined && !blogData.content.trim()) {
            return new Response(JSON.stringify({ error: 'Content cannot be empty' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update blog object
        const updatedBlog = {
            ...existingBlog,
            ...blogData,
            id: id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };

        // Regenerate plainText if content changed
        if (blogData.content !== undefined) {
            updatedBlog.plainText = blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Save to KV
        const saved = await saveBlogToKV(kv, updatedBlog);
        if (!saved) {
            return new Response(JSON.stringify({ error: 'Failed to update blog' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(updatedBlog), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(`Error in PUT handler for blog ${id}:`, error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// DELETE handler - deletes blog
async function handleDelete(request, env, id) {
    try {
        // Validate authentication (JWT preferred, fallback to API key)
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
            return unauthorizedResponse('Unauthorized: Invalid or missing authentication');
        }

        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if blog exists
        const existingBlog = await getBlogByIdFromKV(kv, id);
        if (!existingBlog) {
            return new Response(JSON.stringify({ error: 'Blog not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Delete from KV
        const deleted = await deleteBlogFromKV(kv, id);
        if (!deleted) {
            return new Response(JSON.stringify({ error: 'Failed to delete blog' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, message: 'Blog deleted successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(`Error in DELETE handler for blog ${id}:`, error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Main handler
export async function onRequest(context) {
    const { request, env, params } = context;
    const { id } = params;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Blog ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Route based on HTTP method
    switch (request.method) {
        case 'GET':
            return await handleGet(request, env, id);

        case 'PUT':
            return await handlePut(request, env, id);

        case 'DELETE':
            return await handleDelete(request, env, id);

        default:
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            });
    }
}