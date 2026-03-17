/**
 * Health check endpoint
 * GET /api/health - Returns API status
 */

export async function onRequest(context) {
    const { env } = context;

    try {
        // Check if KV is available
        const kv = env.BLOG_DATA;
        const kvStatus = kv ? 'available' : 'not available';

        return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                kv: kvStatus
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        console.error('Health check error:', error);
        return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    }
}