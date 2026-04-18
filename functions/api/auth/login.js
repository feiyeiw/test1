/**
 * Admin Login Endpoint
 * POST /api/auth/login
 *
 * Validates credentials against Cloudflare Secrets and returns a JWT token.
 */

// ====== JWT Utilities (inlined for Cloudflare Pages Functions compatibility) ======
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

function base64UrlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importJwtSecret(secret) {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey('raw', encoder.encode(secret), ALGORITHM, false, ['sign', 'verify']);
}

async function hmacSign(key, data) {
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(ALGORITHM, key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signToken(payload, secret, expiresInHours = 24) {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now, exp: now + expiresInHours * 3600 };
    const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await importJwtSecret(secret);
    const signature = await hmacSign(key, signingInput);
    return `${signingInput}.${signature}`;
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function unauthorizedResponse(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
// ====== End JWT Utilities ======

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { username, password } = body;
        if (!username || !password) {
            return jsonResponse({ error: 'Username and password are required' }, 400);
        }

        // Read admin credentials from Cloudflare Secrets (env variables)
        const expectedUsername = env.ADMIN_USERNAME;
        const expectedPasswordHash = env.ADMIN_PASSWORD_HASH;
        const jwtSecret = env.JWT_SECRET;

        if (!expectedUsername || !expectedPasswordHash || !jwtSecret) {
            console.error('Missing admin credentials or JWT_SECRET in environment');
            return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        // Validate username
        if (username !== expectedUsername) {
            return unauthorizedResponse('Invalid username or password');
        }

        // Validate password (hash and compare)
        const passwordHash = await hashPassword(password);
        if (passwordHash !== expectedPasswordHash) {
            return unauthorizedResponse('Invalid username or password');
        }

        // Generate JWT token (24h expiry)
        const token = await signToken({ sub: username, role: 'admin' }, jwtSecret, 24);

        return jsonResponse({
            success: true,
            token,
            expiresIn: 86400, // seconds
        });

    } catch (error) {
        console.error('Login error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}
