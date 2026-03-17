/**
 * Health check endpoint
 *
 * GET /api/health - Returns service status
 */

export async function onRequest(context) {
    const { request } = context;

    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Only allow GET method
    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }

    try {
        // Check if KV is available
        const kv = context.env.BLOG_DATA;
        const kvStatus = kv ? 'available' : 'not available';

        const healthInfo = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'blog-api',
            version: '1.0.0',
            kv: kvStatus,
            endpoints: {
                blogs: '/api/blogs',
                health: '/api/health'
            }
        };

        return new Response(JSON.stringify(healthInfo), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (error) {
        console.error('Error in health check:', error);

        return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}