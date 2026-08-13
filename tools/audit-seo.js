#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://13asrs.com';
const ROOT_PAGES = new Map([
  ['index.html', '/'],
  ['solutions.html', '/solutions'],
  ['industries.html', '/industries'],
  ['case-studies.html', '/case-studies'],
  ['blog.html', '/blog'],
  ['about.html', '/about'],
  ['contact.html', '/contact'],
]);
const ROOT_FILES_BY_PATH = new Map([...ROOT_PAGES].map(([file, publicPath]) => [publicPath, file]));
const TRAILING_CONNECTOR_PATTERN = /\b(?:a|an|and|are|as|at|by|for|from|how|in|is|of|on|or|the|this|to|with|why)\.\.\.$/i;
const LINK_SOURCE_FILES = [
  'site-upgrade.js',
  'tools/bake-case-studies.js',
  'tools/bake-page-modules.js',
  'tools/bake-static-indexes.js',
  'tools/generate-static-post.js',
];

function getDetailPages(directory) {
  const root = path.join(ROOT, directory);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name, 'index.html'))
    .filter(filePath => fs.existsSync(filePath));
}

function decodeHtmlEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1].toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] || match;
  });
}

function getMetaContent(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<meta[^>]+name=["']${escapedName}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapedName}["']`, 'i'));
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

function getMetaProperty(html, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<meta[^>]+property=["']${escapedProperty}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escapedProperty}["']`, 'i'));
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

function getCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return match ? match[1].trim() : '';
}

function getTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : '';
}

function getInternalHtmlLinks(html) {
  const links = [];
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    if (!href || /^(?:https?:\/\/|\/\/|mailto:|tel:|data:|javascript:|#)/i.test(href)) continue;
    if (/\.html(?:[?#]|$)/i.test(href)) links.push(href);
  }
  return links;
}

function getInternalPageLinks(html, canonicalPath) {
  const links = [];
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = decodeHtmlEntities(match[1].trim());
    if (!href || href.startsWith('#') || /^(?:mailto:|tel:|data:|javascript:|blob:)/i.test(href)) continue;

    let url;
    try {
      url = new URL(href, `${SITE_ORIGIN}${canonicalPath}`);
    } catch {
      continue;
    }
    if (url.origin !== SITE_ORIGIN) continue;

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      pathname = url.pathname;
    }
    const extension = path.posix.extname(pathname).toLowerCase();
    if (extension && extension !== '.html') continue;
    links.push({ href, pathname });
  }
  return links;
}

function getLocalPageTarget(pathname) {
  const rootFile = ROOT_FILES_BY_PATH.get(pathname);
  if (rootFile) return path.join(ROOT, rootFile);

  const relativePath = pathname.replace(/^\/+/, '');
  const directoryTarget = path.resolve(ROOT, relativePath, 'index.html');
  if (!path.extname(pathname) && fs.existsSync(directoryTarget)) return directoryTarget;

  const target = path.resolve(ROOT, path.extname(pathname) ? relativePath : `${relativePath}.html`);
  const rootPrefix = `${ROOT}${path.sep}`.toLowerCase();
  return target.toLowerCase().startsWith(rootPrefix) ? target : '';
}

function registerUniqueValue(owners, value, label, relative, errors) {
  if (!value) return;
  const normalized = value.toLowerCase();
  const existing = owners.get(normalized);
  if (existing) {
    errors.push(`${relative}: duplicate ${label} also used by ${existing}`);
    return;
  }
  owners.set(normalized, relative);
}

function expectedCanonicalPath(filePath) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (ROOT_PAGES.has(relative)) return ROOT_PAGES.get(relative);
  return `/${relative.replace(/index\.html$/i, '')}`;
}

function readJsonLd(html, filePath, errors) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) {
    errors.push(`${path.relative(ROOT, filePath)}: missing JSON-LD`);
    return '';
  }
  for (const script of scripts) {
    try {
      JSON.parse(script[1]);
    } catch (error) {
      errors.push(`${path.relative(ROOT, filePath)}: invalid JSON-LD (${error.message})`);
    }
  }
  return scripts.map(script => script[1]).join('\n');
}

function main() {
  const publicFiles = [
    ...[...ROOT_PAGES.keys()].map(file => path.join(ROOT, file)),
    ...getDetailPages('blog'),
    ...getDetailPages('case'),
  ];
  const errors = [];
  const canonicalUrls = new Set();
  const detailCanonicalUrls = new Set();
  const titleOwners = new Map();
  const descriptionOwners = new Map();

  for (const filePath of publicFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const title = getTitle(html);
    const description = getMetaContent(html, 'description');
    const expectedCanonical = `${SITE_ORIGIN}${expectedCanonicalPath(filePath)}`;
    const canonical = getCanonical(html);

    if (!title) errors.push(`${relative}: missing title`);
    if (title.length > 65) errors.push(`${relative}: title is ${title.length} characters`);
    if (!description) errors.push(`${relative}: missing meta description`);
    if (description.length > 160) errors.push(`${relative}: meta description is ${description.length} characters`);
    if (canonical !== expectedCanonical) errors.push(`${relative}: canonical should be ${expectedCanonical}, found ${canonical || 'none'}`);
    for (const href of getInternalHtmlLinks(html)) errors.push(`${relative}: redirecting internal link ${href}`);
    for (const link of getInternalPageLinks(html, expectedCanonicalPath(filePath))) {
      if (/\.html$/i.test(link.pathname)) errors.push(`${relative}: redirecting internal link ${link.href}`);
      const target = getLocalPageTarget(link.pathname);
      if (target && !fs.existsSync(target)) errors.push(`${relative}: broken internal page link ${link.href}`);
    }
    if (/<h2[^>]*>\s*SEO (?:Title|Description|Keywords)\s*<\/h2>/i.test(html)) {
      errors.push(`${relative}: SEO metadata is rendered as visible article content`);
    }
    registerUniqueValue(titleOwners, title, 'title', relative, errors);
    registerUniqueValue(descriptionOwners, description, 'meta description', relative, errors);

    const isDetailPage = relative.startsWith('blog/') || relative.startsWith('case/');
    if (relative === 'index.html' || isDetailPage) {
      const schema = readJsonLd(html, filePath, errors);
      if (relative.startsWith('blog/') && !schema.includes('BlogPosting')) errors.push(`${relative}: missing BlogPosting schema`);
      if (relative.startsWith('case/') && !schema.includes('Article')) errors.push(`${relative}: missing Article schema`);
      if (isDetailPage && !schema.includes('BreadcrumbList')) errors.push(`${relative}: missing BreadcrumbList schema`);
    }
    if (isDetailPage) {
      if (TRAILING_CONNECTOR_PATTERN.test(title)) errors.push(`${relative}: truncated title ends with a connector`);
      if (!/(?:\.\.\.|[.!?])$/.test(description)) errors.push(`${relative}: meta description has no clear ending`);
      if (getMetaProperty(html, 'og:title') !== title) errors.push(`${relative}: og:title does not match title`);
      if (getMetaProperty(html, 'og:description') !== description) errors.push(`${relative}: og:description does not match meta description`);
      if (getMetaProperty(html, 'og:url') !== canonical) errors.push(`${relative}: og:url does not match canonical`);
      if (!getMetaContent(html, 'twitter:card')) errors.push(`${relative}: missing Twitter card metadata`);
      detailCanonicalUrls.add(expectedCanonical);
    }
    canonicalUrls.add(expectedCanonical);
  }

  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
  for (const url of canonicalUrls) {
    if (!sitemapUrls.has(url)) errors.push(`sitemap.xml: missing ${url}`);
  }
  for (const url of sitemapUrls) {
    if (!canonicalUrls.has(url)) errors.push(`sitemap.xml: unexpected ${url}`);
    if (/\.html$/.test(url)) errors.push(`sitemap.xml: redirecting URL ${url}`);
  }

  const rss = fs.readFileSync(path.join(ROOT, 'rss.xml'), 'utf8');
  const rssItemCount = (rss.match(/<item>/g) || []).length;
  const rssItems = [...rss.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/g)];
  const rssUrls = new Set(rssItems.map(match => decodeHtmlEntities(match[1].trim())));
  if (rssItems.length !== rssItemCount) errors.push('rss.xml: malformed item markup');
  for (const url of detailCanonicalUrls) {
    if (!rssUrls.has(url)) errors.push(`rss.xml: missing ${url}`);
  }
  for (const url of rssUrls) {
    if (!detailCanonicalUrls.has(url)) errors.push(`rss.xml: unexpected ${url}`);
    if (/\.html$/.test(url)) errors.push(`rss.xml: redirecting URL ${url}`);
  }

  for (const file of ['admin.html', 'login.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!/name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) errors.push(`${file}: missing noindex`);
  }

  for (const file of LINK_SOURCE_FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const href of getInternalHtmlLinks(source)) {
      errors.push(`${file}: redirecting generated internal link ${href}`);
    }
  }

  if (errors.length) {
    console.error(`SEO audit failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`SEO audit passed: ${publicFiles.length} public pages, ${sitemapUrls.size} sitemap URLs.`);
}

main();
