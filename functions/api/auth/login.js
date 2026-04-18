/**
 * Admin Login Endpoint
 * POST /api/auth/login
 *
 * Validates credentials against Cloudflare Secrets and returns a JWT token.
 */

import { signToken, jsonResponse, unauthorizedResponse } from './_utils.js';

// Admin SHA-256 hash of 'admin123'
// In production, this should be stored as a Cloudflare Secret

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
