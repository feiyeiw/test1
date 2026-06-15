#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.STATIC_POST_STUDIO_PORT || 8791);
const DRAFT_DIR = path.join(ROOT, 'content', 'static-posts', 'generated');
const SHOULD_OPEN_BROWSER = process.env.STATIC_POST_STUDIO_OPEN !== '0';
const GIT_CHECK_TIMEOUT_MS = 45_000;
const GIT_LOGIN_TIMEOUT_MS = 180_000;
const MAX_REQUEST_BODY_BYTES = 80 * 1024 * 1024;

const INDUSTRIES = [
  ['', 'Select industry', 'Select industry'],
  ['all-industries', 'All Industries', 'All Industries'],
  ['food-beverage', 'Food & Beverage', 'Food & Beverage'],
  ['pharmaceutical-biotech', 'Pharmaceutical & Biotech', 'Pharmaceutical & Biotech'],
  ['packaging-printing', 'Packaging & Printing', 'Packaging & Printing'],
  ['cold-chain-frozen-food', 'Cold Chain / Frozen Food', 'Cold Chain / Frozen Food'],
  ['logistics-distribution', 'Logistics & Distribution', 'Logistics & Distribution'],
  ['ecommerce-fulfillment', 'E-commerce Fulfillment', 'E-commerce Fulfillment'],
  ['manufacturing-industrial', 'Manufacturing / Industrial', 'Manufacturing / Industrial'],
  ['chemical-petrochemical', 'Chemical & Petrochemical', 'Chemical & Petrochemical'],
  ['agriculture-grain-processing', 'Agriculture & Grain Processing', 'Agriculture & Grain Processing'],
  ['automotive-transportation', 'Automotive & Transportation', 'Automotive & Transportation'],
  ['electronics-semiconductors', 'Electronics & Semiconductors', 'Electronics & Semiconductors'],
  ['health-personal-care', 'Health & Personal Care', 'Health & Personal Care'],
  ['household-products', 'Household Products', 'Household Products'],
  ['other', 'Other', 'Other'],
];

const SOLUTIONS = [
  ['', 'Select solution', 'Select solution'],
  ['all-solutions', 'All Solutions', 'All Solutions'],
  ['asrs', 'ASRS / Automated Storage & Retrieval Systems', 'ASRS / Automated Storage & Retrieval Systems'],
  ['conveyor-transport', 'Conveyor Systems / Automated Transport', 'Conveyor Systems / Automated Transport'],
  ['smart-factory', 'Smart Factory / Factory Automation', 'Smart Factory / Factory Automation'],
  ['production-line', 'Production Line Automation', 'Production Line Automation'],
  ['packaging-automation', 'Packaging Automation', 'Packaging Automation'],
  ['filling-bottling', 'Filling & Bottling Systems', 'Filling & Bottling Systems'],
  ['printing-inkjet-flexo-ci', 'Printing / Inkjet / Flexo / CI Printing', 'Printing / Inkjet / Flexo / CI Printing'],
  ['film-blowing-extrusion', 'Film Blowing / Film Extrusion', 'Film Blowing / Film Extrusion'],
  ['cold-storage-automation', 'Cold Storage / Low-Temperature Automation', 'Cold Storage / Low-Temperature Automation'],
  ['material-pallet-handling', 'Material Handling / Pallet Handling', 'Material Handling / Pallet Handling'],
  ['wms-wes', 'Intelligent WMS / WES Integration', 'Intelligent WMS / WES Integration'],
  ['erp-mes-monitoring', 'ERP / MES / Production Monitoring', 'ERP / MES / Production Monitoring'],
  ['robotics-integration', 'Robotics Integration', 'Robotics Integration'],
  ['laser-industrial-machining', 'Laser Processing / Industrial Machining', 'Laser Processing / Industrial Machining'],
  ['other-industrial-automation', 'Other Industrial Automation Solutions', 'Other Industrial Automation Solutions'],
];

const COUNTRIES = [
  ['', 'Select country', 'Select country'],
  ['malaysia', 'Malaysia', 'Malaysia'],
  ['thailand', 'Thailand', 'Thailand'],
  ['indonesia', 'Indonesia', 'Indonesia'],
  ['vietnam', 'Vietnam', 'Vietnam'],
  ['usa', 'USA', 'USA'],
  ['mexico', 'Mexico', 'Mexico'],
  ['uae', 'UAE', 'UAE'],
  ['other', 'Other', 'Other'],
];

const FUNCTIONS = [
  ['', 'Select function', 'Select function'],
  ['warehouse-automation', 'Warehouse Automation', 'Warehouse Automation'],
  ['factory-intralogistics', 'Factory Intralogistics', 'Factory Intralogistics'],
  ['production-automation', 'Production Automation', 'Production Automation'],
  ['packaging-automation', 'Packaging Automation', 'Packaging Automation'],
  ['process-automation', 'Process Automation', 'Process Automation'],
  ['smart-factory', 'Smart Factory', 'Smart Factory'],
];

const APPLICATIONS = [
  ['', 'Select application', 'Select application'],
  ['warehouse-storage', 'Warehouse & Storage', 'Warehouse & Storage'],
  ['packaging', 'Packaging', 'Packaging'],
  ['production-lines', 'Production Lines', 'Production Lines'],
  ['mixing-processing', 'Mixing & Processing', 'Mixing & Processing'],
  ['filling-bottling', 'Filling & Bottling', 'Filling & Bottling'],
  ['material-handling', 'Material Handling', 'Material Handling'],
  ['inspection-testing', 'Inspection & Testing', 'Inspection & Testing'],
  ['printing-labeling', 'Printing & Labeling', 'Printing & Labeling'],
  ['loading-dispatch', 'Loading & Dispatch', 'Loading & Dispatch'],
];

const BLOG_CATEGORIES = [
  ['', 'Select blog category', 'Select blog category'],
  ['solutions', 'Solutions', 'Solutions'],
  ['cost-roi', 'Cost & ROI', 'Cost & ROI'],
  ['design-guides', 'Design Guides', 'Design Guides'],
  ['industry-applications', 'Industry Applications', 'Industry Applications'],
  ['technology-insights', 'Technology Insights', 'Technology Insights'],
  ['project-planning', 'Project Planning', 'Project Planning'],
  ['buyer-guides', 'Buyer Guides', 'Buyer Guides'],
  ['best-practices', 'Best Practices', 'Best Practices'],
  ['troubleshooting', 'Troubleshooting', 'Troubleshooting'],
  ['trends-innovations', 'Trends & Innovations', 'Trends & Innovations'],
  ['compliance-safety', 'Compliance & Safety', 'Compliance & Safety'],
  ['case-insights', 'Case Insights', 'Case Insights'],
  ['maintenance-operations', 'Maintenance & Operations', 'Maintenance & Operations'],
  ['productivity-improvement', 'Productivity Improvement', 'Productivity Improvement'],
  ['sustainability-energy-saving', 'Sustainability & Energy Saving', 'Sustainability & Energy Saving'],
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
      if (body.length > MAX_REQUEST_BODY_BYTES) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function normalizeFileName(fileName) {
  const raw = String(fileName || '').trim().replace(/\.html$/i, '');
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error('File name is required.');
  return `${slug}.html`;
}

function normalizeSlug(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\.html$/i, '');
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error('URL slug is required.');
  return slug;
}

function outputPathFor(post) {
  const slug = normalizeSlug(post.urlSlug, post.fileName);
  return `${post.contentType === 'case' ? 'case' : 'blog'}/${slug}/index.html`;
}

function resolveWorkspacePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const absolute = path.resolve(ROOT, normalized);
  if (!absolute.startsWith(ROOT)) {
    throw new Error('Path is outside the workspace.');
  }
  return { absolute, relative: normalized };
}

function resolveDraftPath(relativePath) {
  const { absolute, relative } = resolveWorkspacePath(relativePath);
  if (!absolute.startsWith(DRAFT_DIR) || path.extname(absolute).toLowerCase() !== '.json') {
    throw new Error('Invalid draft path.');
  }
  return { absolute, relative };
}

function resolveGeneratedHtmlPath(relativePath) {
  const { absolute, relative } = resolveWorkspacePath(relativePath);
  const isAllowed = relative.startsWith('blog/') || relative.startsWith('case/') || relative.startsWith('cases/');
  if (!isAllowed || path.extname(absolute).toLowerCase() !== '.html') {
    throw new Error('Invalid generated HTML path.');
  }
  return { absolute, relative };
}

function safeAssetFileName(name, fallbackExt) {
  const parsed = path.parse(String(name || 'asset'));
  const base = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'asset';
  const ext = (parsed.ext || fallbackExt || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
  return `${Date.now()}-${base}${ext || fallbackExt || ''}`;
}

function uploadTargetFor(kind) {
  return kind === 'video'
    ? { dir: path.join(ROOT, 'videos', 'uploads'), rel: 'videos/uploads', exts: ['.mp4', '.webm', '.ogg', '.ogv'] }
    : { dir: path.join(ROOT, 'images', 'uploads'), rel: 'images/uploads', exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'] };
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error('Invalid uploaded file data.');
  return { mime: match[1], bytes: Buffer.from(match[2], 'base64') };
}

function draftPathFor(post) {
  const base = post.fileName.replace(/\.html$/i, '.json');
  const prefix = post.contentType === 'case' ? 'case' : 'blog';
  return path.join(DRAFT_DIR, `${prefix}-${base}`);
}

function cleanPostPayload(input) {
  const contentType = input.contentType === 'case' ? 'case' : 'blog';
  const title = String(input.title || '').trim();
  const fileName = normalizeFileName(input.fileName || title);
  const urlSlug = normalizeSlug(input.urlSlug, input.fileName || title);
  const industry = String(input.industry || '').trim();
  const solution = String(input.solution || '').trim();
  const country = String(input.country || '').trim();
  const functionCategory = String(input.functionCategory || '').trim();
  const application = String(input.application || '').trim();
  const blogCategory = String(input.blogCategory || '').trim();
  const industryLabel = INDUSTRIES.find(([value]) => value === industry)?.[1] || input.industryLabel || '';
  const solutionLabel = SOLUTIONS.find(([value]) => value === solution)?.[1] || input.solutionLabel || '';
  const countryLabel = COUNTRIES.find(([value]) => value === country)?.[1] || input.countryLabel || '';
  const functionLabel = FUNCTIONS.find(([value]) => value === functionCategory)?.[1] || input.functionLabel || '';
  const applicationLabel = APPLICATIONS.find(([value]) => value === application)?.[1] || input.applicationLabel || '';
  const blogCategoryLabel = BLOG_CATEGORIES.find(([value]) => value === blogCategory)?.[1] || input.blogCategoryLabel || '';
  const contentHtml = String(input.contentHtml || '').trim();

  if (!title) throw new Error('Title is required.');
  if (!contentHtml) throw new Error('Content HTML is required.');

  return {
    fileName,
    urlSlug,
    contentType,
    title,
    summary: String(input.summary || '').trim(),
    coverImage: String(input.coverImage || '').trim(),
    country,
    countryLabel,
    industry,
    industryLabel,
    solution,
    solutionLabel,
    functionCategory,
    functionLabel,
    application,
    applicationLabel,
    blogCategory,
    blogCategoryLabel,
    category: String(input.category || blogCategoryLabel || functionLabel || solutionLabel || (contentType === 'case' ? 'Case Study' : 'Blog')).trim(),
    youtubeUrl: String(input.youtubeUrl || '').trim(),
    author: String(input.author || '13ASRS').trim(),
    date: String(input.date || new Date().toISOString().slice(0, 10)).trim(),
    seoTitle: String(input.seoTitle || title).trim(),
    seoDescription: String(input.seoDescription || input.summary || '').trim(),
    keywords: parseSimpleList(input.keywords),
    technology: parseSimpleList(input.technology),
    projectImages: parseSimpleList(input.projectImages),
    challenge: String(input.challenge || '').trim(),
    solutionDetail: String(input.solutionDetail || '').trim(),
    layoutWorkflow: String(input.layoutWorkflow || '').trim(),
    results: parseSimpleList(input.results),
    equipmentList: parseSimpleList(input.equipmentList),
    relatedProjects: parseRelated(input.relatedProjects),
    relatedSolutions: parseRelated(input.relatedSolutions),
    contentHtml,
  };
}

function parseSimpleList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
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

function runStaticIndexBaker() {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'tools', 'bake-static-indexes.js'),
  ], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Static index baker failed.').trim());
  }
  return (result.stdout || '').trim();
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    throw new Error(output || `git ${args.join(' ')} failed.`);
  }
  return output;
}

function runGitProbe(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: options.timeout || GIT_CHECK_TIMEOUT_MS,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
  });
  return {
    status: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : '',
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

function currentBranchName() {
  const result = runGitProbe(['branch', '--show-current']);
  return result.status === 0 && result.output ? result.output.split(/\r?\n/)[0].trim() : 'main';
}

function checkGitConnection() {
  const inside = runGitProbe(['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0) {
    return {
      ok: false,
      remote: '',
      branch: '',
      message: 'This folder is not a Git repository.',
      details: inside.output || inside.error,
    };
  }

  const remoteResult = runGitProbe(['remote', 'get-url', 'origin']);
  if (remoteResult.status !== 0 || !remoteResult.output) {
    return {
      ok: false,
      remote: '',
      branch: currentBranchName(),
      message: 'No origin remote is configured.',
      details: remoteResult.output || remoteResult.error,
    };
  }

  const remote = remoteResult.output.split(/\r?\n/)[0].trim();
  const branch = currentBranchName();
  const pushTarget = `HEAD:${branch}`;
  const pushCheck = runGitProbe(['push', '--dry-run', 'origin', pushTarget], {
    timeout: GIT_CHECK_TIMEOUT_MS,
  });

  if (pushCheck.status === 0) {
    return {
      ok: true,
      remote,
      branch,
      message: 'GitHub connection is ready.',
      details: pushCheck.output,
    };
  }

  const probeText = `${pushCheck.error}\n${pushCheck.output}`;
  const timedOut = /ETIMEDOUT|timed out|timeout/i.test(probeText);
  const needsSync = /non-fast-forward|fetch first|failed to push some refs|rejected/i.test(probeText);
  return {
    ok: false,
    reason: needsSync ? 'behind' : timedOut ? 'timeout' : 'auth',
    remote,
    branch,
    message: needsSync
      ? 'GitHub is connected, but this local branch is behind the remote branch.'
      : timedOut
      ? 'GitHub connection timed out while checking push access.'
      : 'GitHub is not connected or this account cannot push to the repository.',
    details: pushCheck.output || pushCheck.error || `git push --dry-run origin ${pushTarget} failed.`,
  };
}

function runGitHubLogin() {
  const result = spawnSync('git', ['credential-manager', 'github', 'login'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: GIT_LOGIN_TIMEOUT_MS,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.status !== 0) {
    throw new Error(output || 'GitHub login failed.');
  }
  return output || 'GitHub login completed.';
}

function hasStagedChanges(paths) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet', '--', ...paths], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return result.status === 1;
}

function stageCommitPush(paths, message) {
  runGit(['rev-parse', '--is-inside-work-tree']);
  const connection = checkGitConnection();
  if (!connection.ok) {
    throw new Error(`${connection.message}\n${connection.details || 'Please log in to GitHub first.'}`);
  }
  const normalizedPaths = paths.map(file => file.replace(/\\/g, '/'));
  const alreadyStaged = getStagedFiles();
  const unrelatedStaged = alreadyStaged.filter(file => !normalizedPaths.includes(file.replace(/\\/g, '/')));
  if (unrelatedStaged.length) {
    throw new Error(`Auto-push stopped because other files are already staged:\n${unrelatedStaged.join('\n')}`);
  }

  runGit(['add', '--', ...normalizedPaths]);

  if (!hasStagedChanges(normalizedPaths)) {
    return 'No generated-file changes to commit.';
  }

  const commitOutput = runGit(['commit', '-m', message]);
  const pushOutput = runGit(['push']);
  return [commitOutput, pushOutput].filter(Boolean).join('\n');
}

function getStagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Could not inspect staged git files.').trim());
  }
  return (result.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function autoPushGeneratedPost(post, draftPath, commitMessage) {
  const outputPath = outputPathFor(post);
  const draftRelPath = path.relative(ROOT, draftPath).replace(/\\/g, '/');
  const uploadPaths = ['images/uploads', 'videos/uploads'].filter(item => fs.existsSync(path.join(ROOT, item)));
  const paths = [outputPath, draftRelPath, 'blog.html', 'case-studies.html', 'index.html', ...uploadPaths];
  const title = post.title.replace(/\s+/g, ' ').trim();
  const defaultMessage = `Add static ${post.contentType} page: ${title}`;
  const message = String(commitMessage || defaultMessage).trim();
  return stageCommitPush(paths, message);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function listGeneratedHtmlFiles() {
  const dirs = [
    { dir: path.join(ROOT, 'blog'), contentType: 'blog' },
    { dir: path.join(ROOT, 'case'), contentType: 'case' },
    { dir: path.join(ROOT, 'cases'), contentType: 'case' },
  ];
  const files = [];
  for (const { dir, contentType } of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.html')) {
        const relative = path.relative(ROOT, absolute).replace(/\\/g, '/');
        files.push({ outputPath: relative, fileName: entry.name, contentType });
      }
      if (entry.isDirectory()) {
        const indexPath = path.join(absolute, 'index.html');
        if (fs.existsSync(indexPath)) {
          const relative = path.relative(ROOT, indexPath).replace(/\\/g, '/');
          files.push({ outputPath: relative, fileName: `${entry.name}.html`, urlSlug: entry.name, contentType });
        }
      }
    }
  }
  return files;
}

function listManagedPosts() {
  const drafts = [];
  const seenOutputPaths = new Set();
  if (fs.existsSync(DRAFT_DIR)) {
    for (const entry of fs.readdirSync(DRAFT_DIR, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const draftAbsolute = path.join(DRAFT_DIR, entry.name);
      try {
        const post = readJsonFile(draftAbsolute);
        if (!post.fileName) continue;
        const contentType = post.contentType === 'case' ? 'case' : 'blog';
        const fileName = normalizeFileName(post.fileName);
        const urlSlug = normalizeSlug(post.urlSlug, fileName);
        const outputPath = outputPathFor({ contentType, fileName, urlSlug });
        seenOutputPaths.add(outputPath);
        drafts.push({
          id: path.relative(ROOT, draftAbsolute).replace(/\\/g, '/'),
          draftPath: path.relative(ROOT, draftAbsolute).replace(/\\/g, '/'),
          outputPath,
          contentType,
          fileName,
          urlSlug,
          title: post.title || fileName,
          date: post.date || '',
          hasDraft: true,
          htmlExists: fs.existsSync(path.join(ROOT, outputPath)),
        });
      } catch (error) {
        drafts.push({
          id: path.relative(ROOT, draftAbsolute).replace(/\\/g, '/'),
          draftPath: path.relative(ROOT, draftAbsolute).replace(/\\/g, '/'),
          outputPath: '',
          contentType: 'blog',
          fileName: entry.name,
          title: `Unreadable draft: ${entry.name}`,
          date: '',
          hasDraft: true,
          htmlExists: false,
          error: error.message,
        });
      }
    }
  }

  for (const file of listGeneratedHtmlFiles()) {
    if (seenOutputPaths.has(file.outputPath)) continue;
    drafts.push({
      id: file.outputPath,
      draftPath: '',
      outputPath: file.outputPath,
      contentType: file.contentType,
      fileName: file.fileName,
      urlSlug: file.urlSlug || '',
      title: file.fileName,
      date: '',
      hasDraft: false,
      htmlExists: true,
    });
  }

  return drafts.sort((a, b) => String(b.date || b.fileName).localeCompare(String(a.date || a.fileName)));
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
    const indexOutput = runStaticIndexBaker();
    let gitOutput = '';
    if (input.autoPush) {
      gitOutput = autoPushGeneratedPost(post, draftPath, input.commitMessage);
    }
    sendJson(res, 200, {
      ok: true,
      draftPath: path.relative(ROOT, draftPath).replace(/\\/g, '/'),
      outputPath: outputPathFor(post),
      previewUrl: `/${outputPathFor(post)}`,
      generatorOutput: [output, indexOutput].filter(Boolean).join('\n'),
      gitOutput,
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || String(error) });
  }
}

async function handleListPosts(req, res) {
  sendJson(res, 200, { ok: true, posts: listManagedPosts() });
}

async function handleGitStatus(req, res) {
  sendJson(res, 200, { ok: true, git: checkGitConnection() });
}

async function handleGitLogin(req, res) {
  try {
    const loginOutput = runGitHubLogin();
    sendJson(res, 200, {
      ok: true,
      loginOutput,
      git: checkGitConnection(),
    });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error.message || String(error),
      git: checkGitConnection(),
    });
  }
}

async function handleLoadPost(req, res) {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const draftPath = url.searchParams.get('draftPath');
    if (!draftPath) throw new Error('draftPath is required.');
    const { absolute, relative } = resolveDraftPath(draftPath);
    const post = readJsonFile(absolute);
    sendJson(res, 200, { ok: true, draftPath: relative, post });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || String(error) });
  }
}

async function handleUploadAssets(req, res) {
  try {
    const body = await readRequestBody(req);
    const input = JSON.parse(body || '{}');
    const files = Array.isArray(input.files) ? input.files : [];
    if (!files.length) throw new Error('No files uploaded.');
    const target = uploadTargetFor(input.kind === 'video' ? 'video' : 'image');
    fs.mkdirSync(target.dir, { recursive: true });
    const saved = files.map((file, index) => {
      const { bytes } = decodeDataUrl(file.dataUrl);
      const ext = path.extname(String(file.name || '')).toLowerCase();
      if (ext && !target.exts.includes(ext)) {
        throw new Error(`Unsupported file type: ${file.name}`);
      }
      const fallbackExt = target.exts[0];
      const fileName = safeAssetFileName(`${index}-${file.name || 'asset'}`, ext || fallbackExt);
      const absolute = path.join(target.dir, fileName);
      fs.writeFileSync(absolute, bytes);
      return {
        name: file.name || fileName,
        path: `${target.rel}/${fileName}`,
      };
    });
    sendJson(res, 200, { ok: true, files: saved });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || String(error) });
  }
}

async function handleDeletePost(req, res) {
  try {
    const body = await readRequestBody(req);
    const input = JSON.parse(body || '{}');
    const removed = [];
    const gitPaths = [];
    let title = input.outputPath || input.draftPath || 'static page';

    if (input.outputPath) {
      const { absolute, relative } = resolveGeneratedHtmlPath(input.outputPath);
      if (fs.existsSync(absolute)) {
        fs.rmSync(absolute, { force: true });
        removed.push(relative);
        gitPaths.push(relative);
      }
    }

    if (input.draftPath) {
      const { absolute, relative } = resolveDraftPath(input.draftPath);
      if (fs.existsSync(absolute)) {
        try {
          const post = readJsonFile(absolute);
          title = post.title || title;
        } catch {}
        fs.rmSync(absolute, { force: true });
        removed.push(relative);
        gitPaths.push(relative);
      }
    }

    if (!removed.length) throw new Error('Nothing was deleted.');

    let gitOutput = '';
    const indexOutput = runStaticIndexBaker();

    if (input.autoPush) {
      const message = String(input.commitMessage || `Delete static page: ${title}`).trim();
      gitOutput = stageCommitPush([...gitPaths, 'blog.html', 'case-studies.html', 'index.html'], message);
    }

    sendJson(res, 200, { ok: true, removed, gitOutput });
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
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.ogg' || ext === '.ogv') return 'video/ogg';
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
  return options.map(([value, labelEn, labelZh]) => {
    const zh = labelZh || labelEn;
    return `<option value="${escapeHtml(value)}" data-label-en="${escapeHtml(labelEn)}" data-label-zh="${escapeHtml(zh)}">${escapeHtml(zh)}</option>`;
  }).join('');
}

function renderApp() {
  const today = new Date().toISOString().slice(0, 10);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>静态 Blog / Case 生成器</title>
  <style>
    :root { color-scheme: light; --bg:#f4f6f8; --panel:#fff; --ink:#172033; --muted:#64748b; --line:#d9e1ec; --brand:#d71920; }
    body { margin:0; font-family: Arial, Helvetica, sans-serif; background:var(--bg); color:var(--ink); }
    header { padding:28px 34px; background:#111827; color:#fff; }
    .topbar { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; }
    header h1 { margin:0 0 8px; font-size:26px; }
    header p { margin:0; color:#cbd5e1; }
    .language-switch { display:flex; align-items:center; gap:10px; color:#e2e8f0; min-width:180px; }
    .language-switch select { border-color:rgba(255,255,255,.25); background:#1f2937; color:#fff; }
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
    .manage-box { display:grid; gap:10px; padding:12px; border:1px solid var(--line); border-radius:14px; background:#f8fafc; }
    .manage-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .danger { background:#fee2e2; color:#991b1b; }
    .template-box { display:grid; gap:14px; padding:14px; border:1px solid var(--line); border-radius:14px; background:#f8fafc; }
    .template-box h3 { margin:0; font-size:16px; }
    .template-box textarea { min-height:96px; }
    .advanced-html { border:1px dashed var(--line); border-radius:14px; padding:12px 14px; background:#fff; }
    .advanced-html summary { cursor:pointer; font-weight:800; color:#26344d; }
    .advanced-html label { margin-top:12px; }
    .inline-upload { display:flex; gap:8px; align-items:center; }
    .inline-upload input[type="text"] { flex:1; }
    .upload-button { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:0 12px; border:1px solid var(--line); border-radius:12px; background:#eef2ff; color:#1e3a8a; font-weight:800; cursor:pointer; white-space:nowrap; }
    .file-input-hidden { display:none; }
    .related-picker { display:grid; gap:8px; }
    .related-picker-row { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; }
    .related-selected { min-height:46px; display:flex; flex-wrap:wrap; gap:8px; padding:10px; border:1px solid var(--line); border-radius:12px; background:#f8fafc; }
    .related-selected:empty::before { content:attr(data-empty); color:var(--muted); font-weight:400; }
    .related-chip { display:inline-flex; align-items:center; gap:8px; max-width:100%; padding:7px 10px; border-radius:999px; background:#e8eef7; color:#24324a; font-size:12px; font-weight:700; }
    .related-chip span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:360px; }
    .related-chip button { padding:0; width:20px; height:20px; border-radius:50%; background:#cbd5e1; color:#1f2937; line-height:20px; }
    .hidden-data-field { display:none; }
    .git-status { margin:18px 28px 0; padding:14px 16px; border-radius:14px; border:1px solid var(--line); background:#fff7ed; color:#9a3412; display:flex; justify-content:space-between; gap:14px; align-items:center; }
    .git-status.ready { background:#ecfdf5; color:#065f46; }
    .git-status.error { background:#fff1f2; color:#991b1b; }
    .git-status.checking { background:#eff6ff; color:#1e3a8a; }
    .git-status strong { display:block; margin-bottom:3px; }
    .git-status small { display:block; color:inherit; opacity:.82; white-space:pre-wrap; }
    .git-status button { white-space:nowrap; background:#111827; color:#fff; }
    @media (max-width: 980px) { main { grid-template-columns:1fr; padding:16px; } }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <div>
        <h1 data-i18n="appTitle">闈欐€?Blog / Case 鐢熸垚鍣</h1>
        <p data-i18n-html="appDesc">鏈湴鐢熸垚鐪熷疄 HTML 椤甸潰銆侭log 杈撳嚭鍒?<strong>blog/</strong>锛孋ase 杈撳嚭鍒?<strong>cases/</strong>銆備笉浼氳嚜鍔ㄨ鍙栨垨瑕嗙洊 KV銆</p>
      </div>
      <label class="language-switch">
        <span data-i18n="language">璇█</span>
        <select id="studioLanguage">
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
  </header>
  <div id="gitStatus" class="git-status checking">
    <div>
      <strong data-i18n="gitChecking">姝ｅ湪妫€鏌?GitHub 杩炴帴...</strong>
      <small data-i18n="gitCheckingHint">濡傛灉娌℃湁杩炴帴锛屼細鍏堣浣犵櫥褰?GitHub銆</small>
    </div>
    <button type="button" id="gitLoginButton" hidden data-i18n="gitLogin">鐧诲綍 GitHub</button>
  </div>
  <main>
    <section class="panel">
      <h2 data-i18n="postFields">鏂囩珷瀛楁</h2>
      <form id="postForm">
        <label><span data-i18n="contentType">鍐呭绫诲瀷</span>
          <select name="contentType" id="contentType">
            <option value="blog">Blog</option>
            <option value="case">Case</option>
          </select>
        </label>
        <div class="manage-box">
          <label><span data-i18n="existingPages">宸叉湁 Blog / Case 椤甸潰</span>
            <select id="existingPostSelect">
              <option value="" data-i18n="loadingPages">姝ｅ湪鍔犺浇宸叉湁椤甸潰...</option>
            </select>
            <span class="hint" data-i18n="existingHint">鏈?JSON 鑽夌鐨勯〉闈㈠彲浠ュ姞杞藉埌琛ㄥ崟缁х画淇敼锛涘彧鏈?HTML 鐨勯〉闈篃鍙互鍒犻櫎銆</span>
          </label>
          <div class="manage-actions">
            <button class="ghost" type="button" id="refreshPosts" data-i18n="refreshList">鍒锋柊鍒楄〃</button>
            <button class="ghost" type="button" id="loadPost" data-i18n="loadSelected">鍔犺浇閫変腑</button>
            <button class="danger" type="button" id="deletePost" data-i18n="deleteSelected">鍒犻櫎閫変腑</button>
          </div>
        </div>
        <div>
          <label><span data-i18n="fileName">鏂囦欢鍚</span>
            <input name="fileName" id="fileName" placeholder="my-article.html" data-i18n-placeholder="fileNamePlaceholder">
            <span class="hint" data-i18n="fileNameHint">鍙～鏂囦欢鍚嶃€傝矾寰勪細鑷姩鍙樻垚 blog/my-article.html 鎴?cases/my-article.html銆</span>
          </label>
        </div>
        <div>
          <label><span data-i18n="urlSlug">URL Slug</span>
            <input name="urlSlug" id="urlSlug" placeholder="chemical-asrs-project-malaysia" data-i18n-placeholder="urlSlugPlaceholder">
            <span class="hint" data-i18n="urlSlugHint">鐢ㄤ簬鐢熸垚 /blog/slug/ 鎴?/case/slug/锛岀暀绌烘椂鑷姩鏍规嵁鏂囦欢鍚嶇敓鎴愩€</span>
          </label>
        </div>
        <div class="path-preview" id="pathPreview">blog/my-article.html</div>
        <label><span data-i18n="title">鏍囬</span><input name="title" id="title" required></label>
        <label><span data-i18n="summary">鎽樿</span><textarea name="summary"></textarea></label>
        <div class="row">
          <label><span data-i18n="industry">琛屼笟</span><select name="industry" id="industry">${renderOptions(INDUSTRIES)}</select></label>
          <label><span data-i18n="solution">鏂规</span><select name="solution" id="solution">${renderOptions(SOLUTIONS)}</select></label>
        </div>
        <div class="row">
          <label><span data-i18n="country">鍥藉</span><select name="country" id="country">${renderOptions(COUNTRIES)}</select></label>
          <label><span data-i18n="blogCategory">Blog 鍒嗙被</span><select name="blogCategory" id="blogCategory">${renderOptions(BLOG_CATEGORIES)}</select></label>
        </div>
        <div class="row">
          <label><span data-i18n="functionCategory">鍔熻兘鍒嗙被</span><select name="functionCategory" id="functionCategory">${renderOptions(FUNCTIONS)}</select></label>
          <label><span data-i18n="application">搴旂敤鍦烘櫙</span><select name="application" id="application">${renderOptions(APPLICATIONS)}</select></label>
        </div>
        <label><span data-i18n="technology">鏍稿績鎶€鏈</span>
          <textarea name="technology" placeholder="ASRS&#10;Stacker Crane&#10;WMS" data-i18n-placeholder="technologyPlaceholder"></textarea>
          <span class="hint" data-i18n="technologyHint">姣忚涓€涓紝鍙～鍐?ASRS銆丄GV銆丄MR銆丆onveyor銆丷obot銆乄MS銆丮ES 绛夈€</span>
        </label>
        <div class="row">
          <label><span data-i18n="coverImage">???? URL / ????</span>
            <div class="inline-upload"><input name="coverImage" placeholder="?????? images/example.webp / https://..." data-i18n-placeholder="coverImagePlaceholder"><button class="upload-button" type="button" id="chooseCoverImageButton" data-i18n="chooseImage">????</button><input class="file-input-hidden" id="coverImageFile" type="file" accept="image/*"></div>
          </label>
          <label><span data-i18n="youtubeUrl">?? URL / ????</span>
            <div class="inline-upload"><input name="youtubeUrl" placeholder="?????? videos/demo.mp4 / YouTube URL" data-i18n-placeholder="youtubePlaceholder"><button class="upload-button" type="button" id="chooseProjectVideoButton" data-i18n="chooseVideo">????</button><input class="file-input-hidden" id="projectVideoFile" type="file" accept="video/*"></div>
          </label>
        </div>
        <label><span data-i18n="projectImages">???? / ??</span>
          <textarea name="projectImages" placeholder="images/layout.webp | Layout Drawing&#10;images/site-photo.webp | Site Photo" data-i18n-placeholder="projectImagesPlaceholder"></textarea>
          <span class="hint" data-i18n="projectImagesHint">???????????? URL???????? | ???</span>
          <button class="upload-button" type="button" id="chooseProjectImagesButton" data-i18n="chooseProjectImages">Choose Project Images</button><input class="file-input-hidden" id="projectImagesFile" type="file" accept="image/*" multiple>
        </label>
        <label><span data-i18n="challenge">Challenge 瀹㈡埛鐥涚偣</span><textarea name="challenge"></textarea></label>
        <label><span data-i18n="solutionDetail">Solution 瑙ｅ喅鏂规</span><textarea name="solutionDetail"></textarea></label>
        <label><span data-i18n="layoutWorkflow">Workflow & Layout 娴佺▼涓庡竷灞€</span><textarea name="layoutWorkflow"></textarea></label>
        <label><span data-i18n="results">Results & ROI 閲忓寲缁撴灉</span>
          <textarea name="results" placeholder="Storage Capacity +300%&#10;Labor Cost -60%&#10;Inventory Accuracy 99.9%" data-i18n-placeholder="resultsPlaceholder"></textarea>
        </label>
        <label><span data-i18n="equipmentList">Equipment List 椤圭洰璁惧</span>
          <textarea name="equipmentList" placeholder="Stacker Crane&#10;Conveyor System&#10;WMS" data-i18n-placeholder="equipmentPlaceholder"></textarea>
        </label>
        <div class="row">
          <label><span data-i18n="author">浣滆€</span><input name="author" value="13ASRS"></label>
          <label><span data-i18n="date">鏃ユ湡</span><input name="date" type="date" value="${today}"></label>
        </div>
        <label><span data-i18n="seoTitle">SEO 鏍囬</span><input name="seoTitle"></label>
        <label><span data-i18n="seoDescription">SEO 鎻忚堪</span><input name="seoDescription"></label>
        <label><span data-i18n="keywords">SEO 鍏抽敭璇</span>
          <textarea name="keywords" placeholder="Chemical Warehouse Automation&#10;ASRS Malaysia" data-i18n-placeholder="keywordsPlaceholder"></textarea>
        </label>
        <label><span data-i18n="relatedProjects">相关案例</span>
          <div class="related-picker">
            <div class="related-picker-row">
              <select id="relatedCaseSelect"></select>
              <button class="ghost" type="button" id="addRelatedCase" data-i18n="addRelated">加入</button>
            </div>
            <div id="relatedCaseSelected" class="related-selected" data-empty="还没有选择相关案例"></div>
          </div>
          <textarea class="hidden-data-field" name="relatedProjects"></textarea>
          <span class="hint" data-i18n="relatedCasesHint">从已生成的 Case 页面中选择，点“加入”后会放到下面框中。</span>
        </label>
        <label><span data-i18n="relatedSolutions">相关 Blog</span>
          <div class="related-picker">
            <div class="related-picker-row">
              <select id="relatedBlogSelect"></select>
              <button class="ghost" type="button" id="addRelatedBlog" data-i18n="addRelated">加入</button>
            </div>
            <div id="relatedBlogSelected" class="related-selected" data-empty="还没有选择相关 Blog"></div>
          </div>
          <textarea class="hidden-data-field" name="relatedSolutions"></textarea>
          <span class="hint" data-i18n="relatedBlogsHint">从已生成的 Blog 页面中选择，点“加入”后会放到下面框中。</span>
        </label>
        <div class="template-box">
          <h3 data-i18n="bodyTemplateTitle">????</h3>
          <span class="hint" data-i18n="bodyTemplateHint">???????????????????? HTML?</span>
          <label><span data-i18n="bodyOverview">???? / ????</span><textarea id="bodyOverview" data-template-field="overview"></textarea></label>
          <label><span data-i18n="bodyKeyPoints">????</span>
            <textarea id="bodyKeyPoints" data-template-field="keyPoints" data-i18n-placeholder="bodyKeyPointsPlaceholder" placeholder="??????"></textarea>
            <span class="hint" data-i18n="bodyKeyPointsHint">????????????????</span>
          </label>
          <label><span data-i18n="bodyProcess">???? / ???</span><textarea id="bodyProcess" data-template-field="process"></textarea></label>
          <label><span data-i18n="bodyValue">???? / ??</span><textarea id="bodyValue" data-template-field="value"></textarea></label>
          <label><span data-i18n="bodyConclusion">?? / ??</span><textarea id="bodyConclusion" data-template-field="conclusion"></textarea></label>
        </div>
        <details class="advanced-html">
          <summary data-i18n="advancedHtmlToggle">????? / ????? HTML</summary>
          <label><span data-i18n="contentHtml">?? HTML</span>
            <textarea name="contentHtml" id="contentHtml" required><h2>????</h2>
<p>??????????</p>
<h2>????</h2>
<p>?????????????</p></textarea>
          </label>
        </details>
        <label><input name="force" type="checkbox" style="width:auto;"> <span data-i18n="overwriteExisting">???? HTML ??</span></label>
        <label><input name="autoPush" type="checkbox" style="width:auto;"> <span data-i18n="autoPush">??????????? GitHub</span></label>
        <label><span data-i18n="commitMessage">????</span>
          <input name="commitMessage" placeholder="Add new Blog or Case page" data-i18n-placeholder="commitMessagePlaceholder">
          <span class="hint" data-i18n="commitHint">???????????????</span>
        </label>
        <div class="actions">
          <button class="primary" type="submit" data-i18n="generate">????</button>
          <button class="ghost" type="button" id="fillExample" data-i18n="fillExample">????</button>
        </div>
        <div id="status" class="status" data-i18n="ready">?????</div>
      </form>
    </section>
    <section class="panel">
      <h2 data-i18n="preview">??</h2>
      <div class="preview">
        <iframe id="previewFrame" title="??????" data-i18n-title="previewFrameTitle"></iframe>
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById('postForm');
    const statusBox = document.getElementById('status');
    const frame = document.getElementById('previewFrame');
    const contentType = document.getElementById('contentType');
    const fileName = document.getElementById('fileName');
    const urlSlug = document.getElementById('urlSlug');
    const pathPreview = document.getElementById('pathPreview');
    const existingPostSelect = document.getElementById('existingPostSelect');
    const studioLanguage = document.getElementById('studioLanguage');
    const gitStatus = document.getElementById('gitStatus');
    const gitLoginButton = document.getElementById('gitLoginButton');
    const titleInput = document.getElementById('title');
    const relatedCaseSelect = document.getElementById('relatedCaseSelect');
    const relatedBlogSelect = document.getElementById('relatedBlogSelect');
    const addRelatedCaseButton = document.getElementById('addRelatedCase');
    const addRelatedBlogButton = document.getElementById('addRelatedBlog');
    const relatedCaseSelected = document.getElementById('relatedCaseSelected');
    const relatedBlogSelected = document.getElementById('relatedBlogSelected');
    const templateFields = {
      overview: document.getElementById('bodyOverview'),
      keyPoints: document.getElementById('bodyKeyPoints'),
      process: document.getElementById('bodyProcess'),
      value: document.getElementById('bodyValue'),
      conclusion: document.getElementById('bodyConclusion'),
    };
    let existingPosts = [];
    let currentUiLanguage = localStorage.getItem('staticPostStudioLanguage') || 'zh';
    let gitConnectionReady = false;
    let lastGitStatus = null;
    let syncingTemplate = false;
    let htmlManuallyEdited = false;

    const I18N = {
      zh: {
        appTitle: '静态 Blog / Case 生成器',
        appDesc: '本地生成真实 HTML 页面。Blog 输出到 <strong>blog/</strong>，Case 输出到 <strong>case/</strong>。不会自动读取或覆盖 KV。',
        language: '语言',
        postFields: '内容字段',
        existingPages: '已有 Blog / Case 页面',
        loadingPages: '正在加载已有页面...',
        existingHint: '有 JSON 草稿的页面可以加载到表单继续修改；只有 HTML 的页面也可以删除。',
        refreshList: '刷新列表',
        loadSelected: '加载选中',
        deleteSelected: '删除选中',
        contentType: '内容类型',
        fileName: '文件名',
        fileNamePlaceholder: '留空时根据标题生成',
        fileNameHint: '可留空。留空时会根据标题自动生成安全文件名。',
        urlSlug: 'URL Slug',
        urlSlugPlaceholder: '留空时根据标题生成',
        urlSlugHint: '用于生成 /blog/slug/ 或 /case/slug/，留空时自动根据标题生成。',
        title: '标题',
        summary: '摘要',
        industry: '行业',
        solution: '方案',
        country: '国家',
        blogCategory: 'Blog 分类',
        functionCategory: '功能分类',
        application: '应用场景',
        technology: '核心技术',
        technologyPlaceholder: 'ASRS\\nStacker Crane\\nWMS',
        technologyHint: '每行一个，可填写 ASRS、AGV、AMR、Conveyor、Robot、WMS、MES 等。',
        coverImage: '封面图片 URL / 本地文件',
        coverImagePlaceholder: '可留空，或粘贴图片 URL / images/example.webp',
        youtubeUrl: '视频 URL / 本地文件',
        youtubePlaceholder: '可留空，或粘贴视频 URL / videos/demo.mp4 / YouTube URL',
        projectImages: '项目图片 / 图纸',
        projectImagesPlaceholder: 'images/layout.webp | Layout Drawing\\nimages/site-photo.webp | Site Photo',
        projectImagesHint: '每行一个，支持粘贴多个图片 URL，也支持多选本地图片上传。格式：图片路径 | 说明。',
        chooseImage: '选择图片',
        chooseVideo: '选择视频',
        chooseProjectImages: '选择多张项目图片',
        challenge: 'Challenge 客户痛点',
        solutionDetail: 'Solution 解决方案',
        layoutWorkflow: 'Workflow & Layout 流程与布局',
        results: 'Results & ROI 量化结果',
        resultsPlaceholder: 'Storage Capacity +300%\\nLabor Cost -60%\\nInventory Accuracy 99.9%',
        equipmentList: 'Equipment List 项目设备',
        equipmentPlaceholder: 'Stacker Crane\\nConveyor System\\nWMS',
        author: '作者',
        date: '日期',
        seoTitle: 'SEO 标题',
        seoDescription: 'SEO 描述',
        keywords: 'SEO 关键词',
        keywordsPlaceholder: 'Chemical Warehouse Automation\\nASRS Malaysia',
        relatedProjects: '相关案例',
        relatedCasesHint: '从已生成的 Case 页面中多选。',
        relatedSolutions: '相关 Blog',
        relatedBlogsHint: '从已生成的 Blog 页面中多选。',
        bodyTemplateTitle: '正文模板',
        bodyTemplateHint: '直接填写下面这些段落，工具会自动生成正文 HTML。',
        bodyOverview: '项目概览 / 文章开头',
        bodyKeyPoints: '核心要点',
        bodyKeyPointsPlaceholder: '每行一个要点',
        bodyKeyPointsHint: '可选。每行会自动变成一个列表项。',
        bodyProcess: '实施过程 / 工作流程',
        bodyValue: '客户价值 / 结果',
        bodyConclusion: '结尾 / 下一步',
        advancedHtmlToggle: '高级：查看 / 编辑生成的 HTML',
        contentHtml: '正文 HTML',
        overwriteExisting: '如果 HTML 已存在，覆盖它',
        autoPush: '生成后自动提交并推送到 GitHub',
        commitMessage: '提交说明',
        commitMessagePlaceholder: '添加静态 Blog / Case 页面',
        commitHint: '可选。留空时会自动根据标题生成提交说明。',
        generate: '生成静态页面',
        fillExample: '填入示例',
        ready: '准备就绪。',
        preview: '预览',
        previewFrameTitle: '生成页面预览',
        noGeneratedPages: '没有找到已生成页面',
        noGeneratedPagesForType: '当前内容类型还没有已生成页面',
        editable: '可编辑',
        htmlOnly: '仅 HTML',
        missingHtml: ' / HTML 缺失',
        couldNotLoadPages: '无法加载已有页面。',
        selectFirst: '请先选择一个已有页面。',
        noDraft: '这个页面没有 JSON 草稿，无法自动加载编辑。你可以删除它，或手动重新创建。',
        loaded: '已加载：',
        deleteConfirm: '确定删除 ',
        deleteFailed: '删除失败。',
        deleted: '已删除：',
        listRefreshed: '已有页面列表已刷新。',
        generating: '正在生成...',
        generateFailed: '生成失败',
        generated: '已生成：',
        draftJson: 'JSON 草稿：',
        git: 'Git：',
        gitChecking: '正在检查 GitHub 连接...',
        gitCheckingHint: '如果没有连接，会先让你登录 GitHub。',
        gitReady: 'GitHub 已连接',
        gitReadyHint: '可以自动提交并推送到 GitHub。',
        gitNeedsSync: 'GitHub 已连接，但需要先同步',
        gitNeedsSyncHint: '远程仓库有新提交，本地分支落后。请先同步远程更新后再自动推送。',
        gitNotReady: 'GitHub 未连接',
        gitNotReadyHint: '请先登录 GitHub，否则自动推送不会成功。',
        gitLogin: '登录 GitHub',
        gitLoggingIn: '正在打开 GitHub 登录...',
        gitLoginFailed: 'GitHub 登录失败',
        gitStatusFailed: '无法检查 GitHub 连接',
        sampleTitle: '示例自动化案例',
        sampleSummary: '这是一个用于生成静态案例页面的简短摘要。',
        sampleSeoTitle: '示例自动化案例 | 13ASRS',
        sampleSeoDescription: '由本地生成器创建的静态案例页面。'
      },
      en: {
        appTitle: 'Static Blog / Case Studio',
        appDesc: 'Generate real local HTML pages. Blog pages go to <strong>blog/</strong>; case pages go to <strong>cases/</strong>. KV data is not read or overwritten automatically.',
        language: 'Language',
        postFields: 'Post Fields',
        existingPages: 'Existing Blog / Case Pages',
        loadingPages: 'Loading existing pages...',
        existingHint: 'Draft-backed pages can be loaded into this form. HTML-only pages can still be deleted.',
        refreshList: 'Refresh List',
        loadSelected: 'Load Selected',
        deleteSelected: 'Delete Selected',
        contentType: 'Content Type',
        fileName: 'File Name',
        fileNamePlaceholder: 'my-article.html',
        fileNameHint: 'Used for drafts and compatibility. The actual URL prefers URL Slug.',
        urlSlug: 'URL Slug',
        urlSlugPlaceholder: 'chemical-asrs-project-malaysia',
        urlSlugHint: 'Generates /blog/slug/ or /case/slug/. If empty, it is generated from the file name.',
        title: 'Title',
        summary: 'Summary',
        industry: 'Industry',
        solution: 'Solution',
        country: 'Country',
        blogCategory: 'Blog Category',
        functionCategory: 'Function',
        application: 'Application',
        technology: 'Technology',
        technologyPlaceholder: 'ASRS\\nStacker Crane\\nWMS',
        technologyHint: 'One item per line, such as ASRS, AGV, AMR, Conveyor, Robot, WMS, and MES.',
        coverImage: 'Cover Image URL / Local File',
        coverImagePlaceholder: 'Optional. Use images/example.webp or https://...',
        youtubeUrl: 'Video URL / Local File',
        youtubePlaceholder: 'Optional. Use videos/demo.mp4 or a YouTube URL',
        projectImages: 'Project Images / Drawings',
        projectImagesPlaceholder: 'images/layout.webp | Layout Drawing\\nimages/site-photo.webp | Site Photo',
        projectImagesHint: 'One item per line. Supports local image paths or URLs. Format: image path | description.',
        chooseImage: 'Choose Image',
        chooseVideo: 'Choose Video',
        chooseProjectImages: 'Choose Project Images',
        challenge: 'Challenge',
        solutionDetail: 'Solution',
        layoutWorkflow: 'Workflow & Layout',
        results: 'Results & ROI',
        resultsPlaceholder: 'Storage Capacity +300%\\nLabor Cost -60%\\nInventory Accuracy 99.9%',
        equipmentList: 'Equipment List',
        equipmentPlaceholder: 'Stacker Crane\\nConveyor System\\nWMS',
        author: 'Author',
        date: 'Date',
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Description',
        keywords: 'SEO Keywords',
        keywordsPlaceholder: 'Chemical Warehouse Automation\\nASRS Malaysia',
        relatedProjects: 'Related Projects',
        relatedCasesHint: 'Select one or more generated case pages.',
        relatedProjectsPlaceholder: 'Title | case-studies.html\\nAnother title | cases/example.html',
        relatedHint: 'One item per line. Format: Title | link. A title-only line is also allowed.',
        relatedSolutions: 'Related Blog',
        relatedBlogsHint: 'Select one or more generated blog pages.',
        relatedSolutionsPlaceholder: 'ASRS Warehouse Solution | solutions.html#asrs',
        bodyTemplateTitle: 'Body Template',
        bodyTemplateHint: 'Fill these plain-text sections. The tool will generate the HTML body automatically.',
        bodyOverview: 'Project Overview / Opening',
        bodyKeyPoints: 'Key Points',
        bodyKeyPointsPlaceholder: 'One key point per line',
        bodyKeyPointsHint: 'Optional. Each line becomes one list item.',
        bodyProcess: 'Implementation / Workflow',
        bodyValue: 'Customer Value / Results',
        bodyConclusion: 'Conclusion / Next Step',
        advancedHtmlToggle: 'Advanced: view / edit generated HTML',
        contentHtml: 'Content HTML',
        overwriteExisting: 'Overwrite existing HTML if it already exists',
        autoPush: 'Commit and push this generated page to GitHub after generation',
        commitMessage: 'Commit Message',
        commitMessagePlaceholder: 'Add static blog page',
        commitHint: 'Optional. If empty, the tool uses a message based on the title.',
        generate: 'Generate Static Page',
        fillExample: 'Fill Example',
        ready: 'Ready.',
        preview: 'Preview',
        previewFrameTitle: 'Generated page preview',
        noGeneratedPages: 'No generated pages found',
        noGeneratedPagesForType: 'No generated pages found for the selected content type',
        editable: 'editable',
        htmlOnly: 'html only',
        missingHtml: ' / missing HTML',
        couldNotLoadPages: 'Could not load existing pages.',
        selectFirst: 'Select an existing page first.',
        noDraft: 'This page has no JSON draft, so it cannot be loaded for editing. You can delete it or recreate it manually.',
        loaded: 'Loaded: ',
        deleteConfirm: 'Delete ',
        deleteFailed: 'Delete failed.',
        deleted: 'Deleted:',
        listRefreshed: 'Existing page list refreshed.',
        generating: 'Generating...',
        generateFailed: 'Generate failed',
        generated: 'Generated: ',
        draftJson: 'Draft JSON: ',
        git: 'Git:',
        gitChecking: 'Checking GitHub connection...',
        gitCheckingHint: 'If it is not connected, the tool will ask you to log in first.',
        gitReady: 'GitHub connected',
        gitReadyHint: 'Automatic commit and push can be used.',
        gitNeedsSync: 'GitHub connected, but sync is required',
        gitNeedsSyncHint: 'The remote repository has new commits and this local branch is behind. Pull or sync remote changes before auto-push.',
        gitNotReady: 'GitHub not connected',
        gitNotReadyHint: 'Log in to GitHub first, otherwise auto-push will fail.',
        gitLogin: 'Log in to GitHub',
        gitLoggingIn: 'Opening GitHub login...',
        gitLoginFailed: 'GitHub login failed',
        gitStatusFailed: 'Could not check GitHub connection',
        sampleTitle: 'Sample Automation Case Study',
        sampleSummary: 'A short summary for the generated static case page.',
        sampleSeoTitle: 'Sample Automation Case Study | 13ASRS',
        sampleSeoDescription: 'Static case page generated from the local post studio.',
      }
    };

    const DEFAULT_CONTENT_HTML = {
      zh: '<h2>Project Overview</h2>\\n<p>Write the article or case study body here.</p>\\n<h2>Solution</h2>\\n<p>Describe the solution, equipment, workflow, and customer value.</p>',
      en: '<h2>Project Overview</h2>\\n<p>Write the article or case study body here.</p>\\n<h2>Solution</h2>\\n<p>Describe the solution, equipment, workflow, and customer value.</p>'
    };

    const DEFAULT_BODY_TEMPLATE = {
      zh: {
        overview: 'Describe the background, customer situation, and project goal.',
        keyPoints: 'Customer challenge\\nAutomation solution used\\nBusiness value delivered',
        process: 'Describe the layout, workflow, equipment coordination, and implementation process.',
        value: 'Describe improvements such as capacity, labor savings, accuracy, or ROI.',
        conclusion: 'Summarize why this project is useful for similar customers and invite consultation.'
      },
      en: {
        overview: 'Describe the background, customer situation, and project goal.',
        keyPoints: 'Customer challenge\\nAutomation solution used\\nBusiness value delivered',
        process: 'Describe the layout, workflow, equipment coordination, and implementation process.',
        value: 'Describe improvements such as capacity, labor savings, accuracy, or ROI.',
        conclusion: 'Summarize why this project is useful for similar customers and invite consultation.'
      }
    };

    function tr(key) {
      if (key === 'addRelated') return currentUiLanguage === 'en' ? 'Add' : '加入';
      return (I18N[currentUiLanguage] && I18N[currentUiLanguage][key]) || I18N.en[key] || key;
    }

    function escapeHtmlClient(value) {
      return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
    }

    function paragraphsFromText(value) {
      return String(value || '')
        .split(/\\n{2,}/)
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => '<p>' + escapeHtmlClient(part).replace(/\\n/g, '<br>') + '</p>')
        .join('\\n');
    }

    function listFromLines(value) {
      const items = String(value || '').split(/\\r?\\n/).map(line => line.trim()).filter(Boolean);
      if (!items.length) return '';
      return '<ul>\\n' + items.map(item => '  <li>' + escapeHtmlClient(item) + '</li>').join('\\n') + '\\n</ul>';
    }

    function hasTemplateContent() {
      return Object.values(templateFields).some(field => field.value.trim());
    }

    function buildContentHtmlFromTemplate() {
      const headings = {
        overview: 'Project Overview',
        keyPoints: 'Key Points',
        process: 'Implementation & Workflow',
        value: 'Customer Value & Results',
        conclusion: 'Conclusion'
      };
      const sections = [];
      const overview = paragraphsFromText(templateFields.overview.value);
      if (overview) sections.push('<h2>' + headings.overview + '</h2>\\n' + overview);
      const keyPoints = listFromLines(templateFields.keyPoints.value);
      if (keyPoints) sections.push('<h2>' + headings.keyPoints + '</h2>\\n' + keyPoints);
      const process = paragraphsFromText(templateFields.process.value);
      if (process) sections.push('<h2>' + headings.process + '</h2>\\n' + process);
      const value = paragraphsFromText(templateFields.value.value);
      if (value) sections.push('<h2>' + headings.value + '</h2>\\n' + value);
      const conclusion = paragraphsFromText(templateFields.conclusion.value);
      if (conclusion) sections.push('<h2>' + headings.conclusion + '</h2>\\n' + conclusion);
      return sections.join('\\n');
    }

    function syncTemplateToHtml() {
      if (syncingTemplate) return;
      syncingTemplate = true;
      try {
        form.contentHtml.value = buildContentHtmlFromTemplate() || DEFAULT_CONTENT_HTML[currentUiLanguage];
        htmlManuallyEdited = false;
      } finally {
        syncingTemplate = false;
      }
    }

    function fillDefaultBodyTemplate(force) {
      const defaults = DEFAULT_BODY_TEMPLATE[currentUiLanguage] || DEFAULT_BODY_TEMPLATE.zh;
      if (!force && hasTemplateContent()) return;
      Object.entries(defaults).forEach(([key, value]) => {
        templateFields[key].value = value;
      });
      syncTemplateToHtml();
    }

    function plainTextFromHtml(html) {
      const div = document.createElement('div');
      div.innerHTML = html || '';
      return div.textContent.replace(/\s+/g, ' ').trim();
    }

    function setTemplateFromHtml(html) {
      Object.values(templateFields).forEach(field => { field.value = ''; });
      const parser = new DOMParser();
      const doc = parser.parseFromString('<div>' + (html || '') + '</div>', 'text/html');
      const headings = Array.from(doc.body.querySelectorAll('h2, h3'));
      if (!headings.length) {
        templateFields.overview.value = plainTextFromHtml(html);
        htmlManuallyEdited = false;
        return;
      }
      const buckets = ['overview', 'keyPoints', 'process', 'value', 'conclusion'];
      headings.slice(0, buckets.length).forEach((heading, index) => {
        const parts = [];
        let node = heading.nextElementSibling;
        while (node && !/^H[23]$/i.test(node.tagName)) {
          if (node.tagName === 'UL' || node.tagName === 'OL') {
            parts.push(Array.from(node.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean).join('\\n'));
          } else {
            parts.push(node.textContent.trim());
          }
          node = node.nextElementSibling;
        }
        templateFields[buckets[index]].value = parts.filter(Boolean).join('\\n\\n');
      });
      htmlManuallyEdited = false;
    }

    function applyUiLanguage(language) {
      currentUiLanguage = language === 'en' ? 'en' : 'zh';
      localStorage.setItem('staticPostStudioLanguage', currentUiLanguage);
      studioLanguage.value = currentUiLanguage;
      document.documentElement.lang = currentUiLanguage === 'zh' ? 'zh-CN' : 'en';
      document.title = tr('appTitle');
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = tr(el.dataset.i18n);
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = tr(el.dataset.i18nHtml);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = tr(el.dataset.i18nPlaceholder);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = tr(el.dataset.i18nTitle);
      });
      document.querySelectorAll('option[data-label-en][data-label-zh]').forEach(option => {
        option.textContent = currentUiLanguage === 'en' ? option.dataset.labelEn : option.dataset.labelZh;
      });
      const currentHtml = form.contentHtml.value.trim();
      const isDefaultHtml = Object.values(DEFAULT_CONTENT_HTML).includes(currentHtml);
      if (!hasTemplateContent() && (!currentHtml || isDefaultHtml)) {
        fillDefaultBodyTemplate(false);
      } else if (hasTemplateContent() && !htmlManuallyEdited) {
        syncTemplateToHtml();
      }
      if (lastGitStatus) {
        renderGitStatus(lastGitStatus);
      }
    }

    function setGitChecking(message) {
      gitConnectionReady = false;
      gitStatus.className = 'git-status checking';
      gitStatus.querySelector('strong').textContent = message || tr('gitChecking');
      gitStatus.querySelector('small').textContent = tr('gitCheckingHint');
      gitLoginButton.hidden = true;
      gitLoginButton.disabled = true;
    }

    function renderGitStatus(git) {
      lastGitStatus = git;
      gitConnectionReady = Boolean(git && git.ok);
      const needsSync = Boolean(git && git.reason === 'behind');
      gitStatus.className = 'git-status ' + (gitConnectionReady ? 'ready' : needsSync ? 'checking' : 'error');
      gitStatus.querySelector('strong').textContent = gitConnectionReady ? tr('gitReady') : needsSync ? tr('gitNeedsSync') : tr('gitNotReady');
      const location = [git && git.remote, git && git.branch ? '(' + git.branch + ')' : ''].filter(Boolean).join(' ');
      const details = git && git.details ? '\\n' + git.details : '';
      gitStatus.querySelector('small').textContent = gitConnectionReady
        ? [tr('gitReadyHint'), location].filter(Boolean).join(' ')
        : needsSync
        ? [tr('gitNeedsSyncHint'), git && git.message, location].filter(Boolean).join('\\n') + details
        : [tr('gitNotReadyHint'), git && git.message, location].filter(Boolean).join('\\n') + details;
      gitLoginButton.hidden = gitConnectionReady || needsSync;
      gitLoginButton.disabled = false;
      gitLoginButton.textContent = tr('gitLogin');
    }

    async function refreshGitStatus() {
      setGitChecking();
      const response = await fetch('/api/git-status', { cache: 'no-store' });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || tr('gitStatusFailed'));
      renderGitStatus(result.git);
      return result.git;
    }

    async function loginGitHub() {
      setGitChecking(tr('gitLoggingIn'));
      try {
        const response = await fetch('/api/git-login', { method: 'POST' });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || tr('gitLoginFailed'));
        renderGitStatus(result.git);
      } catch (error) {
        gitConnectionReady = false;
        gitStatus.className = 'git-status error';
        gitStatus.querySelector('strong').textContent = tr('gitLoginFailed');
        gitStatus.querySelector('small').textContent = error.message;
        gitLoginButton.hidden = false;
        gitLoginButton.disabled = false;
        gitLoginButton.textContent = tr('gitLogin');
      }
    }

    function slugifyClient(value, fallback) {
      const slug = String(value || '')
        .trim()
        .replace(/\\.html$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return slug || fallback || 'my-article';
    }

    function normalizedFileName() {
      const raw = fileName.value.trim() || titleInput.value.trim() || 'my-article.html';
      return raw.toLowerCase().endsWith('.html') ? raw : raw + '.html';
    }

    function normalizedSlug() {
      const raw = urlSlug.value.trim() || fileName.value.trim() || titleInput.value.trim() || normalizedFileName().replace(/\\.html$/i, '');
      return slugifyClient(raw, 'my-article');
    }

    let fileNameWasAuto = !fileName.value.trim();
    let slugWasAuto = !urlSlug.value.trim();

    function syncTitleDerivedPaths() {
      const titleSlug = slugifyClient(titleInput.value, '');
      if (fileNameWasAuto && titleSlug) {
        fileName.value = titleSlug + '.html';
      }
      if (slugWasAuto && titleSlug) {
        urlSlug.value = titleSlug;
      }
      updatePathPreview();
    }

    function updatePathPreview() {
      const dir = contentType.value === 'case' ? 'case' : 'blog';
      pathPreview.textContent = dir + '/' + normalizedSlug() + '/index.html';
    }

    contentType.addEventListener('change', () => {
      updatePathPreview();
      renderPostList();
      renderRelatedPickers();
    });
    titleInput.addEventListener('input', syncTitleDerivedPaths);
    fileName.addEventListener('input', () => {
      fileNameWasAuto = !fileName.value.trim();
      updatePathPreview();
    });
    urlSlug.addEventListener('input', () => {
      slugWasAuto = !urlSlug.value.trim();
      updatePathPreview();
    });
    updatePathPreview();
    studioLanguage.addEventListener('change', async () => {
      applyUiLanguage(studioLanguage.value);
      try {
        await refreshPostList();
      } catch {}
    });
    applyUiLanguage(currentUiLanguage);
    gitLoginButton.addEventListener('click', () => loginGitHub());
    refreshGitStatus().catch(error => {
      gitConnectionReady = false;
      gitStatus.className = 'git-status error';
      gitStatus.querySelector('strong').textContent = tr('gitStatusFailed');
      gitStatus.querySelector('small').textContent = error.message;
      gitLoginButton.hidden = false;
      gitLoginButton.disabled = false;
      gitLoginButton.textContent = tr('gitLogin');
    });

    function relatedToTextarea(value) {
      if (!Array.isArray(value)) return value || '';
      return value.map(item => {
        if (typeof item === 'string') return item;
        return item.href ? item.title + ' | ' + item.href : item.title;
      }).filter(Boolean).join('\\n');
    }

    function listToTextarea(value) {
      if (!Array.isArray(value)) return value || '';
      return value.filter(Boolean).join('\\n');
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
    }

    async function uploadFiles(fileList, kind) {
      const files = Array.from(fileList || []);
      if (!files.length) return [];
      statusBox.className = 'status';
      statusBox.textContent = currentUiLanguage === 'en' ? 'Uploading local files...' : '姝ｅ湪涓婁紶鏈湴鏂囦欢...';
      const payloadFiles = [];
      for (const file of files) {
        payloadFiles.push({
          name: file.name,
          type: file.type,
          dataUrl: await readFileAsDataUrl(file),
        });
      }
      const response = await fetch('/api/upload-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, files: payloadFiles }),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || 'Upload failed.');
      statusBox.className = 'status';
      statusBox.textContent = (currentUiLanguage === 'en' ? 'Uploaded: ' : '宸蹭笂浼狅細') + result.files.map(file => file.path).join('\\n');
      return result.files || [];
    }

    function appendTextareaLines(textarea, lines) {
      const existing = textarea.value.trim();
      textarea.value = [existing, ...lines].filter(Boolean).join('\\n');
    }

    function relatedLineFromPost(post) {
      const href = String(post.outputPath || '').replace(/index\\.html$/i, '');
      return (post.title || post.fileName || href) + (href ? ' | ' + href : '');
    }

    function selectValuesFromTextarea(textarea) {
      return new Set(String(textarea.value || '').split(/\\r?\\n/).map(line => line.trim()).filter(Boolean));
    }

    function relatedRowsFromTextarea(textarea) {
      return Array.from(selectValuesFromTextarea(textarea));
    }

    function labelFromRelatedLine(line) {
      return String(line || '').split('|')[0].trim() || line;
    }

    function syncRelatedSelectedBox(textarea, container) {
      const rows = relatedRowsFromTextarea(textarea);
      container.innerHTML = rows.map(row => (
        '<span class="related-chip" data-value="' + escapeHtmlClient(row) + '">' +
          '<span title="' + escapeHtmlClient(row) + '">' + escapeHtmlClient(labelFromRelatedLine(row)) + '</span>' +
          '<button type="button" data-remove-related="' + escapeHtmlClient(row) + '" aria-label="Remove">×</button>' +
        '</span>'
      )).join('');
    }

    function syncRelatedUi(textarea, container) {
      textarea.value = relatedRowsFromTextarea(textarea).join('\\n');
      syncRelatedSelectedBox(textarea, container);
    }

    function addRelatedFromSelect(select, textarea, container) {
      const value = select.value;
      if (!value) return;
      const selected = selectValuesFromTextarea(textarea);
      selected.add(value);
      textarea.value = Array.from(selected).join('\\n');
      syncRelatedUi(textarea, container);
    }

    function removeRelatedValue(textarea, container, value) {
      textarea.value = relatedRowsFromTextarea(textarea).filter(row => row !== value).join('\\n');
      syncRelatedUi(textarea, container);
    }

    function renderRelatedPicker(select, textarea, type, emptyLabel) {
      const selected = selectValuesFromTextarea(textarea);
      const posts = existingPosts.filter(post => post.contentType === type && post.htmlExists);
      if (!posts.length) {
        select.innerHTML = '<option value="">' + emptyLabel + '</option>';
        select.disabled = true;
        return;
      }
      select.disabled = false;
      select.innerHTML = posts.map(post => {
        const value = relatedLineFromPost(post);
        const label = post.title || post.outputPath || post.fileName;
        return '<option value="' + escapeHtmlClient(value) + '">' + (selected.has(value) ? '✓ ' : '') + escapeHtmlClient(label) + '</option>';
      }).join('');
    }

    function renderRelatedPickers() {
      renderRelatedPicker(relatedCaseSelect, form.relatedProjects, 'case', tr('noGeneratedPagesForType'));
      renderRelatedPicker(relatedBlogSelect, form.relatedSolutions, 'blog', tr('noGeneratedPagesForType'));
      relatedCaseSelected.dataset.empty = currentUiLanguage === 'en' ? 'No related case selected yet' : '还没有选择相关案例';
      relatedBlogSelected.dataset.empty = currentUiLanguage === 'en' ? 'No related blog selected yet' : '还没有选择相关 Blog';
      addRelatedCaseButton.disabled = relatedCaseSelect.disabled;
      addRelatedBlogButton.disabled = relatedBlogSelect.disabled;
      syncRelatedUi(form.relatedProjects, relatedCaseSelected);
      syncRelatedUi(form.relatedSolutions, relatedBlogSelected);
    }

    function getSelectedPost() {
      return existingPosts.find(post => post.id === existingPostSelect.value);
    }

    function renderPostList() {
      const selectedId = existingPostSelect.value;
      const selectedType = contentType.value === 'case' ? 'case' : 'blog';
      const visiblePosts = existingPosts.filter(post => post.contentType === selectedType);
      if (!visiblePosts.length) {
        existingPostSelect.innerHTML = '<option value="">' + tr('noGeneratedPagesForType') + '</option>';
        return;
      }
      existingPostSelect.innerHTML = visiblePosts.map(post => {
        const state = post.hasDraft ? tr('editable') : tr('htmlOnly');
        const missing = post.htmlExists ? '' : tr('missingHtml');
        return '<option value="' + post.id + '">' + post.contentType.toUpperCase() + ' - ' + post.outputPath + ' - ' + state + missing + '</option>';
      }).join('');
      if (visiblePosts.some(post => post.id === selectedId)) {
        existingPostSelect.value = selectedId;
      }
    }

    async function refreshPostList() {
      const response = await fetch('/api/posts');
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || tr('couldNotLoadPages'));
      existingPosts = result.posts || [];
      if (!existingPosts.length) {
        existingPostSelect.innerHTML = '<option value="">' + tr('noGeneratedPages') + '</option>';
        renderRelatedPickers();
        return;
      }
      renderPostList();
      renderRelatedPickers();
    }

    async function loadSelectedPost() {
      const selected = getSelectedPost();
      if (!selected) throw new Error(tr('selectFirst'));
      if (!selected.hasDraft || !selected.draftPath) {
        throw new Error(tr('noDraft'));
      }
      const response = await fetch('/api/post?draftPath=' + encodeURIComponent(selected.draftPath));
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || tr('couldNotLoadPages'));
      const post = result.post;
      form.contentType.value = post.contentType || 'blog';
      form.fileName.value = post.fileName || '';
      form.urlSlug.value = post.urlSlug || '';
      form.title.value = post.title || '';
      form.summary.value = post.summary || '';
      form.coverImage.value = post.coverImage || '';
      form.country.value = post.country || '';
      form.industry.value = post.industry || '';
      form.solution.value = post.solution || '';
      form.functionCategory.value = post.functionCategory || '';
      form.application.value = post.application || '';
      form.blogCategory.value = post.blogCategory || '';
      form.technology.value = listToTextarea(post.technology);
      form.youtubeUrl.value = post.youtubeUrl || '';
      form.author.value = post.author || '13ASRS';
      form.date.value = post.date || '';
      form.seoTitle.value = post.seoTitle || '';
      form.seoDescription.value = post.seoDescription || '';
      form.keywords.value = listToTextarea(post.keywords);
      form.projectImages.value = listToTextarea(post.projectImages);
      form.challenge.value = post.challenge || '';
      form.solutionDetail.value = post.solutionDetail || '';
      form.layoutWorkflow.value = post.layoutWorkflow || '';
      form.results.value = listToTextarea(post.results);
      form.equipmentList.value = listToTextarea(post.equipmentList);
      form.relatedProjects.value = relatedToTextarea(post.relatedProjects);
      form.relatedSolutions.value = relatedToTextarea(post.relatedSolutions);
      renderRelatedPickers();
      syncRelatedUi(form.relatedProjects, relatedCaseSelected);
      syncRelatedUi(form.relatedSolutions, relatedBlogSelected);
      form.contentHtml.value = post.contentHtml || '';
      setTemplateFromHtml(form.contentHtml.value);
      form.force.checked = true;
      fileNameWasAuto = false;
      slugWasAuto = false;
      updatePathPreview();
      renderPostList();
      frame.src = selected.outputPath ? '/' + selected.outputPath + '?t=' + Date.now() : '';
      statusBox.className = 'status';
      statusBox.textContent = tr('loaded') + selected.outputPath;
    }

    async function deleteSelectedPost() {
      const selected = getSelectedPost();
      if (!selected) throw new Error(tr('selectFirst'));
      if (!confirm(tr('deleteConfirm') + (selected.outputPath || selected.draftPath) + '?')) return;
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftPath: selected.draftPath,
          outputPath: selected.outputPath,
          autoPush: form.autoPush.checked,
          commitMessage: form.commitMessage.value
        })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || tr('deleteFailed'));
      statusBox.className = 'status';
      statusBox.textContent = tr('deleted') + '\\n' + result.removed.join('\\n') + (result.gitOutput ? '\\n\\n' + tr('git') + '\\n' + result.gitOutput : '');
      frame.removeAttribute('src');
      await refreshPostList();
    }

    document.getElementById('refreshPosts').addEventListener('click', async () => {
      try {
        await refreshPostList();
        statusBox.className = 'status';
        statusBox.textContent = tr('listRefreshed');
      } catch (error) {
        statusBox.className = 'status error';
        statusBox.textContent = error.message;
      }
    });
    document.getElementById('loadPost').addEventListener('click', () => loadSelectedPost().catch(error => {
      statusBox.className = 'status error';
      statusBox.textContent = error.message;
    }));
    document.getElementById('deletePost').addEventListener('click', () => deleteSelectedPost().catch(error => {
      statusBox.className = 'status error';
      statusBox.textContent = error.message;
    }));
    Object.values(templateFields).forEach(field => {
      field.addEventListener('input', syncTemplateToHtml);
    });
    form.contentHtml.addEventListener('input', () => {
      if (!syncingTemplate) htmlManuallyEdited = true;
    });
    addRelatedCaseButton.addEventListener('click', () => addRelatedFromSelect(relatedCaseSelect, form.relatedProjects, relatedCaseSelected));
    addRelatedBlogButton.addEventListener('click', () => addRelatedFromSelect(relatedBlogSelect, form.relatedSolutions, relatedBlogSelected));
    relatedCaseSelected.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-related]');
      if (button) removeRelatedValue(form.relatedProjects, relatedCaseSelected, button.dataset.removeRelated);
    });
    relatedBlogSelected.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-related]');
      if (button) removeRelatedValue(form.relatedSolutions, relatedBlogSelected, button.dataset.removeRelated);
    });
    const coverImageFileInput = document.getElementById('coverImageFile');
    const projectVideoFileInput = document.getElementById('projectVideoFile');
    const projectImagesFileInput = document.getElementById('projectImagesFile');
    document.getElementById('chooseCoverImageButton').addEventListener('click', () => coverImageFileInput.click());
    document.getElementById('chooseProjectVideoButton').addEventListener('click', () => projectVideoFileInput.click());
    document.getElementById('chooseProjectImagesButton').addEventListener('click', () => projectImagesFileInput.click());
    coverImageFileInput.addEventListener('change', event => {
      uploadFiles(event.target.files, 'image')
        .then(files => {
          if (files[0]) form.coverImage.value = files[0].path;
          event.target.value = '';
        })
        .catch(error => {
          statusBox.className = 'status error';
          statusBox.textContent = error.message;
        });
    });
    projectVideoFileInput.addEventListener('change', event => {
      uploadFiles(event.target.files, 'video')
        .then(files => {
          if (files[0]) form.youtubeUrl.value = files[0].path;
          event.target.value = '';
        })
        .catch(error => {
          statusBox.className = 'status error';
          statusBox.textContent = error.message;
        });
    });
    projectImagesFileInput.addEventListener('change', event => {
      uploadFiles(event.target.files, 'image')
        .then(files => {
          appendTextareaLines(form.projectImages, files.map(file => file.path + ' | ' + String(file.name || '').replace(/\\.[^.]+$/, '')));
          event.target.value = '';
        })
        .catch(error => {
          statusBox.className = 'status error';
          statusBox.textContent = error.message;
        });
    });
    refreshPostList().catch(error => {
      existingPostSelect.innerHTML = '<option value="">' + tr('couldNotLoadPages') + '</option>';
      statusBox.className = 'status error';
      statusBox.textContent = error.message;
    });

    document.getElementById('fillExample').addEventListener('click', () => {
      contentType.value = 'case';
      fileName.value = 'sample-automation-case.html';
      urlSlug.value = 'sample-automation-case';
      form.title.value = tr('sampleTitle');
      form.summary.value = tr('sampleSummary');
      form.coverImage.value = 'system-acr.webp';
      form.country.value = 'malaysia';
      form.industry.value = 'manufacturing-industrial';
      form.solution.value = 'smart-factory';
      form.functionCategory.value = 'warehouse-automation';
      form.application.value = 'warehouse-storage';
      form.blogCategory.value = '';
      form.technology.value = 'ASRS\\nStacker Crane\\nWMS';
      form.projectImages.value = 'images/layout.webp | Layout Drawing\\nimages/site-photo.webp | Site Photo';
      form.challenge.value = 'Customer needed higher storage density, lower labor dependency, and more accurate inventory control.';
      form.solutionDetail.value = '13ASRS designed an automated warehouse system with stacker cranes, conveyors, and WMS integration.';
      form.layoutWorkflow.value = 'Inbound pallets are scanned, conveyed to storage, retrieved by WMS orders, and dispatched through outbound lanes.';
      form.results.value = 'Storage Capacity +300%\\nLabor Cost -60%\\nInventory Accuracy 99.9%';
      form.equipmentList.value = 'Stacker Crane\\nConveyor System\\nWMS';
      form.seoTitle.value = tr('sampleSeoTitle');
      form.seoDescription.value = tr('sampleSeoDescription');
      fillDefaultBodyTemplate(true);
      updatePathPreview();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      statusBox.className = 'status';
      statusBox.textContent = tr('generating');
      if (!htmlManuallyEdited && hasTemplateContent()) {
        syncTemplateToHtml();
      }
      syncRelatedUi(form.relatedProjects, relatedCaseSelected);
      syncRelatedUi(form.relatedSolutions, relatedBlogSelected);
      if (!fileName.value.trim() || !urlSlug.value.trim()) {
        syncTitleDerivedPaths();
      }
      const data = Object.fromEntries(new FormData(form).entries());
      data.force = form.force.checked;
      data.autoPush = form.autoPush.checked;
      try {
        if (data.autoPush) {
          const git = await refreshGitStatus();
          if (!git || !git.ok) {
            throw new Error([git && git.message, git && git.details].filter(Boolean).join('\\n') || tr('gitNotReadyHint'));
          }
        }
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || tr('generateFailed'));
        statusBox.textContent = tr('generated') + result.outputPath + '\\n' + tr('draftJson') + result.draftPath + '\\n' + result.generatorOutput + (result.gitOutput ? '\\n\\n' + tr('git') + '\\n' + result.gitOutput : '');
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

function openBrowser(url) {
  if (!SHOULD_OPEN_BROWSER) return;
  const command = process.platform === 'win32'
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'GET' && req.url.startsWith('/api/posts')) return handleListPosts(req, res);
  if (req.method === 'GET' && req.url.startsWith('/api/post')) return handleLoadPost(req, res);
  if (req.method === 'GET' && req.url === '/api/git-status') return handleGitStatus(req, res);
  if (req.method === 'POST' && req.url === '/api/git-login') return handleGitLogin(req, res);
  if (req.method === 'POST' && req.url === '/api/upload-assets') return handleUploadAssets(req, res);
  if (req.method === 'POST' && req.url === '/api/delete') return handleDeletePost(req, res);
  if (req.method === 'GET') return serveWorkspaceFile(req, res);
  send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
});

const studioUrl = `http://127.0.0.1:${PORT}`;

server.on('error', error => {
  if (error && error.code === 'EADDRINUSE') {
    console.log(`Static Post Studio is already running at ${studioUrl}`);
    console.log('Opening the existing page instead of starting a second server.');
    openBrowser(studioUrl);
    process.exit(0);
    return;
  }
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = studioUrl;
  console.log(`Static Post Studio running at ${url}`);
  console.log('Press Ctrl+C to stop.');
  openBrowser(url);
});

