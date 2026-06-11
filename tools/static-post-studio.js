#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.STATIC_POST_STUDIO_PORT || 8791);
const DRAFT_DIR = path.join(ROOT, 'content', 'static-posts', 'generated');

const INDUSTRIES = [
  ['', 'Select industry'],
  ['all-industries', 'All Industries'],
  ['food-beverage', 'Food & Beverage'],
  ['pharmaceutical-biotech', 'Pharmaceutical & Biotech'],
  ['packaging-printing', 'Packaging & Printing'],
  ['cold-chain-frozen-food', 'Cold Chain / Frozen Food'],
  ['logistics-distribution', 'Logistics & Distribution'],
  ['ecommerce-fulfillment', 'E-commerce Fulfillment'],
  ['manufacturing-industrial', 'Manufacturing / Industrial'],
  ['chemical-petrochemical', 'Chemical & Petrochemical'],
  ['agriculture-grain-processing', 'Agriculture & Grain Processing'],
  ['automotive-transportation', 'Automotive & Transportation'],
  ['electronics-semiconductors', 'Electronics & Semiconductors'],
  ['health-personal-care', 'Health & Personal Care'],
  ['household-products', 'Household Products'],
  ['other', 'Other'],
];

const SOLUTIONS = [
  ['', 'Select solution'],
  ['all-solutions', 'All Solutions'],
  ['asrs', 'ASRS / Automated Storage & Retrieval Systems'],
  ['conveyor-transport', 'Conveyor Systems / Automated Transport'],
  ['smart-factory', 'Smart Factory / Factory Automation'],
  ['production-line', 'Production Line Automation'],
  ['packaging-automation', 'Packaging Automation'],
  ['filling-bottling', 'Filling & Bottling Systems'],
  ['printing-inkjet-flexo-ci', 'Printing / Inkjet / Flexo / CI Printing'],
  ['film-blowing-extrusion', 'Film Blowing / Film Extrusion'],
  ['cold-storage-automation', 'Cold Storage / Low-Temperature Automation'],
  ['material-pallet-handling', 'Material Handling / Pallet Handling'],
  ['wms-wes', 'Intelligent WMS / WES Integration'],
  ['erp-mes-monitoring', 'ERP / MES / Production Monitoring'],
  ['robotics-integration', 'Robotics Integration'],
  ['laser-industrial-machining', 'Laser Processing / Industrial Machining'],
  ['other-industrial-automation', 'Other Industrial Automation Solutions'],
];

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function normalizeFileName(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) throw new Error('File name is required.');
  const withExt = raw.toLowerCase().endsWith('.html') ? raw : `${raw}.html`;
  if (withExt.includes('/') || withExt.includes('\\') || withExt.includes('..')) {
    throw new Error('File name must not contain folders.');
  }
  if (!/^[a-z0-9][a-z0-9._-]*\.html$/i.test(withExt)) {
    throw new Error('File name may only contain letters, numbers, dots, dashes, and underscores.');
  }
  return withExt;
}

function outputPathFor(post) {
  return `${post.contentType === 'case' ? 'cases' : 'blog'}/${post.fileName}`;
}

function draftPathFor(post) {
  const base = post.fileName.replace(/\.html$/i, '.json');
  const prefix = post.contentType === 'case' ? 'case' : 'blog';
  return path.join(DRAFT_DIR, `${prefix}-${base}`);
}

function cleanPostPayload(input) {
  const contentType = input.contentType === 'case' ? 'case' : 'blog';
  const fileName = normalizeFileName(input.fileName);
  const industry = String(input.industry || '').trim();
  const solution = String(input.solution || '').trim();
  const industryLabel = INDUSTRIES.find(([value]) => value === industry)?.[1] || input.industryLabel || '';
  const solutionLabel = SOLUTIONS.find(([value]) => value === solution)?.[1] || input.solutionLabel || '';
  const title = String(input.title || '').trim();
  const contentHtml = String(input.contentHtml || '').trim();

  if (!title) throw new Error('Title is required.');
  if (!contentHtml) throw new Error('Content HTML is required.');

  return {
    fileName,
    contentType,
    title,
    summary: String(input.summary || '').trim(),
    coverImage: String(input.coverImage || '').trim(),
    industry,
    industryLabel,
    solution,
    solutionLabel,
    category: String(input.category || solutionLabel || (contentType === 'case' ? 'Case Study' : 'Blog')).trim(),
    youtubeUrl: String(input.youtubeUrl || '').trim(),
    author: String(input.author || '13ASRS').trim(),
    date: String(input.date || new Date().toISOString().slice(0, 10)).trim(),
    seoTitle: String(input.seoTitle || title).trim(),
    seoDescription: String(input.seoDescription || input.summary || '').trim(),
    relatedProjects: parseRelated(input.relatedProjects),
    relatedSolutions: parseRelated(input.relatedSolutions),
    contentHtml,
  };
}

function parseRelated(value) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [title, href] = line.split('|').map(part => part.trim());
      return href ? { title, href } : title;
    });
}

function runGenerator(draftPath, force) {
  const args = [
    path.join(ROOT, 'tools', 'generate-static-post.js'),
    `--input=${draftPath}`,
  ];
  if (force) args.push('--force');
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Generator failed.').trim());
  }
  return (result.stdout || '').trim();
}

async function handleGenerate(req, res) {
  try {
    const body = await readRequestBody(req);
    const input = JSON.parse(body || '{}');
    const post = cleanPostPayload(input);
    fs.mkdirSync(DRAFT_DIR, { recursive: true });
    const draftPath = draftPathFor(post);
    fs.writeFileSync(draftPath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');

    const output = runGenerator(draftPath, Boolean(input.force));
    sendJson(res, 200, {
      ok: true,
      draftPath: path.relative(ROOT, draftPath).replace(/\\/g, '/'),
      outputPath: outputPathFor(post),
      previewUrl: `/${outputPathFor(post)}`,
      generatorOutput: output,
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || String(error) });
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function serveWorkspaceFile(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') return send(res, 200, renderApp(), { 'Content-Type': 'text/html; charset=utf-8' });
  pathname = pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, pathname);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  send(res, 200, fs.readFileSync(filePath), { 'Content-Type': contentTypeFor(filePath) });
}

function renderOptions(options) {
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
}

function renderApp() {
  const today = new Date().toISOString().slice(0, 10);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Static Blog / Case Studio</title>
  <style>
    :root { color-scheme: light; --bg:#f4f6f8; --panel:#fff; --ink:#172033; --muted:#64748b; --line:#d9e1ec; --brand:#d71920; }
    body { margin:0; font-family: Arial, Helvetica, sans-serif; background:var(--bg); color:var(--ink); }
    header { padding:28px 34px; background:#111827; color:#fff; }
    header h1 { margin:0 0 8px; font-size:26px; }
    header p { margin:0; color:#cbd5e1; }
    main { padding:28px; display:grid; grid-template-columns:minmax(320px, 520px) 1fr; gap:22px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:18px; box-shadow:0 18px 45px rgba(15,23,42,.08); overflow:hidden; }
    .panel h2 { margin:0; padding:18px 20px; border-bottom:1px solid var(--line); font-size:18px; }
    form { padding:20px; display:grid; gap:14px; }
    label { display:grid; gap:7px; font-weight:700; font-size:13px; color:#26344d; }
    input, select, textarea { width:100%; box-sizing:border-box; border:1px solid var(--line); border-radius:10px; padding:10px 12px; font:inherit; background:#fff; }
    textarea { min-height:86px; resize:vertical; }
    #contentHtml { min-height:360px; font-family: Consolas, Monaco, monospace; font-size:13px; line-height:1.55; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .hint { color:var(--muted); font-weight:400; font-size:12px; line-height:1.45; }
    .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; position:sticky; bottom:0; background:#fff; border-top:1px solid var(--line); padding-top:14px; }
    button { border:0; border-radius:999px; padding:11px 18px; font-weight:800; cursor:pointer; }
    .primary { background:var(--brand); color:#fff; }
    .ghost { background:#edf2f7; color:#1f2937; }
    .status { padding:12px 14px; border-radius:12px; background:#eef6ff; color:#1e3a8a; white-space:pre-wrap; }
    .status.error { background:#fff1f2; color:#991b1b; }
    .preview { padding:20px; }
    iframe { width:100%; height:760px; border:1px solid var(--line); border-radius:14px; background:#fff; }
    .path-preview { font-family:Consolas, Monaco, monospace; background:#0f172a; color:#e2e8f0; padding:12px; border-radius:12px; overflow:auto; }
    @media (max-width: 980px) { main { grid-template-columns:1fr; padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>Static Blog / Case Studio</h1>
    <p>本地生成真实 HTML 页面：Blog 输出到 <strong>blog/</strong>，Case 输出到 <strong>cases/</strong>。后台 KV 不会被实时读取或覆盖。</p>
  </header>
  <main>
    <section class="panel">
      <h2>Post Fields</h2>
      <form id="postForm">
        <div class="row">
          <label>Content Type
            <select name="contentType" id="contentType">
              <option value="blog">Blog</option>
              <option value="case">Case</option>
            </select>
          </label>
          <label>File Name
            <input name="fileName" id="fileName" placeholder="my-article.html" required>
            <span class="hint">只填文件名。路径会自动变成 blog/my-article.html 或 cases/my-article.html。</span>
          </label>
        </div>
        <div class="path-preview" id="pathPreview">blog/my-article.html</div>
        <label>Title <input name="title" id="title" required></label>
        <label>Summary <textarea name="summary"></textarea></label>
        <div class="row">
          <label>Industry <select name="industry" id="industry">${renderOptions(INDUSTRIES)}</select></label>
          <label>Solution <select name="solution" id="solution">${renderOptions(SOLUTIONS)}</select></label>
        </div>
        <div class="row">
          <label>Cover Image URL <input name="coverImage" placeholder="system-acr.webp or https://..."></label>
          <label>YouTube URL <input name="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..."></label>
        </div>
        <div class="row">
          <label>Author <input name="author" value="13ASRS"></label>
          <label>Date <input name="date" type="date" value="${today}"></label>
        </div>
        <label>SEO Title <input name="seoTitle"></label>
        <label>SEO Description <input name="seoDescription"></label>
        <label>Related Projects
          <textarea name="relatedProjects" placeholder="Title | case-studies.html&#10;Another title | cases/example.html"></textarea>
          <span class="hint">每行一个，格式：标题 | 链接。只写标题也可以。</span>
        </label>
        <label>Related Solutions
          <textarea name="relatedSolutions" placeholder="ASRS Warehouse Solution | solutions.html#asrs"></textarea>
        </label>
        <label>Content HTML
          <textarea name="contentHtml" id="contentHtml" required><h2>Project Overview</h2>
<p>Write the article or case study body here.</p>
<h2>Solution</h2>
<p>Describe the solution, equipment, workflow, and customer value.</p></textarea>
        </label>
        <label><input name="force" type="checkbox" style="width:auto;"> Overwrite existing HTML if it already exists</label>
        <div class="actions">
          <button class="primary" type="submit">Generate Static Page</button>
          <button class="ghost" type="button" id="fillExample">Fill Example</button>
        </div>
        <div id="status" class="status">Ready.</div>
      </form>
    </section>
    <section class="panel">
      <h2>Preview</h2>
      <div class="preview">
        <iframe id="previewFrame" title="Generated page preview"></iframe>
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById('postForm');
    const statusBox = document.getElementById('status');
    const frame = document.getElementById('previewFrame');
    const contentType = document.getElementById('contentType');
    const fileName = document.getElementById('fileName');
    const pathPreview = document.getElementById('pathPreview');

    function normalizedFileName() {
      const raw = fileName.value.trim() || 'my-article.html';
      return raw.toLowerCase().endsWith('.html') ? raw : raw + '.html';
    }

    function updatePathPreview() {
      const dir = contentType.value === 'case' ? 'cases' : 'blog';
      pathPreview.textContent = dir + '/' + normalizedFileName();
    }

    contentType.addEventListener('change', updatePathPreview);
    fileName.addEventListener('input', updatePathPreview);
    updatePathPreview();

    document.getElementById('fillExample').addEventListener('click', () => {
      contentType.value = 'case';
      fileName.value = 'sample-automation-case.html';
      form.title.value = 'Sample Automation Case Study';
      form.summary.value = 'A short summary for the generated static case page.';
      form.coverImage.value = 'system-acr.webp';
      form.industry.value = 'manufacturing-industrial';
      form.solution.value = 'smart-factory';
      form.seoTitle.value = 'Sample Automation Case Study | 13ASRS';
      form.seoDescription.value = 'Static case page generated from the local post studio.';
      updatePathPreview();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      statusBox.className = 'status';
      statusBox.textContent = 'Generating...';
      const data = Object.fromEntries(new FormData(form).entries());
      data.force = form.force.checked;
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || 'Generate failed');
        statusBox.textContent = 'Generated: ' + result.outputPath + '\\nDraft JSON: ' + result.draftPath + '\\n' + result.generatorOutput;
        frame.src = result.previewUrl + '?t=' + Date.now();
      } catch (error) {
        statusBox.className = 'status error';
        statusBox.textContent = error.message;
      }
    });
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'GET') return serveWorkspaceFile(req, res);
  send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Static Post Studio running at http://127.0.0.1:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
