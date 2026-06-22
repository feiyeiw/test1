#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://13asrs.com';
const OUTPUT = path.join(ROOT, 'rss.xml');
const FEED_TITLE = '13ASRS Blog, Case Studies & News';
const FEED_DESCRIPTION = 'Latest industrial automation blog posts, case studies, and news from 13ASRS.';

const SKIP_DIRS = new Set([
  '.git',
  '.claude',
  '.codex',
  '.agents',
  '.vs',
  'archive',
  'dist',
  'node_modules',
  'outputs',
  'tools',
  'functions',
  'content',
]);

const FEED_PATH_PREFIXES = ['/blog/', '/case/', '/news/'];

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function getPublicPath(filePath) {
  const relative = toPosixPath(path.relative(ROOT, filePath));
  if (relative.endsWith('/index.html')) return `/${relative.replace(/index\.html$/, '')}`;
  return `/${relative}`;
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char]));
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function getCanonicalPath(filePath, html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (!match) return getPublicPath(filePath);

  try {
    const url = new URL(match[1], SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN) return '';
    return url.pathname;
  } catch {
    return getPublicPath(filePath);
  }
}

function getMetaContent(html, name) {
  const pattern = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i');
  const match = html.match(pattern) || html.match(reversePattern);
  return match ? decodeHtmlEntities(match[1]) : '';
}

function getTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeHtmlEntities(stripHtml(h1[1]));
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? decodeHtmlEntities(stripHtml(title[1])) : '13ASRS Update';
}

function getPubDate(filePath, html) {
  const dateMatch = html.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const date = dateMatch ? new Date(`${dateMatch[1]}T00:00:00Z`) : fs.statSync(filePath).mtime;
  return Number.isNaN(date.getTime()) ? fs.statSync(filePath).mtime : date;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), files);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function isFeedPath(publicPath) {
  return FEED_PATH_PREFIXES.some(prefix => publicPath.startsWith(prefix));
}

function generateRss() {
  const itemsByUrl = new Map();

  for (const filePath of walk(ROOT)) {
    const html = fs.readFileSync(filePath, 'utf8');
    const publicPath = getCanonicalPath(filePath, html);
    if (!publicPath || !isFeedPath(publicPath)) continue;

    const loc = SITE_ORIGIN + publicPath;
    const pubDate = getPubDate(filePath, html);
    const description = getMetaContent(html, 'description') || stripHtml(html).slice(0, 240);
    const item = {
      loc,
      title: getTitle(html),
      description,
      pubDate,
    };

    const existing = itemsByUrl.get(loc);
    if (!existing || item.pubDate > existing.pubDate) {
      itemsByUrl.set(loc, item);
    }
  }

  const items = [...itemsByUrl.values()]
    .sort((a, b) => b.pubDate - a.pubDate || a.loc.localeCompare(b.loc));

  const itemXml = items.map(item => [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.loc)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(item.loc)}</guid>`,
    `      <description>${escapeXml(item.description)}</description>`,
    `      <pubDate>${item.pubDate.toUTCString()}</pubDate>`,
    '    </item>',
  ].join('\n')).join('\n');

  const now = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${escapeXml(FEED_TITLE)}</title>\n    <link>${escapeXml(SITE_ORIGIN + '/')}</link>\n    <description>${escapeXml(FEED_DESCRIPTION)}</description>\n    <language>en</language>\n    <lastBuildDate>${now}</lastBuildDate>\n    <atom:link href="${escapeXml(SITE_ORIGIN + '/rss.xml')}" rel="self" type="application/rss+xml" />\n${itemXml}\n  </channel>\n</rss>\n`;
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`Generated rss.xml with ${items.length} item(s).`);
}

if (require.main === module) {
  generateRss();
}

module.exports = { generateRss };
