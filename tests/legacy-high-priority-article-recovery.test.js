const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs', 'blogs-api-snapshot.json'), 'utf8'));

const RECOVERIES = [
  {
    id: '1780748944138-9969945d-3a42-4cac-a742-f5ecf7d5e663',
    sourcePath: 'content/static-posts/generated/blog-how-to-build-an-automated-cold-storage-warehouse-shuttle-asrs-cold-warehouse-project-guide.json',
    outputPath: 'blog/how-to-build-an-automated-cold-storage-warehouse-shuttle-asrs-cold-warehouse-project-guide/index.html',
    contentType: 'blog',
    evidenceText: 'Warehouse Area: 2,968㎡',
    archiveSha256: '5c182f26a6b67b39d225d5848a3d226cf29e3dee114678b91598458fc93cb4b4',
  },
  {
    id: '1780980827480-3a6029a1-6d64-445d-9e4e-0a37fe6bc0de',
    sourcePath: 'content/static-posts/generated/case-how-does-a-42-stacker-crane-asrs-warehouse-work-large-scale-automated-storage-and-retrieva.json',
    outputPath: 'case/how-does-a-42-stacker-crane-asrs-warehouse-work-large-scale-automated-storage-and-retrieva/index.html',
    contentType: 'case',
    evidenceText: '42 High-Speed Stacker Cranes',
    archiveSha256: 'c5af62443e11ffe28f7840d64c2ea765d65728a4625aa9baa19a09380900f8c2',
  },
  {
    id: '1780981364211-727b393d-6e6d-442d-b9c5-d7daac6b8224',
    sourcePath: 'content/static-posts/generated/case-cold-storage-asrs-upgrade-case-study-7-000-pallet-positions-at-25-c-automated-warehouse.json',
    outputPath: 'case/cold-storage-asrs-upgrade-case-study-7-000-pallet-positions-at-25-c-automated-warehouse/index.html',
    contentType: 'case',
    evidenceText: '7,000 Pallet Positions',
    archiveSha256: '47d3c5ff1eee76a5c861d588dd6d77d521661a6ebe50dd3b4d07d10632afb1ca',
  },
];

const EDITORIAL_SECTION_HEADINGS = new Set([
  'focus keywords',
  'recommended tags',
  'internal link opportunities',
]);
const TAXONOMY_SECTION_HEADINGS = new Set(['categories', 'tags']);

function findSnapshotPost(id) {
  const post = SNAPSHOT.find(item => item.id === id);
  assert.ok(post, `snapshot must contain legacy ID ${id}`);
  return post;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(value) {
  return decodeHtml(String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function listItems(html) {
  const code = String(html).match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  const body = (code ? code[1] : String(html))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:li|p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtml(body)
    .split(/\r?\n/)
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizePublishedHtml(html) {
  return String(html)
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi, (section, heading, body) => {
      const headingText = stripHtml(heading);
      const title = headingText.toLowerCase();
      if (EDITORIAL_SECTION_HEADINGS.has(title)) return '';
      if (!title && !stripHtml(body)) return '';
      if (TAXONOMY_SECTION_HEADINGS.has(title)) {
        const items = listItems(body);
        return `<h2>${headingText}</h2><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
      }
      return section;
    })
    .replace(/<\/?h1\b/gi, match => match.replace(/h1/i, 'h2'));
}

function findIndexCard(html, attribute, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const card = new RegExp(`<article\\b(?=[^>]*\\b${attribute}=["']${escapedId}["'])[^>]*>[\\s\\S]*?<\\/article>`, 'i').exec(html);
  return card?.[0] || '';
}

for (const recovery of RECOVERIES) {
  test(`recovers source and static page for ${recovery.id}`, () => {
    const snapshotPost = findSnapshotPost(recovery.id);
    const sourceFile = path.join(ROOT, recovery.sourcePath);
    const outputFile = path.join(ROOT, recovery.outputPath);

    assert.ok(fs.existsSync(sourceFile), `missing recovered source: ${recovery.sourcePath}`);
    assert.ok(fs.existsSync(outputFile), `missing generated static page: ${recovery.outputPath}`);

    const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    const output = fs.readFileSync(outputFile, 'utf8');

    assert.equal(source.legacySource.id, recovery.id);
    assert.equal(source.legacySource.snapshotFile, 'outputs/blogs-api-snapshot.json');
    assert.equal(source.legacySource.contentHtml, snapshotPost.contentHtml);
    assert.equal(crypto.createHash('sha256').update(source.legacySource.contentHtml, 'utf8').digest('hex'), recovery.archiveSha256);
    assert.equal(crypto.createHash('sha256').update(snapshotPost.contentHtml, 'utf8').digest('hex'), recovery.archiveSha256);
    assert.equal(source.title, snapshotPost.title);
    assert.equal(source.urlSlug, snapshotPost.slug);
    assert.equal(source.contentType, recovery.contentType);
    assert.equal(source.contentHtml, normalizePublishedHtml(snapshotPost.contentHtml));
    assert.equal(source.plainText, stripHtml(source.contentHtml));
    assert.doesNotMatch(source.contentHtml, /<h2\b[^>]*>\s*(?:Focus Keywords|Recommended Tags|Internal Link Opportunities)\s*<\/h2>/i);
    assert.doesNotMatch(source.plainText, /Focus Keywords|Recommended Tags|Internal Link Opportunities/i);
    assert.doesNotMatch(source.contentHtml, /code-block-viewer|cm-scroller|cm-content/i);
    assert.ok(source.coverImage, 'recovered cover image must remain available');
    if (recovery.contentType === 'case') {
      assert.match(source.contentHtml, /<h2>Categories<\/h2>/);
      assert.match(source.contentHtml, /<h2>Tags<\/h2>/);
    }
    assert.match(output, new RegExp(`<link rel="canonical" href="https://13asrs\\.com/${recovery.outputPath.replace('/index.html', '/')}">`));
    assert.match(output, new RegExp(snapshotPost.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(output, new RegExp(recovery.evidenceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(output, /<h1 class="blog-title">/);
    assert.equal((output.match(/<h1\b/gi) || []).length, 1);
    assert.match(output, /<section class="article-section" id="project-overview-opening">/);
    assert.doesNotMatch(output, /<h1>Project Overview<\/h1>/i);
    assert.doesNotMatch(output, /<h2\b[^>]*>\s*(?:Focus Keywords|Recommended Tags|Internal Link Opportunities)\s*<\/h2>/i);
    assert.ok(output.includes(source.coverImage.replace(/&/g, '&amp;')), 'generated page must retain the source cover image');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-post-regeneration-'));
    try {
      const inputPath = path.join(tempDir, 'legacy-post.json');
      const rawFixture = { ...source, contentHtml: snapshotPost.contentHtml, plainText: snapshotPost.plainText };
      fs.writeFileSync(inputPath, JSON.stringify(rawFixture), 'utf8');
      execFileSync(process.execPath, [
        path.join(ROOT, 'tools', 'generate-static-post.js'),
        `--input=${inputPath}`,
        `--out-dir=${tempDir}`,
      ], { cwd: ROOT, stdio: 'pipe' });
      const regenerated = fs.readFileSync(path.join(tempDir, recovery.outputPath), 'utf8');
      assert.doesNotMatch(regenerated, /<h2\b[^>]*>\s*(?:Focus Keywords|Recommended Tags|Internal Link Opportunities)\s*<\/h2>/i);
      assert.match(regenerated, new RegExp(recovery.evidenceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal((regenerated.match(/<h1\b/gi) || []).length, 1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
}

test('recovered articles have canonical index entries and static CMS protection', () => {
  const blogIndex = fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8');
  const caseIndex = fs.readFileSync(path.join(ROOT, 'case-studies.html'), 'utf8');
  const runtime = fs.readFileSync(path.join(ROOT, 'site-upgrade.js'), 'utf8');

  assert.match(blogIndex, /<main\b[^>]*data-static-page-modules="true"[^>]*>/i);
  assert.match(caseIndex, /<main\b[^>]*data-static-page-modules="true"[^>]*>/i);
  assert.match(runtime, /if\s*\(main\.dataset\.staticPageModules\s*===\s*'true'\)[\s\S]*?await hydrateDynamicModules\(page\);[\s\S]*?return;/);

  for (const recovery of RECOVERIES) {
    const source = JSON.parse(fs.readFileSync(path.join(ROOT, recovery.sourcePath), 'utf8'));
    const isBlog = recovery.contentType === 'blog';
    const index = isBlog ? blogIndex : caseIndex;
    const idAttribute = isBlog ? 'data-static-post-id' : 'data-case-id';
    const card = findIndexCard(index, idAttribute, source.urlSlug);
    const canonicalPath = `/${recovery.outputPath.replace(/\/index\.html$/, '/')}`;
    const hrefs = [...card.matchAll(/\bhref=["']([^"']+)["']/gi)].map(match => match[1]);

    assert.ok(card, `missing ${recovery.contentType} index card for ${source.urlSlug}`);
    assert.ok(hrefs.includes(canonicalPath), `index card must link directly to ${canonicalPath}`);
    if (isBlog) {
      assert.ok(card.includes(source.category), 'blog card must keep the source category');
      assert.match(blogIndex, new RegExp(`data-static-post-ids="[^"]*${source.urlSlug}[^"]*"`));
    } else {
      assert.match(card, new RegExp(`data-industry="${source.industry}"`));
      assert.match(card, new RegExp(`data-solution="${source.solution}"`));
      assert.match(caseIndex, new RegExp(`data-static-case-ids="[^"]*${source.urlSlug}[^"]*"`));
      const functionValue = /\bdata-function="([^"]*)"/i.exec(card)?.[1] || '';
      assert.equal(functionValue, source.functionCategory || source.function || '');
      if (!functionValue && source.solution === 'asrs') {
        assert.match(caseIndex, /asrs:\s*'warehouse-automation'/);
      }
    }
  }
});

test('editorial cleanup recognizes entity-encoded heading labels', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-post-encoded-headings-'));
  try {
    const inputPath = path.join(tempDir, 'encoded-headings.json');
    const outputPath = path.join(tempDir, 'blog', 'encoded-heading-regression', 'index.html');
    const fixture = {
      fileName: 'encoded-heading-regression',
      title: 'Encoded Heading Regression',
      urlSlug: 'encoded-heading-regression',
      contentType: 'blog',
      contentHtml: [
        '<h2>Focus&nbsp;Keywords</h2><p>private-focus-keywords-value</p>',
        '<h2>Recommended&#32;Tags</h2><p>private-recommended-tags-value</p>',
        '<h2>Internal Link Opportunities</h2><p>private-internal-links-value</p>',
        '<h2>Categories</h2><ul><li>Cold&mdash;Storage</li><li>Caf&eacute; Warehouse</li><li>Global &euro; Warehouse</li></ul>',
        '<h2>Tags</h2><ul><li>Cold&mdash;Chain</li></ul>',
        '<h2>Public Content</h2><p>Keep this public paragraph.</p>',
      ].join(''),
    };
    fs.writeFileSync(inputPath, JSON.stringify(fixture), 'utf8');
    execFileSync(process.execPath, [
      path.join(ROOT, 'tools', 'generate-static-post.js'),
      `--input=${inputPath}`,
      `--out-dir=${tempDir}`,
    ], { cwd: ROOT, stdio: 'pipe' });

    const output = fs.readFileSync(outputPath, 'utf8');
    const categoriesSection = /<section class="article-section" id="categories">[\s\S]*?<\/section>/.exec(output)?.[0] || '';
    const tagsSection = /<section class="article-section" id="tags">[\s\S]*?<\/section>/.exec(output)?.[0] || '';
    assert.doesNotMatch(output, /private-(?:focus-keywords|recommended-tags|internal-links)-value/);
    assert.match(categoriesSection, /Cold&mdash;Storage/);
    assert.match(categoriesSection, /Caf&eacute; Warehouse/);
    assert.match(categoriesSection, /Global &euro; Warehouse/);
    assert.match(tagsSection, /Cold&mdash;Chain/);
    assert.doesNotMatch(`${categoriesSection}${tagsSection}`, /&amp;(?:mdash|eacute|euro);/);
    assert.match(output, /Keep this public paragraph\./);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
