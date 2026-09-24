const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const INTERNAL_ORIGIN = 'https://13asrs.invalid';
const INTERNAL_HOSTS = new Set(['13asrs.com', 'www.13asrs.com']);

function decodeHtmlAttribute(value) {
  return value
    .replace(/&#(x[\da-f]+|\d+);?/gi, (entity, code) => {
      const codePoint = code[0].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    })
    .replace(/&([a-z]+);/gi, (entity, name) => ({
      amp: '&',
      apos: "'",
      colon: ':',
      equals: '=',
      gt: '>',
      lt: '<',
      num: '#',
      period: '.',
      quest: '?',
      quot: '"',
      sol: '/',
    }[name.toLowerCase()] || entity));
}

function listHtmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(entryPath);
    }
  }
  return files;
}

function listPublicSourceHtml() {
  const rootHtml = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map(entry => path.join(ROOT, entry.name));
  return [
    ...rootHtml,
    ...listHtmlFiles(path.join(ROOT, 'blog')),
    ...listHtmlFiles(path.join(ROOT, 'case')),
  ];
}

function findRetiredProductionLineLinks(html, relativePath) {
  const retired = [];
  const anchorPattern = /<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  let anchorMatch;
  while ((anchorMatch = anchorPattern.exec(html))) {
    const hrefMatch = anchorMatch[1].match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    if (!hrefMatch) continue;

    const href = decodeHtmlAttribute(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]);
    let url;
    try {
      const basePath = `/${relativePath.split(path.sep).join('/')}`;
      url = new URL(href, `${INTERNAL_ORIGIN}${basePath}`);
    } catch {
      continue;
    }

    const isInternal = url.origin === INTERNAL_ORIGIN
      || (['http:', 'https:'].includes(url.protocol) && INTERNAL_HOSTS.has(url.hostname.toLowerCase()));
    if (!isInternal || !/^\/case-studies(?:\.html)?$/i.test(url.pathname)) continue;
    const solutions = url.searchParams.getAll('solution');
    if (solutions.length > 0 && solutions.every(value => value === 'production-line')) {
      retired.push({ href, line: html.slice(0, anchorMatch.index).split('\n').length });
    }
  }
  return retired;
}

function scanFiles(files, baseDirectory) {
  const findings = [];
  for (const file of files) {
    const relativePath = path.relative(baseDirectory, file);
    const html = fs.readFileSync(file, 'utf8');
    for (const finding of findRetiredProductionLineLinks(html, relativePath)) {
      findings.push(`${relativePath}:${finding.line} ${finding.href}`);
    }
  }
  return findings;
}

test('static-link scan flags only case links whose solution values are all production-line', () => {
  const html = [
    '<a href="/case-studies?solution=production-line#caseGrid">retired</a>',
    '<a href="/case-studies?application=production-lines&amp;solution=production-line#caseGrid">retired with preserved query</a>',
    '<a href="/case-studies?solution=production&#45;line#caseGrid">numeric reference decodes to retired value</a>',
    '<a href="https://13asrs.com/case-studies?solution=production-line#caseGrid">absolute internal URL</a>',
    '<a data-href="/case-studies?solution=production-line" href="/case-studies?solution=asrs#caseGrid">data-href is not the href attribute</a>',
    '<a href="/case-studies?solution=production-line&amp;solution=asrs#caseGrid">mixed values stay</a>',
    '<a href="/case-studies?application=production-lines#caseGrid">unrelated filter stays</a>',
  ].join('\n');

  assert.deepEqual(findRetiredProductionLineLinks(html, 'solutions.html').map(item => item.href), [
    '/case-studies?solution=production-line#caseGrid',
    '/case-studies?application=production-lines&solution=production-line#caseGrid',
    '/case-studies?solution=production-line#caseGrid',
    'https://13asrs.com/case-studies?solution=production-line#caseGrid',
  ]);
});

test('public source HTML has no retired production-line case-study links', () => {
  const files = listPublicSourceHtml();
  assert.ok(files.length > 0, 'expected to find public source HTML');
  assert.deepEqual(scanFiles(files, ROOT), [], 'retired links in source HTML');
});

test('built dist HTML has no retired production-line case-study links', t => {
  if (!fs.existsSync(DIST)) {
    t.skip('run the build first to scan the actual dist output');
    return;
  }

  const files = listHtmlFiles(DIST);
  assert.ok(files.length > 0, 'expected to find HTML in dist');
  assert.deepEqual(scanFiles(files, DIST), [], 'retired links in dist HTML');
});
