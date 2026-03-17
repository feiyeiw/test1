/**
 * Global middleware for Cloudflare Pages Functions
 * - Adds CORS headers
 * - Handles OPTIONS preflight requests
 * - Logs requests (optional)
 */

export async function onRequest(context) {
    const { request, next } = context;

    // Set CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Accept',
        'Access-Control-Max-Age': '86400' // 24 hours
    };

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Log request (optional, remove in production if not needed)
    console.log(`${new Date().toISOString()} - ${request.method} ${request.url}`);

    try {
        // Call the next handler
        const response = await next();

        // Add CORS headers to the response
        for (const [key, value] of Object.entries(corsHeaders)) {
            response.headers.set(key, value);
        }

        // Add security headers
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        return response;
    } catch (error) {
        console.error('Error in middleware:', error);

        // Return error response with CORS headers
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}