const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const middlewarePath = path.join(root, 'functions', '_middleware.js');
const redirectsPath = path.join(root, '_redirects');

const mappedLegacyDetails = [
    {
        id: '1780748944138-9969945d-3a42-4cac-a742-f5ecf7d5e663',
        target: '/blog/how-to-build-an-automated-cold-storage-warehouse-shuttle-asrs-cold-warehouse-project-guide/',
    },
    {
        id: '1780980827480-3a6029a1-6d64-445d-9e4e-0a37fe6bc0de',
        target: '/case/how-does-a-42-stacker-crane-asrs-warehouse-work-large-scale-automated-storage-and-retrieva/',
    },
    {
        id: '1780981364211-727b393d-6e6d-442d-b9c5-d7daac6b8224',
        target: '/case/cold-storage-asrs-upgrade-case-study-7-000-pallet-positions-at-25-c-automated-warehouse/',
    },
    {
        id: '1780988234958-85965296-5cfc-4fe2-9911-e3033ade26ba',
        target: '/case/tomato-paste-canned-tomato-production-line-fully-automated-food-processing-filling-packaging-asrs-system/',
    },
];

function loadMiddleware() {
    const source = fs.readFileSync(middlewarePath, 'utf8')
        .replace('export async function onRequest', 'async function onRequest')
        .concat('\nglobalThis.__legacyRoutingTest = { getLegacyRoute, onRequest };');
    const context = { URL, URLSearchParams, Response, Map, Object };
    vm.runInNewContext(source, context, { filename: '_middleware.js' });
    return context.__legacyRoutingTest;
}

async function requestRoute(pathnameAndSearch, method = 'GET') {
    const { onRequest } = loadMiddleware();
    return onRequest({
        request: new Request(`https://13asrs.com${pathnameAndSearch}`, { method }),
        next: async () => new Response('ok', { status: 200 }),
    });
}

test('redirects every approved legacy blog-detail ID from both old path variants', async () => {
    for (const { id, target } of mappedLegacyDetails) {
        for (const legacyPath of ['/blog-detail', '/blog-detail.html']) {
            const response = await requestRoute(`${legacyPath}?id=${id}`);

            assert.equal(response.status, 301, `${legacyPath} should redirect ${id}`);
            assert.equal(response.headers.get('location'), `https://13asrs.com${target}`);
        }
    }
});

test('keeps empty and unknown legacy blog-detail IDs gone', async () => {
    for (const legacyPath of [
        '/blog-detail',
        '/blog-detail.html?id=unknown-id',
    ]) {
        const response = await requestRoute(legacyPath);

        assert.equal(response.status, 410, `${legacyPath} must not receive a guessed redirect`);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    }

    const mappedId = mappedLegacyDetails[0].id;
    for (const legacyPath of [
        `/blog-detail?id=${mappedId}&id=unknown-id`,
        `/blog-detail?id=unknown-id&id=${mappedId}`,
    ]) {
        const response = await requestRoute(legacyPath);

        assert.equal(response.status, 410, `${legacyPath} must not partially match a repeated ID parameter`);
    }
});

test('keeps approved index.html normalization and current pages available', async () => {
    const indexResponse = await requestRoute('/case/fully-automated-motor-assembly-line-complete-industrial-case-study/index.html');
    assert.equal(indexResponse.status, 301);
    assert.equal(indexResponse.headers.get('location'), 'https://13asrs.com/case/fully-automated-motor-assembly-line-complete-industrial-case-study/');

    const currentResponse = await requestRoute('/case-studies?function=warehouse-automation');
    assert.equal(currentResponse.status, 200);
    assert.equal(currentResponse.headers.get('access-control-allow-origin'), '*');
});

test('retires only the unsupported production-line solution parameter', async () => {
    const legacyOnly = await requestRoute('/case-studies?solution=production-line');
    assert.equal(legacyOnly.status, 301);
    assert.equal(legacyOnly.headers.get('location'), 'https://13asrs.com/case-studies');

    const combined = await requestRoute('/case-studies.html?solution=production-line&application=production-lines');
    assert.equal(combined.status, 301);
    assert.equal(combined.headers.get('location'), 'https://13asrs.com/case-studies?application=production-lines');

    const repeatedLegacy = await requestRoute('/case-studies?solution=production-line&solution=production-line', 'HEAD');
    assert.equal(repeatedLegacy.status, 301);
    assert.equal(repeatedLegacy.headers.get('location'), 'https://13asrs.com/case-studies');

    const ambiguousSolutions = await requestRoute('/case-studies?solution=production-line&solution=asrs');
    assert.equal(ambiguousSolutions.status, 200);

    const unknownSolution = await requestRoute('/case-studies?solution=asrs');
    assert.equal(unknownSolution.status, 200);
});

test('serves asrs-cost directly and redirects its .html compatibility path in both route layers', async () => {
    const redirects = fs.readFileSync(redirectsPath, 'utf8');
    const middleware = fs.readFileSync(middlewarePath, 'utf8');

    assert.ok(fs.existsSync(path.join(root, 'asrs-cost.html')), 'the standalone cost landing page must exist');
    assert.doesNotMatch(redirects, /^\/asrs-cost\s/m, 'the clean cost URL must not redirect away');
    assert.match(redirects, /^\/asrs-cost\.html\s+\/asrs-cost\s+301$/m);
    assert.match(middleware, /\['asrs-cost\.html', '\/asrs-cost'\]/);

    const cleanResponse = await requestRoute('/asrs-cost');
    assert.equal(cleanResponse.status, 200);

    const compatibilityResponse = await requestRoute('/asrs-cost.html');
    assert.equal(compatibilityResponse.status, 301);
    assert.equal(compatibilityResponse.headers.get('location'), 'https://13asrs.com/asrs-cost');
});

test('retains the reviewed Mini Load redirect targets', () => {
    const redirects = fs.readFileSync(redirectsPath, 'utf8');
    const target = '/case/4-aisle-mini-load-asrs-warehouse-high-sku-automated-storage-and-goods-to-person-picking-solution/';

    assert.match(redirects, new RegExp(`^/case-miniload\\s+${target.replace(/[./-]/g, '\\$&')}\\s+301$`, 'm'));
    assert.match(redirects, new RegExp(`^/case-miniload\\.html\\s+${target.replace(/[./-]/g, '\\$&')}\\s+301$`, 'm'));
});
