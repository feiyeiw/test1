/**
 * Blog API - Handles GET (list all blogs) and POST (create new blog)
 *
 * GET /api/blogs - Public, returns all blogs
 * POST /api/blogs - Requires API key, creates new blog
 */

// Helper function to validate API key
function validateApiKey(request, env) {
    const apiKey = request.headers.get('X-API-Key');
    const expectedKey = env.API_KEY;

    if (!expectedKey) {
        console.error('API_KEY environment variable is not set');
        return false;
    }

    return apiKey === expectedKey;
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
        // Validate API key
        if (!validateApiKey(request, env)) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid API key' }), {
                status: 401,
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