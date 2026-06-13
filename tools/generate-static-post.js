#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = path.join('content', 'static-posts', 'static-post.json');
const DEFAULT_OUT_DIR = '.';
const STATIC_POST_DIRS = {
  blog: 'blog',
  case: 'case',
};

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    outDir: DEFAULT_OUT_DIR,
    force: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length);
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Generate real static blog/case HTML pages from the current blog-detail framework.

Usage:
  npm run generate:post
  npm run generate:post -- --input=content/static-posts/static-post.json
  npm run generate:post -- --input=content/static-posts --force

Input can be one JSON file, a JSON array, or a directory of JSON files.
Each post needs fileName, title, contentHtml, and contentType ("blog" or "case").
Blog pages are generated under blog/<slug>/index.html; case pages are generated under case/<slug>/index.html when urlSlug is present.
`);
      process.exit(0);
    }
  }

  return options;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitConfiguredList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function slugifyHeading(text, fallback) {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

function normalizeFileName(fileName) {
  const raw = String(fileName || '').trim().replace(/\.html$/i, '');
  if (!raw) throw new Error('fileName is required.');
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error(`fileName must contain at least one letter or number: ${raw}`);
  return `${slug}.html`;
}

function normalizeSlug(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\.html$/i, '');
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error('urlSlug is required.');
  return slug;
}

function getPostDirectory(contentType) {
  return contentType === 'case' ? STATIC_POST_DIRS.case : STATIC_POST_DIRS.blog;
}

function getOutputRelativePath(post) {
  if (post.urlSlug) {
    return path.join(getPostDirectory(post.contentType), post.urlSlug, 'index.html').replace(/\\/g, '/');
  }
  return path.join(getPostDirectory(post.contentType), post.fileName).replace(/\\/g, '/');
}

function getRelativePrefix(outputPath) {
  const depth = outputPath.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function getPublicUrlPath(outputPath) {
  return String(outputPath || '').replace(/index\.html$/i, '');
}

function isExternalUrl(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value)
    || /^(?:data|mailto|tel):/i.test(value)
    || value.startsWith('#');
}

function prefixSitePath(value, prefix) {
  const raw = String(value || '');
  if (!raw || isExternalUrl(raw) || raw.startsWith('/') || raw.startsWith('../')) return raw;
  return `${prefix}${raw.replace(/^\.\//, '')}`;
}

function prefixHtmlRefs(html, prefix) {
  return String(html || '').replace(/\b(src|href)=["']([^"']+)["']/gi, (match, attr, value) => {
    return `${attr}="${escapeHtml(prefixSitePath(value, prefix))}"`;
  });
}

function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'https://13asrs.com');
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.replace('/', '')}`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.includes('/embed/')) return parsed.href;
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }
  } catch {
    return '';
  }
  return '';
}

function isVideoFile(value) {
  return /\.(?:mp4|webm|ogg|ogv)(?:[?#].*)?$/i.test(String(value || '').trim());
}

function splitLines(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function renderVideoFrame(url, title, prefix) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const embedUrl = getYouTubeEmbedUrl(raw);
  if (embedUrl) {
    return `<div class="video-frame blog-video-frame"><iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(title || '13ASRS project video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  }
  const src = prefixSitePath(raw, prefix);
  if (isVideoFile(src)) {
    return `<div class="video-frame blog-video-frame"><video controls preload="metadata" playsinline src="${escapeHtml(src)}">Your browser does not support the video tag.</video></div>`;
  }
  return `<div class="video-frame blog-video-frame"><iframe src="${escapeHtml(src)}" title="${escapeHtml(title || '13ASRS project video')}" loading="lazy" allowfullscreen></iframe></div>`;
}

function getPostCover(post) {
  return String(post.coverImage || '').trim();
}

function renderOptionalSection(title, body) {
  const value = String(body || '').trim();
  if (!value) return '';
  return `<section class="article-section"><h2>${escapeHtml(title)}</h2><div class="blog-content">${value}</div></section>`;
}

function renderListSection(title, values) {
  const items = splitLines(values);
  if (!items.length) return '';
  return `<section class="article-section"><h2>${escapeHtml(title)}</h2><ul class="static-detail-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
}

function renderProjectGallery(images, prefix) {
  const items = splitLines(images);
  if (!items.length) return '';
  return `<div class="project-gallery">${items.map(item => {
    const [src, alt] = item.split('|').map(part => part.trim());
    return `<figure><img src="${escapeHtml(prefixSitePath(src, prefix))}" alt="${escapeHtml(alt || 'Project image')}"></figure>`;
  }).join('')}</div>`;
}

function normalizePost(rawPost) {
  const post = {
    ...rawPost,
    contentType: rawPost.contentType === 'case' ? 'case' : 'blog',
    author: rawPost.author || '13ASRS',
    date: rawPost.date || new Date().toISOString().slice(0, 10),
  };

  post.fileName = normalizeFileName(post.fileName);
  post.urlSlug = normalizeSlug(post.urlSlug, post.fileName);
  post.outputPath = getOutputRelativePath(post);
  post.contentHtml = String(post.contentHtml || post.content || '').trim();
  post.plainText = post.plainText || stripHtml(post.contentHtml);
  post.technology = splitLines(post.technology);
  post.projectImages = splitLines(post.projectImages);
  post.keywords = splitLines(post.keywords);
  post.category = post.category || post.blogCategory || post.functionLabel || post.solutionLabel || (post.contentType === 'case' ? 'Case Study' : 'Blog');
  post.seoTitle = post.seoTitle || `${post.title || '13ASRS Article'} | 13ASRS`;
  post.seoDescription = post.seoDescription || post.summary || post.plainText.slice(0, 160);

  if (!post.title) throw new Error(`${post.fileName}: title is required.`);
  if (!post.contentHtml) throw new Error(`${post.fileName}: contentHtml is required.`);

  return post;
}

function addHeadingIds(contentHtml) {
  const toc = [];
  let index = 0;
  const html = String(contentHtml || '').replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    index += 1;
    const text = stripHtml(inner);
    const existingId = attrs.match(/\sid=["']([^"']+)["']/i);
    const id = existingId ? existingId[1] : slugifyHeading(text, `section-${index}`);
    toc.push({ id, text });
    if (existingId) return match;
    return `<${tag}${attrs} id="${escapeHtml(id)}">${inner}</${tag}>`;
  });

  return { html, toc: toc.slice(0, 8) };
}

function renderToc(toc) {
  if (!toc.length) return '';
  return toc.map(item => `<a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`).join('');
}

function renderRelatedCards(items, defaults) {
  const values = splitConfiguredList(items);
  const cards = values.length ? values : defaults;
  return cards.slice(0, 3).map(item => {
    const label = typeof item === 'string' ? item : item.title;
    const href = typeof item === 'string' ? 'case-studies.html' : item.href;
    return `<a class="related-card" href="${escapeHtml(href || '#')}"><span class="eyebrow">Recommended</span><h3>${escapeHtml(label || 'Related Resource')}</h3><p>Explore a relevant 13ASRS reference before planning your project.</p></a>`;
  }).join('');
}

function renderStaticPost(post) {
  const prefix = getRelativePrefix(post.outputPath);
  const siteHref = href => prefixSitePath(href, prefix);
  const { html: contentWithHeadingIds, toc } = addHeadingIds(post.contentHtml);
  const contentHtml = prefixHtmlRefs(contentWithHeadingIds, prefix);
  const isCase = post.contentType === 'case';
  const backHref = siteHref(isCase ? 'case-studies.html' : 'blog.html');
  const backLabel = isCase ? 'Back to Case Studies' : 'Back to Blog';
  const category = post.category || post.blogCategory || post.functionLabel || post.solutionLabel || (isCase ? 'Case Study' : 'Blog');
  const cover = getPostCover(post);
  const coverHtml = cover ? `
                        <figure class="blog-cover-frame">
                            <img class="blog-cover" src="${escapeHtml(prefixSitePath(cover, prefix))}" alt="${escapeHtml(post.title)}">
                        </figure>` : '';
  const videoHtml = renderVideoFrame(post.youtubeUrl || post.videoUrl, post.title, prefix);
  const technologyLabels = splitLines(post.technology).join(', ');
  const facts = [
    ['Country', post.country],
    ['Industry', post.industryLabel || post.industry],
    ['Function', post.functionLabel || post.functionCategory],
    ['Application', post.applicationLabel || post.application],
    ['Technology', technologyLabels],
  ].filter(([, value]) => value);
  const workflowBody = [
    String(post.layoutWorkflow || '').trim(),
    renderProjectGallery(post.projectImages, prefix),
  ].filter(Boolean).join('\n');
  const relatedProjectDefaults = [
    { title: 'ASRS Project', href: siteHref('case-studies.html?solution=asrs#caseGrid') },
    { title: 'Smart Factory Project', href: siteHref('case-studies.html?solution=smart-factory#caseGrid') },
    { title: 'Automation Case Library', href: siteHref('case-studies.html') },
  ];
  const relatedSolutionDefaults = [
    { title: 'ASRS Warehouse Solution', href: siteHref('solutions.html#asrs') },
    { title: 'Smart Factory Solution', href: siteHref('solutions.html#factory') },
    { title: 'Industrial Machinery Solutions', href: siteHref('solutions.html#machinery') },
  ];
  const relatedProjects = splitConfiguredList(post.relatedProjects).map(item => (
    typeof item === 'string' ? item : { ...item, href: siteHref(item.href || '#') }
  ));
  const relatedSolutions = splitConfiguredList(post.relatedSolutions).map(item => (
    typeof item === 'string' ? item : { ...item, href: siteHref(item.href || '#') }
  ));

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XYWJNXE4Z"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-3XYWJNXE4Z');
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(post.seoTitle)}</title>
    <meta name="description" content="${escapeHtml(post.seoDescription)}">
    ${post.seoKeywords ? `<meta name="keywords" content="${escapeHtml(post.seoKeywords)}">` : ''}
    <link rel="canonical" href="https://13asrs.com/${escapeHtml(getPublicUrlPath(post.outputPath))}">
    <link rel="stylesheet" href="${escapeHtml(siteHref('style.css'))}">
</head>
<body class="static-post-page ${isCase ? 'static-case-page' : 'static-blog-page'}">
    <header>
        <div class="header-main">
            <div class="container">
                <div class="logo-brand">
                    <div class="logo"><a href="${escapeHtml(siteHref('index.html'))}"><img src="${escapeHtml(siteHref('logo.jpg'))}" alt="13ASRS"></a></div>
                    <span class="logo-slogan">
                        <span class="slogan-line1">Industrial Automation Solutions</span>
                        <span class="slogan-line2">Smart warehouse and factory integration</span>
                    </span>
                </div>
                <div class="header-actions">
                    <div class="language-selector">
                        <select id="lang-select" onchange="switchLanguage(this.value)">
                            <option value="en">English</option>
                            <option value="zh">Chinese</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="ja">Japanese</option>
                            <option value="ko">Korean</option>
                            <option value="ar">Arabic</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        <nav>
            <div class="container">
                <ul>
                    <li><a href="${escapeHtml(siteHref('index.html'))}">Home</a></li>
                    <li><a href="${escapeHtml(siteHref('solutions.html'))}">Solutions</a></li>
                    <li><a href="${escapeHtml(siteHref('industries.html'))}">Industries</a></li>
                    <li><a href="${escapeHtml(siteHref('case-studies.html'))}">Case Studies</a></li>
                    <li><a href="${escapeHtml(siteHref('blog.html'))}">Blog</a></li>
                    <li><a href="${escapeHtml(siteHref('about.html'))}">About</a></li>
                    <li><a href="${escapeHtml(siteHref('contact.html'))}">Contact</a></li>
                </ul>
            </div>
        </nav>
    </header>

    <main>
        <section class="blog-detail-upgrade">
            <div class="container">
                <article class="blog-shell">
                    <div class="blog-hero-card">
                        <div class="blog-hero-copy">
                            <a href="${backHref}" class="back-link">${backLabel}</a>
                            <div class="blog-meta-row">
                                <span>${escapeHtml(post.date)}</span>
                                <span>${escapeHtml(category)}</span>
                                <span>${escapeHtml(post.author)}</span>
                            </div>
                            <h1 class="blog-title">${escapeHtml(post.title)}</h1>
                            <p class="blog-summary">${escapeHtml(post.summary || '')}</p>
                            ${facts.length ? `<div class="project-fact-chips">${facts.map(([label, value]) => `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`).join('')}</div>` : ''}
                        </div>
                        ${coverHtml}
                    </div>

                    <div class="blog-article-layout">
                        <aside class="blog-sidebar">
                            <section class="article-side-panel"${toc.length ? '' : ' style="display:none;"'}>
                                <h2>Table of Contents</h2>
                                <nav class="toc-list">${renderToc(toc)}</nav>
                            </section>
                            <section class="article-side-panel">
                                <h2>Article Info</h2>
                                <div class="article-facts">
                                    <span>Published</span><strong>${escapeHtml(post.date || '-')}</strong>
                                    <span>Author</span><strong>${escapeHtml(post.author)}</strong>
                                    <span>Category</span><strong>${escapeHtml(category)}</strong>
                                </div>
                            </section>
                        </aside>

                        <div class="blog-main-column">
                            ${videoHtml}
                            <section class="article-section blog-content-section">
                                <h2>Project Overview</h2>
                                <div class="blog-content">${contentHtml}</div>
                            </section>
                            ${isCase ? renderOptionalSection('Challenge', post.challenge) : ''}
                            ${isCase ? renderOptionalSection('Solution', post.solutionDetail || post.solutionText) : ''}
                            ${isCase ? renderOptionalSection('Workflow & Layout', workflowBody) : ''}
                            ${isCase ? renderListSection('Equipment Used', post.equipmentList) : ''}
                            ${isCase ? renderListSection('Results & ROI', post.results) : ''}
                            <section class="article-section" id="related-projects">
                                <h2>Related Case Studies</h2>
                                <div class="related-grid">${renderRelatedCards(relatedProjects, relatedProjectDefaults)}</div>
                            </section>
                            <section class="article-section">
                                <h2>Related Blog</h2>
                                <div class="related-grid">${renderRelatedCards(relatedSolutions, relatedSolutionDefaults)}</div>
                            </section>
                            <div class="blog-cta">
                                <div>
                                    <span class="eyebrow">Business Challenge</span>
                                    <h2>Start with Your Business Challenge</h2>
                                    <p>Tell us about your warehouse, factory, or production requirements. We'll help you explore practical automation solutions and relevant project references.</p>
                                </div>
                                <a class="btn-industrial" href="${escapeHtml(siteHref('contact.html'))}">Discuss Your Project</a>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo"><img src="${escapeHtml(siteHref('logo.jpg'))}" alt="13ASRS"></div>
                <div class="footer-links">
                    <a href="${escapeHtml(siteHref('solutions.html'))}">Solutions</a>
                    <a href="${escapeHtml(siteHref('case-studies.html'))}">Case Studies</a>
                    <a href="${escapeHtml(siteHref('blog.html'))}">Blog</a>
                    <a href="${escapeHtml(siteHref('contact.html'))}">Contact</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>Email: pjm@13asrs.com | Website: 13asrs.com</p>
                <p>&copy; 2026 13ASRS. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <script src="${escapeHtml(siteHref('utils.js'))}" defer></script>
    <script src="${escapeHtml(siteHref('i18n.js'))}" defer></script>
    <script src="${escapeHtml(siteHref('site-upgrade.js'))}" defer></script>
    <script src="${escapeHtml(siteHref('app.js'))}" defer></script>
</body>
</html>
`;
}

function readPosts(inputPath) {
  const absolute = path.resolve(inputPath);
  const stat = fs.statSync(absolute);
  const files = stat.isDirectory()
    ? fs.readdirSync(absolute).filter(file => file.endsWith('.json')).map(file => path.join(absolute, file))
    : [absolute];

  const posts = [];
  let skipped = 0;
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const values = Array.isArray(data) ? data : [data];
    for (const value of values) {
      if (!value.fileName) {
        skipped += 1;
        continue;
      }
      posts.push(normalizePost(value));
    }
  }
  return { posts, skipped };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { posts, skipped } = readPosts(options.input);
  if (!posts.length) throw new Error('No static posts found.');

  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  for (const post of posts) {
    const outPath = path.join(outDir, post.outputPath);
    if (fs.existsSync(outPath) && !options.force) {
      throw new Error(`${post.outputPath} already exists. Use --force to overwrite it.`);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderStaticPost(post), 'utf8');
    console.log(`Generated ${post.outputPath}`);
  }
  if (skipped) console.log(`Skipped ${skipped} item(s) without fileName.`);
}

main();
