/**
 * Token Verification Endpoint
 * POST /api/auth/verify
 *
 * Validates a JWT token and returns the decoded payload.
 * Useful for checking session validity from the frontend.
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

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function unauthorizedResponse(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
// ====== End JWT Utilities ======

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const token = body.token || extractBearerToken(request);
        if (!token) {
            return unauthorizedResponse('Token is required');
        }

        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET not configured');
            return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        const payload = await verifyToken(token, jwtSecret);
        if (!payload) {
            return unauthorizedResponse('Invalid or expired token');
        }

        return jsonResponse({
            valid: true,
            payload: {
                sub: payload.sub,
                role: payload.role,
                exp: payload.exp,
                iat: payload.iat,
            },
        });

    } catch (error) {
        console.error('Token verification error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

// Also support GET for simple health/verify checks
export async function onRequestGet(context) {
    const { request, env } = context;

    const token = extractBearerToken(request);
    if (!token) {
        return unauthorizedResponse('Authorization header required');
    }

    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
        return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const payload = await verifyToken(token, jwtSecret);
    if (!payload) {
        return unauthorizedResponse('Invalid or expired token');
    }

    return jsonResponse({ valid: true, sub: payload.sub });
}
