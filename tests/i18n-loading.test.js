const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');
const translationFiles = new Map(
    fs.readdirSync(root)
        .filter(name => /^translations-[a-z0-9-]+\.json$/i.test(name))
        .map(name => [name, JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))])
);

function createHarness(pathname, overrides = {}) {
    const files = new Map(translationFiles);
    for (const [name, contents] of Object.entries(overrides)) {
        if (contents === null) files.delete(name);
        else files.set(name, contents);
    }

    const requests = [];
    const errors = [];
    const warnings = [];
    const storage = {};
    const navLink = {
        dataset: { i18n: 'common.nav_contact' },
        textContent: 'Contact',
        classList: { add() {} }
    };
    const languageSelect = { value: 'en' };
    const document = {
        body: {},
        documentElement: { lang: 'en' },
        createTreeWalker() {
            return { nextNode: () => null };
        },
        getElementById() {
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '#lang-select') return [languageSelect];
            if (selector === '[data-i18n]') return [navLink];
            return [];
        }
    };

    const context = vm.createContext({
        URL,
        NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
        document,
        getNestedValue(object, key) {
            return key.split('.').reduce((value, part) => value?.[part], object);
        },
        localStorage: {
            getItem(key) { return storage[key] || null; },
            setItem(key, value) { storage[key] = value; }
        },
        window: { location: { origin: 'https://site.test', pathname } },
        fetch: async input => {
            const request = String(input);
            requests.push(request);
            const resolved = new URL(request, 'https://site.test/');
            const filename = decodeURIComponent(resolved.pathname.slice(1));
            if (!files.has(filename)) return { ok: false, status: 404 };
            const contents = files.get(filename);
            return {
                ok: true,
                status: 200,
                json: async () => JSON.parse(JSON.stringify(contents))
            };
        },
        console: {
            error(...args) { errors.push(args.map(String).join(' ')); },
            warn(...args) { warnings.push(args.map(String).join(' ')); },
            info() {}
        }
    });

    vm.runInContext(source, context, { filename: 'i18n.js' });
    return {
        context,
        document,
        errors,
        languageSelect,
        navLink,
        requests,
        storage,
        warnings,
        pageKey() { return vm.runInContext('getCurrentPageKey()', context); },
        loadTranslations() { return vm.runInContext('loadTranslations()', context); },
        switchLanguage(language) {
            return vm.runInContext(`switchLanguage(${JSON.stringify(language)})`, context);
        },
        evaluate(expression) { return vm.runInContext(expression, context); }
    };
}

test('recognizes root clean and .html routes without treating nested article indexes as home', () => {
    const harness = createHarness('/');
    assert.equal(harness.pageKey(), 'index');

    harness.context.window.location.pathname = '/index.html';
    assert.equal(harness.pageKey(), 'index');
    harness.context.window.location.pathname = '/asrs-cost';
    assert.equal(harness.pageKey(), 'asrs_cost');
    harness.context.window.location.pathname = '/asrs-cost.html';
    assert.equal(harness.pageKey(), 'asrs_cost');
    harness.context.window.location.pathname = '/blog/example-article/';
    assert.equal(harness.pageKey(), null);
    harness.context.window.location.pathname = '/case/example-article/index.html';
    assert.equal(harness.pageKey(), null);
});

test('loads shared translations from the origin root on nested articles only', async () => {
    const harness = createHarness('/blog/example-article/');
    await harness.loadTranslations();

    assert.deepEqual(harness.requests, ['https://site.test/translations-common.json']);
    assert.equal(
        harness.evaluate('translations.zh.common.nav_contact'),
        translationFiles.get('translations-common.json').zh.nav_contact
    );
});

test('cost clean and .html URLs use the same page key and skip an unlisted optional dictionary', async () => {
    for (const pathname of ['/asrs-cost', '/asrs-cost.html']) {
        const harness = createHarness(pathname);
        await harness.loadTranslations();

        assert.equal(harness.pageKey(), 'asrs_cost');
        assert.deepEqual(harness.requests, [
            'https://site.test/translations-common.json',
            'https://site.test/translations-manifest.json'
        ]);
        assert.equal(harness.errors.length, 0);
    }
});

test('existing page dictionaries continue to load through the manifest', async () => {
    const harness = createHarness('/case-studies.html');
    await harness.loadTranslations();

    assert.deepEqual(harness.requests, [
        'https://site.test/translations-common.json',
        'https://site.test/translations-manifest.json',
        'https://site.test/translations-case-studies.json'
    ]);
    assert.ok(harness.evaluate('Object.keys(translations.zh.case_studies).length') > 0);
});

test('missing configured page dictionaries preserve shared navigation and English fallback', async () => {
    const harness = createHarness('/about', {
        'translations-manifest.json': { about: 'translations-about-missing' }
    });
    await harness.loadTranslations();

    assert.deepEqual(harness.requests, [
        'https://site.test/translations-common.json',
        'https://site.test/translations-manifest.json',
        'https://site.test/translations-about-missing.json'
    ]);
    assert.equal(harness.errors.length, 0);
    assert.equal(harness.warnings.length, 1);
    assert.equal(
        harness.evaluate('translations.zh.common.nav_contact'),
        translationFiles.get('translations-common.json').zh.nav_contact
    );
    assert.equal(harness.evaluate("translateRuntimeText('English-only paragraph','zh')"), 'English-only paragraph');

    harness.switchLanguage('zh');
    assert.equal(harness.navLink.textContent, translationFiles.get('translations-common.json').zh.nav_contact);
    assert.equal(harness.languageSelect.value, 'zh');
    assert.equal(harness.document.documentElement.lang, 'zh');
    assert.equal(harness.storage.siteLanguage, 'zh');
});
