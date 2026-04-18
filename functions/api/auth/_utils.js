/**
 * JWT Utilities for Cloudflare Workers
 * Pure Web Crypto API implementation, zero external dependencies
 */

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

/**
 * Encode string to Base64URL (JWT safe)
 */
function base64UrlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode Base64URL string
 */
function base64UrlDecode(str) {
    str += new Array(5 - (str.length % 4)).join('=');
    str = str.replace(/\-/g, '+').replace(/\_/g, '/');
    const bytes = atob(str).split('').map(c => c.charCodeAt(0));
    return new Uint8Array(bytes);
}

/**
 * Import raw key bytes for Web Crypto
 */
async function importJwtSecret(secret) {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        ALGORITHM,
        false,
        ['sign', 'verify']
    );
}

/**
 * Sign data with HMAC-SHA256
 */
async function hmacSign(key, data) {
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(ALGORITHM, key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Generate a JWT token
 * @param {object} payload - JWT payload
 * @param {string} secret - JWT secret
 * @param {number} expiresInHours - Token expiry in hours (default: 24)
 */
export async function signToken(payload, secret, expiresInHours = 24) {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + expiresInHours * 3600,
    };

    const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await importJwtSecret(secret);
    const signature = await hmacSign(key, signingInput);

    return `${signingInput}.${signature}`;
}

/**
 * Verify a JWT token
 * @param {string} token - JWT string
 * @param {string} secret - JWT secret
 * @returns {object|null} Decoded payload or null if invalid
 */
export async function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;

        // Verify signature
        const signingInput = `${headerB64}.${payloadB64}`;
        const key = await importJwtSecret(secret);
        const encoder = new TextEncoder();
        const expectedSig = base64UrlDecode(signatureB64);
        const isValid = await crypto.subtle.verify(
            ALGORITHM,
            key,
            expectedSig,
            encoder.encode(signingInput)
        );
        if (!isValid) return null;

        // Decode and validate payload
        const payloadBytes = base64UrlDecode(payloadB64);
        const payloadStr = new TextDecoder().decode(payloadBytes);
        const payload = JSON.parse(payloadStr);

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) return null;
        if (payload.nbf && payload.nbf > now) return null;

        return payload;
    } catch (error) {
        console.error('JWT verification error:', error);
        return null;
    }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request) {
    const auth = request.headers.get('Authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}

/**
 * Standardized error response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Standardized success response
 */
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
