#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizePageModuleLinks } = require('./normalize-page-module-links');

const DEFAULT_PAGES = ['home', 'solutions', 'industries', 'case-studies', 'blog', 'about', 'contact'];
const DYNAMIC_VARIANTS = new Set(['latest-blog', 'blog-index', 'case-library', 'contact-form']);

function parseArgs(argv) {
  const options = {
    base: 'https://13asrs.com',
    input: '',
    inPlace: false,
    out: '',
    pages: DEFAULT_PAGES,
    format: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length).replace(/\/+$/, '');
    } else if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--in-place') {
      options.inPlace = true;
    } else if (arg.startsWith('--pages=')) {
      options.pages = arg.slice('--pages='.length).split(',').map(page => page.trim()).filter(Boolean);
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (options.format && !['js', 'json'].includes(options.format)) {
    throw new Error('--format must be js or json');
  }

  if (options.input && !options.out && !options.inPlace) {
    throw new Error('--input requires --out or --in-place');
  }
  if (options.out && options.inPlace) {
    throw new Error('--out and --in-place cannot be used together');
  }
  if (options.inPlace && !options.input) {
    throw new Error('--in-place requires --input');
  }

  if (options.inPlace) {
    options.out = options.input;
  } else if (!options.out) {
    options.out = path.join('outputs', 'page-modules-snapshot.js');
  }

  if (!options.format) {
    options.format = path.extname(options.out).toLowerCase() === '.json' ? 'json' : 'js';
  }

  const outputExtension = path.extname(options.out).toLowerCase();
  if ((outputExtension === '.json' && options.format !== 'json') ||
      (outputExtension === '.js' && options.format !== 'js')) {
    throw new Error('--format must match the --out file extension');
  }

  return options;
}

function printHelp() {
  console.log(`
Snapshot Cloudflare KV page modules through the public Pages API.

Usage:
  node tools/snapshot-page-modules.js
  node tools/snapshot-page-modules.js --base=https://13asrs.com --out=outputs/page-modules-snapshot.js
  node tools/snapshot-page-modules.js --pages=home,solutions,about --format=json --out=outputs/page-modules-snapshot.json
  node tools/snapshot-page-modules.js --input=outputs/page-modules-snapshot.js --out=outputs/page-modules-snapshot-normalized.js
  node tools/snapshot-page-modules.js --input=outputs/page-modules-snapshot.js --in-place

This is a manual tool. It does not run during build and is not loaded by the website.
`);
}

function normalizeAssetName(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/([A-Za-z0-9_-]+)\.[0-9a-f]{8}\.(webp|png|jpe?g|gif|svg)/gi, '$1.$2')
    .replace(/\u00c2\u00b7/g, '\u00b7');
}

function normalizeModule(module) {
  const next = {};
  for (const [key, value] of Object.entries(module || {})) {
    if (Array.isArray(value)) {
      next[key] = value.map(item => normalizeModule(item));
    } else if (value && typeof value === 'object') {
      next[key] = normalizeModule(value);
    } else {
      next[key] = key === 'href' || key === 'ctaHref' ? value : normalizeAssetName(value);
    }
  }

  if (DYNAMIC_VARIANTS.has(next.variant)) {
    next.type = 'dynamic';
  }

  return normalizePageModuleLinks(next);
}

function normalizeSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const pages = snapshot.pages;
  return {
    ...snapshot,
    pages: Object.fromEntries(
      Object.entries(pages).map(([page, modules]) => [
        page,
        Array.isArray(modules) ? modules.map(normalizeModule) : [],
      ]),
    ),
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Snapshot must be an object');
  }
  if (!snapshot.pages || typeof snapshot.pages !== 'object' || Array.isArray(snapshot.pages)) {
    throw new Error('Snapshot pages must be an object');
  }
  for (const [page, modules] of Object.entries(snapshot.pages)) {
    if (!Array.isArray(modules)) {
      throw new Error(`Snapshot page ${page} must contain an array of modules`);
    }
    for (const [index, module] of modules.entries()) {
      if (!module || typeof module !== 'object' || Array.isArray(module)) {
        throw new Error(`Snapshot page ${page} module ${index} must be an object`);
      }
    }
  }
}

function readSnapshot(inputPath) {
  const resolvedPath = path.resolve(inputPath);
  if (path.extname(resolvedPath).toLowerCase() === '.json') {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  const source = fs.readFileSync(resolvedPath, 'utf8');
  const match = source.match(/const PAGE_MODULE_SNAPSHOT = ([\s\S]*?);\s*module\.exports = \{ PAGE_MODULE_SNAPSHOT \};?\s*$/);
  if (!match) {
    throw new Error('--input JavaScript must use the snapshot format emitted by this tool');
  }
  return JSON.parse(match[1]);
}

async function fetchPage(base, page) {
  const url = `${base}/api/pages/${encodeURIComponent(page)}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`${page}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data.modules) ? data.modules.map(normalizeModule) : [];
}

function buildOutput(snapshot, format) {
  if (format === 'json') {
    return `${JSON.stringify(snapshot, null, 2)}\n`;
  }

  return [
    '// Generated by tools/snapshot-page-modules.js.',
    '// Manual KV/API snapshot only; this file is not loaded by the website unless wired in deliberately.',
    `const PAGE_MODULE_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)};`,
    '',
    'module.exports = { PAGE_MODULE_SNAPSHOT };',
    '',
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let snapshot;

  if (options.input) {
    snapshot = normalizeSnapshot(readSnapshot(options.input));
    console.log(`Normalized ${Object.keys(snapshot.pages).length} pages from ${options.input}`);
  } else {
    snapshot = {
      capturedAt: new Date().toISOString(),
      baseUrl: options.base,
      pages: {},
    };

    for (const page of options.pages) {
      process.stdout.write(`Fetching ${page}... `);
      snapshot.pages[page] = await fetchPage(options.base, page);
      console.log(`${snapshot.pages[page].length} modules`);
    }
  }

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, buildOutput(snapshot, options.format), 'utf8');
  console.log(`Wrote ${options.out}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  buildOutput,
  normalizeModule,
  normalizeSnapshot,
  parseArgs,
  readSnapshot,
  validateSnapshot,
};
