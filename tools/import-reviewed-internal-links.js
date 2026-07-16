#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'reports', 'blog-case-internal-link-review.csv');
const DEFAULT_OUTPUT = path.join(ROOT, 'content', 'static-posts', 'internal-links.json');
const SECTION_MAP = new Map([
  ['Summary', 'summary'],
  ['Technology', 'technology'],
  ['Challenge', 'challenge'],
  ['Solution', 'solution'],
  ['Workflow & Layout', 'workflow-layout'],
  ['Results & ROI', 'results-roi'],
  ['Equipment List', 'equipment-list'],
  ['Body', 'body'],
]);

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    approveAll: false,
    markApplied: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--input=')) options.input = path.resolve(arg.slice('--input='.length));
    else if (arg.startsWith('--output=')) options.output = path.resolve(arg.slice('--output='.length));
    else if (arg === '--approve-all') options.approveAll = true;
    else if (arg === '--mark-applied') options.markApplied = true;
  }
  return options;
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter(values => values.some(value => value !== ''));
}

function toCsv(rows) {
  return rows.map(row => row.map(value => {
    const text = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}

function toObjects(rows) {
  if (rows.length < 2) throw new Error('Review CSV has no data rows.');
  const headers = rows[0].map(header => header.replace(/^\uFEFF/, ''));
  return {
    headers,
    records: rows.slice(1).map((values, rowIndex) => {
      const record = { __rowIndex: rowIndex + 1 };
      headers.forEach((header, index) => { record[header] = values[index] || ''; });
      return record;
    }),
  };
}

function getSlug(urlValue, expectedRoot) {
  const url = new URL(String(urlValue || '').trim());
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== expectedRoot) {
    throw new Error(`Unexpected ${expectedRoot} URL: ${urlValue}`);
  }
  return decodeURIComponent(parts[1]);
}

function getTargetPath(urlValue) {
  const url = new URL(String(urlValue || '').trim());
  if (!/^\/case\/[^/]+\/?$/.test(url.pathname)) throw new Error(`Unexpected Case URL: ${urlValue}`);
  return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = fs.readFileSync(options.input, 'utf8').replace(/^\uFEFF/, '');
  const parsedRows = parseCsv(raw);
  const { headers, records } = toObjects(parsedRows);
  const requiredHeaders = [
    '审核状态', '来源Blog标题', '来源Blog URL', '正文板块', '建议锚文本（正文原词）',
    '建议目标Case标题', '建议目标Case URL', '正文已链接该目标',
  ];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) throw new Error(`Missing CSV header: ${header}`);
  }

  const importedRecords = records.filter(record => {
    if (options.approveAll) return Boolean(record['建议锚文本（正文原词）'] && record['建议目标Case URL']);
    return record['审核状态'] === '已批准' || record['审核状态'] === '已应用';
  });
  if (!importedRecords.length) {
    throw new Error('No approved rows found. Use --approve-all only after the whole CSV has been reviewed.');
  }

  const links = importedRecords.map(record => {
    const section = SECTION_MAP.get(record['正文板块']);
    if (!section) throw new Error(`Unsupported section at CSV row ${record.__rowIndex + 1}: ${record['正文板块']}`);
    return {
      sourceSlug: getSlug(record['来源Blog URL'], 'blog'),
      sourceTitle: record['来源Blog标题'],
      section,
      anchor: record['建议锚文本（正文原词）'].trim(),
      target: getTargetPath(record['建议目标Case URL']),
      targetTitle: record['建议目标Case标题'],
    };
  });

  const seen = new Set();
  for (const link of links) {
    const key = `${link.sourceSlug}|${link.section}|${link.anchor}`.toLocaleLowerCase('en-US');
    if (seen.has(key)) throw new Error(`Duplicate internal link mapping: ${key}`);
    seen.add(key);
  }

  links.sort((a, b) => a.sourceSlug.localeCompare(b.sourceSlug, 'en') || a.section.localeCompare(b.section, 'en'));
  const payload = {
    version: 1,
    sourceReport: path.relative(ROOT, options.input).replace(/\\/g, '/'),
    links,
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  if (options.markApplied) {
    const importedRows = new Set(importedRecords.map(record => record.__rowIndex));
    for (const record of records) {
      if (!importedRows.has(record.__rowIndex)) continue;
      record['审核状态'] = '已应用';
      record['正文已链接该目标'] = '是（由批准映射注入）';
    }
    const outputRows = [headers, ...records.map(record => headers.map(header => record[header] || ''))];
    fs.writeFileSync(options.input, `\uFEFF${toCsv(outputRows)}\r\n`, 'utf8');
  }

  console.log(`Imported ${links.length} approved internal links.`);
  console.log(`Mapping: ${options.output}`);
  if (options.markApplied) console.log(`Updated review status: ${options.input}`);
}

main();
