/**
 * Blog Detail API - Handles GET, PUT, DELETE for individual blogs
 *
 * GET /api/blogs/:id - Public, returns specific blog
 * PUT /api/blogs/:id - Requires API key, updates blog
 * DELETE /api/blogs/:id - Requires API key, deletes blog
 */

// Helper function to validate API key
function validateApiKey(request) {
    const apiKey = request.headers.get('X-API-Key');
    const expectedKey = process.env.API_KEY || context.env.API_KEY;

    if (!expectedKey) {
        console.error('API_KEY environment variable is not set');
        return false;
    }

    return apiKey === expectedKey;
}

// Helper function to get blog by ID from KV
async function getBlogById(kv, id) {
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

// GET handler - returns specific blog by ID
async function handleGet(request, env, id) {
    try {
        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const blog = await getBlogById(kv, id);
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
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
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
        // Validate API key
        if (!validateApiKey(request)) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid API key' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if blog exists
        const existingBlog = await getBlogById(kv, id);
        if (!existingBlog) {
            return new Response(JSON.stringify({ error: 'Blog not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body
        let updateData;
        try {
            updateData = await request.json();
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate required fields if provided
        if (updateData.title !== undefined && !updateData.title.trim()) {
            return new Response(JSON.stringify({ error: 'Title cannot be empty' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (updateData.content !== undefined && !updateData.content.trim()) {
            return new Response(JSON.stringify({ error: 'Content cannot be empty' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update blog object
        const updatedBlog = {
            ...existingBlog,
            ...updateData,
            id: id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };

        // Regenerate plainText if content was updated
        if (updateData.content !== undefined) {
            updatedBlog.plainText = updateData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Save updated blog
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
        // Validate API key
        if (!validateApiKey(request)) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid API key' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const kv = env.BLOG_DATA;
        if (!kv) {
            return new Response(JSON.stringify({ error: 'KV storage not available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if blog exists
        const existingBlog = await getBlogById(kv, id);
        if (!existingBlog) {
            return new Response(JSON.stringify({ error: 'Blog not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Delete blog
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

    // Set CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Route based on HTTP method
    switch (request.method) {
        case 'GET':
            const getResponse = await handleGet(request, env, id);
            for (const [key, value] of Object.entries(corsHeaders)) {
                getResponse.headers.set(key, value);
            }
            return getResponse;

        case 'PUT':
            const putResponse = await handlePut(request, env, id);
            for (const [key, value] of Object.entries(corsHeaders)) {
                putResponse.headers.set(key, value);
            }
            return putResponse;

        case 'DELETE':
            const deleteResponse = await handleDelete(request, env, id);
            for (const [key, value] of Object.entries(corsHeaders)) {
                deleteResponse.headers.set(key, value);
            }
            return deleteResponse;

        default:
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
    }
}