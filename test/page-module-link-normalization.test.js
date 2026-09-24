const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeLegacyCaseStudiesHref,
  normalizePageModuleLinks,
} = require('../tools/normalize-page-module-links');
const {
  normalizeSnapshot,
  parseArgs,
} = require('../tools/snapshot-page-modules');

const ROOT = path.resolve(__dirname, '..');
const LEGACY_CASE_STUDIES_HREF = /(?:^|["'])\/?case-studies\.html(?:[?#]|["'])/i;

test('normalizes only the legacy Case Studies pathname and preserves query semantics', () => {
  assert.equal(
    normalizeLegacyCaseStudiesHref('case-studies.html?industry=chemical-petrochemical&solution=asrs#caseGrid'),
    '/case-studies?industry=chemical-petrochemical&solution=asrs#caseGrid',
  );
  assert.equal(
    normalizeLegacyCaseStudiesHref('/case-studies.html#caseGrid'),
    '/case-studies#caseGrid',
  );
  assert.equal(
    normalizeLegacyCaseStudiesHref('/case-studies?solution=asrs#caseGrid'),
    '/case-studies?solution=asrs#caseGrid',
  );
  assert.equal(
    normalizeLegacyCaseStudiesHref('https://example.com/case-studies.html?solution=asrs'),
    'https://example.com/case-studies.html?solution=asrs',
  );
});

test('normalizes href and ctaHref recursively without changing unrelated fields', () => {
  const module = {
    href: 'case-studies.html?solution=asrs#caseGrid',
    ctaHref: 'case-studies.html',
    title: 'Unchanged title',
    items: [{ href: '/case-studies.html?industry=food-beverage#caseGrid' }],
  };

  assert.deepEqual(normalizePageModuleLinks(module), {
    href: '/case-studies?solution=asrs#caseGrid',
    ctaHref: '/case-studies',
    title: 'Unchanged title',
    items: [{ href: '/case-studies?industry=food-beverage#caseGrid' }],
  });
  assert.equal(module.href, 'case-studies.html?solution=asrs#caseGrid');
});

test('retires only a pure production-line filter while preserving other query values and fragments', () => {
  assert.equal(
    normalizeLegacyCaseStudiesHref('/case-studies?solution=production-line&application=production-lines#caseGrid'),
    '/case-studies?application=production-lines#caseGrid',
  );
  assert.equal(
    normalizeLegacyCaseStudiesHref('/case-studies?solution=production-line&solution=production-line'),
    '/case-studies',
  );
  assert.equal(
    normalizeLegacyCaseStudiesHref('/case-studies?solution=production-line&solution=asrs#caseGrid'),
    '/case-studies?solution=production-line&solution=asrs#caseGrid',
  );
  assert.equal(
    normalizeLegacyCaseStudiesHref('/case-studies?solution=asrs#caseGrid'),
    '/case-studies?solution=asrs#caseGrid',
  );
});

test('snapshot normalization preserves query and fragment values while normalizing link paths', () => {
  const snapshot = normalizeSnapshot({
    capturedAt: '2026-09-19T00:00:00.000Z',
    baseUrl: 'https://13asrs.com',
    pages: {
      home: [{
        href: 'case-studies.html?image=hero.12345678.webp#caseGrid',
        ctaHref: '/case-studies.html?solution=asrs#caseGrid',
      }],
    },
  });

  assert.deepEqual(snapshot.pages.home, [{
    href: '/case-studies?image=hero.12345678.webp#caseGrid',
    ctaHref: '/case-studies?solution=asrs#caseGrid',
  }]);
});

test('offline snapshot normalization requires an explicit output decision and rejects invalid snapshots', () => {
  assert.throws(
    () => parseArgs(['--input=outputs/page-modules-snapshot.json']),
    /requires --out or --in-place/,
  );
  assert.throws(
    () => parseArgs(['--in-place']),
    /--in-place requires --input/,
  );
  assert.throws(
    () => normalizeSnapshot({ pages: [] }),
    /pages must be an object/,
  );
  assert.throws(
    () => normalizeSnapshot({ pages: { home: [null] } }),
    /module 0 must be an object/,
  );
});

test('default module data and saved snapshot have no legacy Case Studies hrefs', () => {
  for (const relativePath of ['admin.js', 'outputs/page-modules-snapshot.js']) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, LEGACY_CASE_STUDIES_HREF, relativePath);
  }
});

test('default, saved, and runtime module links do not emit the retired production-line filter', () => {
  for (const relativePath of ['admin.js', 'outputs/page-modules-snapshot.js', 'site-upgrade.js']) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /case-studies\?solution=production-line(?:[&#"'])/i, relativePath);
  }
});

test('runtime page-module rendering normalizes CMS module links before rendering', () => {
  const source = fs.readFileSync(path.join(ROOT, 'site-upgrade.js'), 'utf8');
  assert.match(source, /function normalizeLegacyCaseStudiesHref\(/);
  assert.match(
    source,
    /const rawModules = Array\.isArray\(pageData\.modules\) \? pageData\.modules : \[\];\s+const modules = normalizePageModuleLinks\(rawModules\);/,
  );
});

test('baking the saved solutions snapshot keeps the retired production-line filter removed', t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), '13asrs-page-module-bake-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  fs.mkdirSync(path.join(tempRoot, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'outputs'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'solutions.html'), path.join(tempRoot, 'solutions.html'));
  fs.copyFileSync(
    path.join(ROOT, 'tools', 'bake-page-modules.js'),
    path.join(tempRoot, 'tools', 'bake-page-modules.js'),
  );
  fs.copyFileSync(
    path.join(ROOT, 'outputs', 'page-modules-snapshot.js'),
    path.join(tempRoot, 'outputs', 'page-modules-snapshot.js'),
  );

  execFileSync(process.execPath, ['tools/bake-page-modules.js', '--pages=solutions'], {
    cwd: tempRoot,
    stdio: 'pipe',
  });

  const bakedHtml = fs.readFileSync(path.join(tempRoot, 'solutions.html'), 'utf8');
  assert.match(bakedHtml, /href="\/case-studies#caseGrid"/);
  assert.doesNotMatch(bakedHtml, /\/case-studies\?solution=production-line(?:[&#"'])/i);
});
