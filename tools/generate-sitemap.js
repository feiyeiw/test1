#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://13asrs.com';
const OUTPUT = path.join(ROOT, 'sitemap.xml');

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

const DISALLOWED_PATHS = new Set([
  '/admin.html',
  '/login.html',
  '/blog-detail.html',
]);

const ROOT_PRIORITY = {
  '/': '1.0',
  '/index.html': '1.0',
  '/solutions.html': '0.9',
  '/industries.html': '0.9',
  '/case-studies.html': '0.9',
  '/blog.html': '0.9',
  '/contact.html': '0.9',
  '/asrs-cost.html': '0.8',
  '/asrs-design.html': '0.8',
  '/asrs-landing.html': '0.8',
  '/about.html': '0.7',
};

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function getPublicPath(filePath) {
  const relative = toPosixPath(path.relative(ROOT, filePath));
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.replace(/index\.html$/, '')}`;
  return `/${relative}`;
}

function getLastMod(filePath) {
  return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
}

function getChangeFreq(publicPath) {
  if (publicPath === '/' || publicPath === '/blog.html' || publicPath === '/case-studies.html') {
    return 'weekly';
  }
  if (publicPath.startsWith('/blog/') || publicPath.startsWith('/case/')) {
    return 'weekly';
  }
  return 'monthly';
}

function getPriority(publicPath) {
  if (ROOT_PRIORITY[publicPath]) return ROOT_PRIORITY[publicPath];
  if (publicPath.startsWith('/blog/') || publicPath.startsWith('/case/')) return '0.8';
  if (publicPath.startsWith('/case-')) return '0.7';
  return '0.6';
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char]));
}

function getCanonicalPath(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
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

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), files);
      }
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function generateSitemap() {
  const urlsByPath = new Map();

  for (const filePath of walk(ROOT)) {
    const publicPath = getCanonicalPath(filePath);
    if (!publicPath || DISALLOWED_PATHS.has(publicPath)) continue;
    if (!publicPath.endsWith('/') && !publicPath.endsWith('.html')) continue;

    const existing = urlsByPath.get(publicPath);
    const lastmod = getLastMod(filePath);
    if (!existing || lastmod > existing.lastmod) {
      urlsByPath.set(publicPath, { publicPath, lastmod });
    }
  }

  const urls = [...urlsByPath.values()].sort((a, b) => {
    if (a.publicPath === '/') return -1;
    if (b.publicPath === '/') return 1;
    return a.publicPath.localeCompare(b.publicPath);
  });

  const body = urls.map(({ publicPath, lastmod }) => {
    return [
      '  <url>',
      `    <loc>${escapeXml(SITE_ORIGIN + publicPath)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${getChangeFreq(publicPath)}</changefreq>`,
      `    <priority>${getPriority(publicPath)}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`Generated sitemap.xml with ${urls.length} URLs.`);
}

if (require.main === module) {
  generateSitemap();
}

module.exports = { generateSitemap };
