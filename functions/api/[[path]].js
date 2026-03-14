/**
 * Cloudflare Pages Functions API for blog storage
 * Path: /api/*
 *
 * KV Namespace: BLOG_DATA
 *
 * Endpoints:
 * - GET    /api/blogs         - List all blogs
 * - POST   /api/blogs         - Create new blog (requires API key)
 * - GET    /api/blogs/:id     - Get single blog
 * - PUT    /api/blogs/:id     - Update blog (requires API key)
 * - DELETE /api/blogs/:id     - Delete blog (requires API key)
 * - GET    /api/health        - Health check
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const method = request.method;

  // Enable CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Route handling
    if (path === 'blogs') {
      if (method === 'GET') {
        return await handleGetBlogs(env);
      } else if (method === 'POST') {
        return await handleCreateBlog(request, env);
      }
    } else if (path.startsWith('blogs/')) {
      const id = path.replace('blogs/', '');
      if (method === 'GET') {
        return await handleGetBlog(id, env);
      } else if (method === 'PUT') {
        return await handleUpdateBlog(id, request, env);
      } else if (method === 'DELETE') {
        return await handleDeleteBlog(id, request, env);
      }
    } else if (path === 'health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

// Helper function to verify API key
async function verifyApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  const validApiKey = env.API_KEY;

  if (!validApiKey) {
    console.warn('Warning: API_KEY environment variable not set');
    return true; // Allow if no API key configured (development mode)
  }

  return apiKey === validApiKey;
}

// GET /api/blogs - List all blogs
async function handleGetBlogs(env) {
  try {
    const kv = env.BLOG_DATA;

    // Get list of blog IDs
    const blogListStr = await kv.get('blog:list');
    const blogList = blogListStr ? JSON.parse(blogListStr) : [];

    // Fetch all blog details
    const blogs = [];
    for (const id of blogList) {
      const blogStr = await kv.get(`blog:${id}`);
      if (blogStr) {
        blogs.push(JSON.parse(blogStr));
      }
    }

    // Sort by date (newest first)
    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    return new Response(JSON.stringify(blogs), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error getting blogs:', error);
    throw error;
  }
}

// GET /api/blogs/:id - Get single blog
async function handleGetBlog(id, env) {
  try {
    const kv = env.BLOG_DATA;
    const blogStr = await kv.get(`blog:${id}`);

    if (!blogStr) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    return new Response(blogStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error getting blog ${id}:`, error);
    throw error;
  }
}

// POST /api/blogs - Create new blog
async function handleCreateBlog(request, env) {
  // Verify API key
  const isValid = await verifyApiKey(request, env);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  try {
    const kv = env.BLOG_DATA;
    const data = await request.json();

    // Validate required fields
    if (!data.title || !data.content) {
      return new Response(JSON.stringify({ error: 'Missing required fields: title and content are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Generate ID if not provided
    const id = data.id || Date.now().toString();

    // Create blog object
    const blog = {
      id,
      title: data.title,
      content: data.content,
      plainText: data.plainText || data.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Get current blog list
    const blogListStr = await kv.get('blog:list');
    const blogList = blogListStr ? JSON.parse(blogListStr) : [];

    // Add new blog ID to list if not already present
    if (!blogList.includes(id)) {
      blogList.push(id);
      await kv.put('blog:list', JSON.stringify(blogList));
    }

    // Save blog to KV
    await kv.put(`blog:${id}`, JSON.stringify(blog));

    return new Response(JSON.stringify(blog), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    throw error;
  }
}

// PUT /api/blogs/:id - Update blog
async function handleUpdateBlog(id, request, env) {
  // Verify API key
  const isValid = await verifyApiKey(request, env);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  try {
    const kv = env.BLOG_DATA;
    const data = await request.json();

    // Check if blog exists
    const existingBlogStr = await kv.get(`blog:${id}`);
    if (!existingBlogStr) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const existingBlog = JSON.parse(existingBlogStr);

    // Update blog fields
    const updatedBlog = {
      ...existingBlog,
      title: data.title !== undefined ? data.title : existingBlog.title,
      content: data.content !== undefined ? data.content : existingBlog.content,
      plainText: data.plainText !== undefined ? data.plainText :
                (data.content ? data.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : existingBlog.plainText),
      date: data.date !== undefined ? data.date : existingBlog.date,
      updatedAt: new Date().toISOString(),
    };

    // Save updated blog
    await kv.put(`blog:${id}`, JSON.stringify(updatedBlog));

    return new Response(JSON.stringify(updatedBlog), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error updating blog ${id}:`, error);
    throw error;
  }
}

// DELETE /api/blogs/:id - Delete blog
async function handleDeleteBlog(id, request, env) {
  // Verify API key
  const isValid = await verifyApiKey(request, env);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  try {
    const kv = env.BLOG_DATA;

    // Remove blog from KV
    await kv.delete(`blog:${id}`);

    // Update blog list
    const blogListStr = await kv.get('blog:list');
    if (blogListStr) {
      const blogList = JSON.parse(blogListStr);
      const updatedList = blogList.filter(blogId => blogId !== id);
      await kv.put('blog:list', JSON.stringify(updatedList));
    }

    return new Response(JSON.stringify({ success: true, message: 'Blog deleted' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error deleting blog ${id}:`, error);
    throw error;
  }
}