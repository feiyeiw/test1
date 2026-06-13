#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.STATIC_POST_STUDIO_PORT || 8791);
const DRAFT_DIR = path.join(ROOT, 'content', 'static-posts', 'generated');
const SHOULD_OPEN_BROWSER = process.env.STATIC_POST_STUDIO_OPEN !== '0';
const GIT_CHECK_TIMEOUT_MS = 15_000;
const GIT_LOGIN_TIMEOUT_MS = 180_000;

const INDUSTRIES = [
  ['', 'Select industry', '请选择行业'],
  ['all-industries', 'All Industries', '全部行业'],
  ['food-beverage', 'Food & Beverage', '食品饮料'],
  ['pharmaceutical-biotech', 'Pharmaceutical & Biotech', '医药与生物科技'],
  ['packaging-printing', 'Packaging & Printing', '包装与印刷'],
  ['cold-chain-frozen-food', 'Cold Chain / Frozen Food', '冷链 / 冷冻食品'],
  ['logistics-distribution', 'Logistics & Distribution', '物流配送'],
  ['ecommerce-fulfillment', 'E-commerce Fulfillment', '电商履约'],
  ['manufacturing-industrial', 'Manufacturing / Industrial', '制造业 / 工业'],
  ['chemical-petrochemical', 'Chemical & Petrochemical', '化工与石化'],
  ['agriculture-grain-processing', 'Agriculture & Grain Processing', '农业与粮食加工'],
  ['automotive-transportation', 'Automotive & Transportation', '汽车与交通'],
  ['electronics-semiconductors', 'Electronics & Semiconductors', '电子与半导体'],
  ['health-personal-care', 'Health & Personal Care', '健康与个护'],
  ['household-products', 'Household Products', '家居日用品'],
  ['other', 'Other', '其他'],
];

const SOLUTIONS = [
  ['', 'Select solution', '请选择方案'],
  ['all-solutions', 'All Solutions', '全部方案'],
  ['asrs', 'ASRS / Automated Storage & Retrieval Systems', 'ASRS / 自动化立体仓储系统'],
  ['conveyor-transport', 'Conveyor Systems / Automated Transport', '输送系统 / 自动化搬运'],
  ['smart-factory', 'Smart Factory / Factory Automation', '智能工厂 / 工厂自动化'],
  ['production-line', 'Production Line Automation', '生产线自动化'],
  ['packaging-automation', 'Packaging Automation', '包装自动化'],
  ['filling-bottling', 'Filling & Bottling Systems', '灌装与瓶装系统'],
  ['printing-inkjet-flexo-ci', 'Printing / Inkjet / Flexo / CI Printing', '印刷 / 喷码 / 柔印 / CI 印刷'],
  ['film-blowing-extrusion', 'Film Blowing / Film Extrusion', '吹膜 / 薄膜挤出'],
  ['cold-storage-automation', 'Cold Storage / Low-Temperature Automation', '冷库 / 低温自动化'],
  ['material-pallet-handling', 'Material Handling / Pallet Handling', '物料搬运 / 托盘处理'],
  ['wms-wes', 'Intelligent WMS / WES Integration', '智能 WMS / WES 集成'],
  ['erp-mes-monitoring', 'ERP / MES / Production Monitoring', 'ERP / MES / 生产监控'],
  ['robotics-integration', 'Robotics Integration', '机器人集成'],
  ['laser-industrial-machining', 'Laser Processing / Industrial Machining', '激光加工 / 工业加工'],
  ['other-industrial-automation', 'Other Industrial Automation Solutions', '其他工业自动化方案'],
];

const COUNTRIES = [
  ['', 'Select country', '请选择国家'],
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
  ['', 'Select function', '请选择功能分类'],
  ['warehouse-automation', 'Warehouse Automation', '仓储自动化'],
  ['factory-intralogistics', 'Factory Intralogistics', '厂内物流'],
  ['production-automation', 'Production Automation', '生产自动化'],
  ['packaging-automation', 'Packaging Automation', '包装自动化'],
  ['process-automation', 'Process Automation', '工艺自动化'],
  ['smart-factory', 'Smart Factory', '智能工厂'],
];

const APPLICATIONS = [
  ['', 'Select application', '请选择应用场景'],
  ['warehouse-storage', 'Warehouse & Storage', '仓储与存储'],
  ['packaging', 'Packaging', '包装'],
  ['production-lines', 'Production Lines', '生产线'],
  ['mixing-processing', 'Mixing & Processing', '混合与加工'],
  ['filling-bottling', 'Filling & Bottling', '灌装与瓶装'],
  ['material-handling', 'Material Handling', '物料搬运'],
  ['inspection-testing', 'Inspection & Testing', '检测与测试'],
  ['printing-labeling', 'Printing & Labeling', '印刷与贴标'],
  ['loading-dispatch', 'Loading & Dispatch', '装车与发运'],
];

const BLOG_CATEGORIES = [
  ['', 'Select blog category', '请选择 Blog 分类'],
  ['solutions', 'Solutions', '解决方案'],
  ['cost-roi', 'Cost & ROI', '成本收益'],
  ['design-guides', 'Design Guides', '设计指南'],
  ['industry-applications', 'Industry Applications', '行业应用'],
  ['technology-insights', 'Technology Insights', '技术洞察'],
  ['project-planning', 'Project Planning', '项目规划'],
  ['buyer-guides', 'Buyer Guides', '采购指南'],
  ['best-practices', 'Best Practices', '最佳实践'],
  ['troubleshooting', 'Troubleshooting', '问题解决'],
  ['trends-innovations', 'Trends & Innovations', '趋势分析'],
  ['compliance-safety', 'Compliance & Safety', '法规安全'],
  ['case-insights', 'Case Insights', '案例拆解'],
  ['maintenance-operations', 'Maintenance & Operations', '维护运营'],
  ['productivity-improvement', 'Productivity Improvement', '效率提升'],
  ['sustainability-energy-saving', 'Sustainability & Energy Saving', '节能减排'],
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

function draftPathFor(post) {
  const base = post.fileName.replace(/\.html$/i, '.json');
  const prefix = post.contentType === 'case' ? 'case' : 'blog';
  return path.join(DRAFT_DIR, `${prefix}-${base}`);
}

function cleanPostPayload(input) {
  const contentType = input.contentType === 'case' ? 'case' : 'blog';
  const fileName = normalizeFileName(input.fileName);
  const urlSlug = normalizeSlug(input.urlSlug, fileName);
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
  const title = String(input.title || '').trim();
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

  return {
    ok: false,
    remote,
    branch,
    message: 'GitHub is not connected or this account cannot push to the repository.',
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
  const paths = [outputPath, draftRelPath, 'blog.html', 'case-studies.html', 'index.html'];
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
    runStaticIndexBaker();
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
        <h1 data-i18n="appTitle">静态 Blog / Case 生成器</h1>
        <p data-i18n-html="appDesc">本地生成真实 HTML 页面。Blog 输出到 <strong>blog/</strong>，Case 输出到 <strong>cases/</strong>。不会自动读取或覆盖 KV。</p>
      </div>
      <label class="language-switch">
        <span data-i18n="language">语言</span>
        <select id="studioLanguage">
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
  </header>
  <div id="gitStatus" class="git-status checking">
    <div>
      <strong data-i18n="gitChecking">正在检查 GitHub 连接...</strong>
      <small data-i18n="gitCheckingHint">如果没有连接，会先让你登录 GitHub。</small>
    </div>
    <button type="button" id="gitLoginButton" hidden data-i18n="gitLogin">登录 GitHub</button>
  </div>
  <main>
    <section class="panel">
      <h2 data-i18n="postFields">文章字段</h2>
      <form id="postForm">
        <label><span data-i18n="contentType">内容类型</span>
          <select name="contentType" id="contentType">
            <option value="blog">Blog</option>
            <option value="case">Case</option>
          </select>
        </label>
        <div class="manage-box">
          <label><span data-i18n="existingPages">已有 Blog / Case 页面</span>
            <select id="existingPostSelect">
              <option value="" data-i18n="loadingPages">正在加载已有页面...</option>
            </select>
            <span class="hint" data-i18n="existingHint">有 JSON 草稿的页面可以加载到表单继续修改；只有 HTML 的页面也可以删除。</span>
          </label>
          <div class="manage-actions">
            <button class="ghost" type="button" id="refreshPosts" data-i18n="refreshList">刷新列表</button>
            <button class="ghost" type="button" id="loadPost" data-i18n="loadSelected">加载选中</button>
            <button class="danger" type="button" id="deletePost" data-i18n="deleteSelected">删除选中</button>
          </div>
        </div>
        <div>
          <label><span data-i18n="fileName">文件名</span>
            <input name="fileName" id="fileName" placeholder="my-article.html" data-i18n-placeholder="fileNamePlaceholder" required>
            <span class="hint" data-i18n="fileNameHint">只填文件名。路径会自动变成 blog/my-article.html 或 cases/my-article.html。</span>
          </label>
        </div>
        <div>
          <label><span data-i18n="urlSlug">URL Slug</span>
            <input name="urlSlug" id="urlSlug" placeholder="chemical-asrs-project-malaysia" data-i18n-placeholder="urlSlugPlaceholder">
            <span class="hint" data-i18n="urlSlugHint">用于生成 /blog/slug/ 或 /case/slug/，留空时自动根据文件名生成。</span>
          </label>
        </div>
        <div class="path-preview" id="pathPreview">blog/my-article.html</div>
        <label><span data-i18n="title">标题</span><input name="title" id="title" required></label>
        <label><span data-i18n="summary">摘要</span><textarea name="summary"></textarea></label>
        <div class="row">
          <label><span data-i18n="industry">行业</span><select name="industry" id="industry">${renderOptions(INDUSTRIES)}</select></label>
          <label><span data-i18n="solution">方案</span><select name="solution" id="solution">${renderOptions(SOLUTIONS)}</select></label>
        </div>
        <div class="row">
          <label><span data-i18n="country">国家</span><select name="country" id="country">${renderOptions(COUNTRIES)}</select></label>
          <label><span data-i18n="blogCategory">Blog 分类</span><select name="blogCategory" id="blogCategory">${renderOptions(BLOG_CATEGORIES)}</select></label>
        </div>
        <div class="row">
          <label><span data-i18n="functionCategory">功能分类</span><select name="functionCategory" id="functionCategory">${renderOptions(FUNCTIONS)}</select></label>
          <label><span data-i18n="application">应用场景</span><select name="application" id="application">${renderOptions(APPLICATIONS)}</select></label>
        </div>
        <label><span data-i18n="technology">核心技术</span>
          <textarea name="technology" placeholder="ASRS&#10;Stacker Crane&#10;WMS" data-i18n-placeholder="technologyPlaceholder"></textarea>
          <span class="hint" data-i18n="technologyHint">每行一个，可填写 ASRS、AGV、AMR、Conveyor、Robot、WMS、MES 等。</span>
        </label>
        <div class="row">
          <label><span data-i18n="coverImage">封面图片 URL / 本地文件</span><input name="coverImage" placeholder="可留空，或填 images/example.webp / https://..." data-i18n-placeholder="coverImagePlaceholder"></label>
          <label><span data-i18n="youtubeUrl">视频 URL / 本地文件</span><input name="youtubeUrl" placeholder="可留空，或填 videos/demo.mp4 / YouTube URL" data-i18n-placeholder="youtubePlaceholder"></label>
        </div>
        <label><span data-i18n="projectImages">项目图片 / 图纸</span>
          <textarea name="projectImages" placeholder="images/layout.webp | Layout Drawing&#10;images/site-photo.webp | Site Photo" data-i18n-placeholder="projectImagesPlaceholder"></textarea>
          <span class="hint" data-i18n="projectImagesHint">每行一个，支持本地图片或 URL。格式：图片路径 | 说明。</span>
        </label>
        <label><span data-i18n="challenge">Challenge 客户痛点</span><textarea name="challenge"></textarea></label>
        <label><span data-i18n="solutionDetail">Solution 解决方案</span><textarea name="solutionDetail"></textarea></label>
        <label><span data-i18n="layoutWorkflow">Workflow & Layout 流程与布局</span><textarea name="layoutWorkflow"></textarea></label>
        <label><span data-i18n="results">Results & ROI 量化结果</span>
          <textarea name="results" placeholder="Storage Capacity +300%&#10;Labor Cost -60%&#10;Inventory Accuracy 99.9%" data-i18n-placeholder="resultsPlaceholder"></textarea>
        </label>
        <label><span data-i18n="equipmentList">Equipment List 项目设备</span>
          <textarea name="equipmentList" placeholder="Stacker Crane&#10;Conveyor System&#10;WMS" data-i18n-placeholder="equipmentPlaceholder"></textarea>
        </label>
        <div class="row">
          <label><span data-i18n="author">作者</span><input name="author" value="13ASRS"></label>
          <label><span data-i18n="date">日期</span><input name="date" type="date" value="${today}"></label>
        </div>
        <label><span data-i18n="seoTitle">SEO 标题</span><input name="seoTitle"></label>
        <label><span data-i18n="seoDescription">SEO 描述</span><input name="seoDescription"></label>
        <label><span data-i18n="keywords">SEO 关键词</span>
          <textarea name="keywords" placeholder="Chemical Warehouse Automation&#10;ASRS Malaysia" data-i18n-placeholder="keywordsPlaceholder"></textarea>
        </label>
        <label><span data-i18n="relatedProjects">相关案例</span>
          <textarea name="relatedProjects" placeholder="标题 | case-studies.html&#10;另一个标题 | cases/example.html" data-i18n-placeholder="relatedProjectsPlaceholder"></textarea>
          <span class="hint" data-i18n="relatedHint">每行一个，格式：标题 | 链接。只写标题也可以。</span>
        </label>
        <label><span data-i18n="relatedSolutions">相关方案</span>
          <textarea name="relatedSolutions" placeholder="ASRS 仓储方案 | solutions.html#asrs" data-i18n-placeholder="relatedSolutionsPlaceholder"></textarea>
        </label>
        <div class="template-box">
          <h3 data-i18n="bodyTemplateTitle">正文模板</h3>
          <span class="hint" data-i18n="bodyTemplateHint">直接填写下面这些段落，工具会自动生成正文 HTML。</span>
          <label><span data-i18n="bodyOverview">项目概览 / 文章开头</span><textarea id="bodyOverview" data-template-field="overview"></textarea></label>
          <label><span data-i18n="bodyKeyPoints">核心要点</span>
            <textarea id="bodyKeyPoints" data-template-field="keyPoints" data-i18n-placeholder="bodyKeyPointsPlaceholder" placeholder="每行一个要点"></textarea>
            <span class="hint" data-i18n="bodyKeyPointsHint">可选。每行会自动变成一个列表项。</span>
          </label>
          <label><span data-i18n="bodyProcess">实施过程 / 工作流程</span><textarea id="bodyProcess" data-template-field="process"></textarea></label>
          <label><span data-i18n="bodyValue">客户价值 / 结果</span><textarea id="bodyValue" data-template-field="value"></textarea></label>
          <label><span data-i18n="bodyConclusion">结尾 / 下一步</span><textarea id="bodyConclusion" data-template-field="conclusion"></textarea></label>
        </div>
        <details class="advanced-html">
          <summary data-i18n="advancedHtmlToggle">高级：查看 / 编辑生成的 HTML</summary>
          <label><span data-i18n="contentHtml">正文 HTML</span>
            <textarea name="contentHtml" id="contentHtml" required><h2>项目概览</h2>
<p>在这里填写文章或案例正文。</p>
<h2>解决方案</h2>
<p>描述方案、设备、流程和客户价值。</p></textarea>
          </label>
        </details>
        <label><input name="force" type="checkbox" style="width:auto;"> <span data-i18n="overwriteExisting">如果 HTML 已存在，覆盖它</span></label>
        <label><input name="autoPush" type="checkbox" style="width:auto;"> <span data-i18n="autoPush">生成后自动提交并推送到 GitHub</span></label>
        <label><span data-i18n="commitMessage">提交说明</span>
          <input name="commitMessage" placeholder="添加静态 Blog 页面" data-i18n-placeholder="commitMessagePlaceholder">
          <span class="hint" data-i18n="commitHint">可选。留空时会自动根据标题生成提交说明。</span>
        </label>
        <div class="actions">
          <button class="primary" type="submit" data-i18n="generate">生成静态页面</button>
          <button class="ghost" type="button" id="fillExample" data-i18n="fillExample">填入示例</button>
        </div>
        <div id="status" class="status" data-i18n="ready">准备就绪。</div>
      </form>
    </section>
    <section class="panel">
      <h2 data-i18n="preview">预览</h2>
      <div class="preview">
        <iframe id="previewFrame" title="生成页面预览" data-i18n-title="previewFrameTitle"></iframe>
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
        appDesc: '本地生成真实 HTML 页面。Blog 输出到 <strong>blog/</strong>，Case 输出到 <strong>cases/</strong>。不会自动读取或覆盖 KV。',
        language: '语言',
        postFields: '文章字段',
        existingPages: '已有 Blog / Case 页面',
        loadingPages: '正在加载已有页面...',
        existingHint: '有 JSON 草稿的页面可以加载到表单继续修改；只有 HTML 的页面也可以删除。',
        refreshList: '刷新列表',
        loadSelected: '加载选中',
        deleteSelected: '删除选中',
        contentType: '内容类型',
        fileName: '文件名',
        fileNamePlaceholder: 'my-article.html',
        fileNameHint: '用于草稿和兼容文件名。实际 URL 会优先使用 URL Slug。',
        urlSlug: 'URL Slug',
        urlSlugPlaceholder: 'chemical-asrs-project-malaysia',
        urlSlugHint: '用于生成 /blog/slug/ 或 /case/slug/，留空时自动根据文件名生成。',
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
        coverImagePlaceholder: '可留空，或填 images/example.webp / https://...',
        youtubeUrl: '视频 URL / 本地文件',
        youtubePlaceholder: '可留空，或填 videos/demo.mp4 / YouTube URL',
        projectImages: '项目图片 / 图纸',
        projectImagesPlaceholder: 'images/layout.webp | Layout Drawing\\nimages/site-photo.webp | Site Photo',
        projectImagesHint: '每行一个，支持本地图片或 URL。格式：图片路径 | 说明。',
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
        relatedProjectsPlaceholder: '标题 | case-studies.html\\n另一个标题 | cases/example.html',
        relatedHint: '每行一个，格式：标题 | 链接。只写标题也可以。',
        relatedSolutions: '相关方案',
        relatedSolutionsPlaceholder: 'ASRS 仓储方案 | solutions.html#asrs',
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
        commitMessagePlaceholder: '添加静态 Blog 页面',
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
        gitNotReady: 'GitHub 未连接',
        gitNotReadyHint: '请先登录 GitHub，否则自动推送不会成功。',
        gitLogin: '登录 GitHub',
        gitLoggingIn: '正在打开 GitHub 登录...',
        gitLoginFailed: 'GitHub 登录失败',
        gitStatusFailed: '无法检查 GitHub 连接',
        sampleTitle: '示例自动化案例',
        sampleSummary: '这是一个用于生成静态案例页面的简短摘要。',
        sampleSeoTitle: '示例自动化案例 | 13ASRS',
        sampleSeoDescription: '由本地生成器创建的静态案例页面。',
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
        relatedProjectsPlaceholder: 'Title | case-studies.html\\nAnother title | cases/example.html',
        relatedHint: 'One item per line. Format: Title | link. A title-only line is also allowed.',
        relatedSolutions: 'Related Solutions',
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
      zh: '<h2>项目概览</h2>\\n<p>在这里填写文章或案例正文。</p>\\n<h2>解决方案</h2>\\n<p>描述方案、设备、流程和客户价值。</p>',
      en: '<h2>Project Overview</h2>\\n<p>Write the article or case study body here.</p>\\n<h2>Solution</h2>\\n<p>Describe the solution, equipment, workflow, and customer value.</p>'
    };

    const DEFAULT_BODY_TEMPLATE = {
      zh: {
        overview: '在这里填写文章或案例的背景、客户情况和项目目标。',
        keyPoints: '客户当前遇到的问题\\n本项目采用的自动化方案\\n项目带来的业务价值',
        process: '描述系统布局、物流路径、设备协同方式和实施流程。',
        value: '描述效率提升、容量提升、人工节省、准确率提升等结果。',
        conclusion: '总结这个项目对类似客户的参考价值，并引导客户咨询方案。'
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
      const headings = currentUiLanguage === 'en'
        ? {
          overview: 'Project Overview',
          keyPoints: 'Key Points',
          process: 'Implementation & Workflow',
          value: 'Customer Value & Results',
          conclusion: 'Conclusion'
        }
        : {
          overview: '项目概览',
          keyPoints: '核心要点',
          process: '实施过程与工作流程',
          value: '客户价值与结果',
          conclusion: '结论与下一步'
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
      gitStatus.className = 'git-status ' + (gitConnectionReady ? 'ready' : 'error');
      gitStatus.querySelector('strong').textContent = gitConnectionReady ? tr('gitReady') : tr('gitNotReady');
      const location = [git && git.remote, git && git.branch ? '(' + git.branch + ')' : ''].filter(Boolean).join(' ');
      const details = git && git.details ? '\\n' + git.details : '';
      gitStatus.querySelector('small').textContent = gitConnectionReady
        ? [tr('gitReadyHint'), location].filter(Boolean).join(' ')
        : [tr('gitNotReadyHint'), git && git.message, location].filter(Boolean).join('\\n') + details;
      gitLoginButton.hidden = gitConnectionReady;
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

    function normalizedFileName() {
      const raw = fileName.value.trim() || 'my-article.html';
      return raw.toLowerCase().endsWith('.html') ? raw : raw + '.html';
    }

    function normalizedSlug() {
      const raw = (urlSlug.value.trim() || normalizedFileName().replace(/\\.html$/i, ''));
      return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-article';
    }

    function updatePathPreview() {
      const dir = contentType.value === 'case' ? 'case' : 'blog';
      pathPreview.textContent = dir + '/' + normalizedSlug() + '/index.html';
    }

    contentType.addEventListener('change', () => {
      updatePathPreview();
      renderPostList();
    });
    fileName.addEventListener('input', updatePathPreview);
    urlSlug.addEventListener('input', updatePathPreview);
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
        return;
      }
      renderPostList();
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
      form.contentHtml.value = post.contentHtml || '';
      setTemplateFromHtml(form.contentHtml.value);
      form.force.checked = true;
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
      const data = Object.fromEntries(new FormData(form).entries());
      data.force = form.force.checked;
      data.autoPush = form.autoPush.checked;
      try {
        if (data.autoPush) {
          const git = gitConnectionReady ? lastGitStatus : await refreshGitStatus();
          if (!git || !git.ok) {
            throw new Error(tr('gitNotReadyHint'));
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
  if (req.method === 'POST' && req.url === '/api/delete') return handleDeletePost(req, res);
  if (req.method === 'GET') return serveWorkspaceFile(req, res);
  send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Static Post Studio running at ${url}`);
  console.log('Press Ctrl+C to stop.');
  openBrowser(url);
});
