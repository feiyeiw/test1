/**
 * Token Verification Endpoint
 * POST /api/auth/verify
 *
 * Validates a JWT token and returns the decoded payload.
 * Useful for checking session validity from the frontend.
 */

import { verifyToken, extractBearerToken, jsonResponse, unauthorizedResponse } from './_utils.js';

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
