/**
 * Global middleware for all API routes
 * Handles legacy public URLs, CORS, and common headers.
 */

const LEGACY_PAGE_TARGETS = new Map([
    ['solutions.html', '/solutions'],
    ['industries.html', '/industries'],
    ['case-studies.html', '/case-studies'],
    ['blog.html', '/blog'],
    ['about.html', '/about'],
    ['contact.html', '/contact'],
    ['services.html', '/solutions'],
    ['insights.html', '/blog'],
    ['asrs-landing.html', '/solutions'],
    ['asrs-cost.html', '/blog/how-much-does-a-complete-asrs-warehouse-system-cost/'],
    ['asrs-design.html', '/blog/asrs-warehouse-design-guide-2026-how-ai-scheduling-systems-improve-1-000-operations-per-hour-efficiency/'],
    ['case-automotive.html', '/case/fully-automated-motor-assembly-line-complete-industrial-case-study/'],
    ['case-ecommerce.html', '/case/4-aisle-mini-load-asrs-warehouse-high-sku-automated-storage-and-goods-to-person-picking-solution/'],
    ['case-miniload.html', '/case/4-aisle-mini-load-asrs-warehouse-high-sku-automated-storage-and-goods-to-person-picking-solution/'],
    ['case-pharma.html', '/case/asrs-warehouse-industry-applications-case-study-how-manufacturing-e-commerce-pharma-food-industries-benefit-from-automated-storage-systems/'],
]);

function getLegacyRoute(pathname) {
    const normalizedPath = pathname.replace(/\/{2,}/g, '/');

    if (/^\/blog-detail(?:\.html)?\/?$/i.test(normalizedPath)) {
        return { status: 410 };
    }

    if (/^\/cases\/?$/i.test(normalizedPath)) {
        return { status: 301, target: '/case-studies' };
    }

    if (/^\/cases\//i.test(normalizedPath) ||
        /^\/archive\/legacy-static-pages\/(?:blog|cases)\//i.test(normalizedPath)) {
        return { status: 410 };
    }

    if (!/^\/(?:blog|case)\//i.test(normalizedPath) || !/\.html\/?$/i.test(normalizedPath)) {
        return null;
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    const fileName = segments.at(-1).toLowerCase();

    if (fileName === 'index.html') {
        return segments.length === 3
            ? { status: 301, target: `/${segments[0]}/${segments[1]}/` }
            : { status: 410 };
    }

    const redirectTarget = LEGACY_PAGE_TARGETS.get(fileName);

    if (redirectTarget) {
        return { status: 301, target: redirectTarget };
    }

    // Current detail pages use /blog/<slug>/ and /case/<slug>/ only. Any
    // remaining .html URL in those namespaces is an obsolete or malformed URL.
    return { status: 410 };
}

function legacyGoneResponse(request) {
    const headers = {
        'Cache-Control': 'public, max-age=86400',
        'Content-Type': 'text/html; charset=UTF-8',
        'X-Robots-Tag': 'noindex, follow',
    };
    const body = request.method === 'HEAD'
        ? null
        : '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Page removed | 13ASRS</title><body><h1>This page is no longer available.</h1><p><a href="/blog">Browse current articles</a> or <a href="/case-studies">view case studies</a>.</p></body></html>';

    return new Response(body, { status: 410, headers });
}

export async function onRequest(context) {
    const { request, next } = context;

    if (request.method === 'GET' || request.method === 'HEAD') {
        const url = new URL(request.url);
        const legacyRoute = getLegacyRoute(url.pathname);

        if (legacyRoute?.target) {
            return Response.redirect(new URL(legacyRoute.target, url.origin).toString(), legacyRoute.status);
        }
        if (legacyRoute?.status === 410) {
            return legacyGoneResponse(request);
        }
    }

    // Set CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Process the request
    const response = await next();

    // Add CORS headers to the response
    for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
    }

    return response;
}
