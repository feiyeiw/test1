#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const options = {
    base: 'https://13asrs.com',
    out: path.join('outputs', 'blogs-api-snapshot.json'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length).replace(/\/+$/, '');
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Snapshot published blog and case posts through the public Pages API.

Usage:
  node tools/snapshot-case-posts.js
  node tools/snapshot-case-posts.js --base=https://13asrs.com --out=outputs/blogs-api-snapshot.json

This is a manual tool. It does not run during build and does not edit local source files.
`);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const url = `${options.base}/api/blogs`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const posts = JSON.parse(text);
  const cases = posts.filter(item => item.contentType === 'case' && item.status === 'published');

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${options.out}`);
  console.log(`Published case posts: ${cases.length}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
