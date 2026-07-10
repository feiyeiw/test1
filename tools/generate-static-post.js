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

function normalizeLookupKey(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
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

function looksLikeHref(value) {
  const raw = String(value || '').trim();
  return !raw
    || isExternalUrl(raw)
    || raw.startsWith('/')
    || raw.startsWith('../')
    || raw.includes('/')
    || /\.html(?:[?#].*)?$/i.test(raw);
}

function makeLookupPost(rawPost) {
  const contentType = rawPost.contentType === 'case' ? 'case' : 'blog';
  const fileName = normalizeFileName(rawPost.fileName || rawPost.title);
  const urlSlug = normalizeSlug(rawPost.urlSlug, fileName);
  const outputPath = getOutputRelativePath({ contentType, fileName, urlSlug });
  return {
    contentType,
    title: rawPost.title || fileName.replace(/\.html$/i, ''),
    fileName,
    urlSlug,
    href: getPublicUrlPath(outputPath),
  };
}

function addLookupItem(map, post) {
  const bucket = map[post.contentType];
  const keys = [post.title, post.fileName, post.urlSlug, post.href].map(normalizeLookupKey).filter(Boolean);
  for (const key of keys) {
    if (!bucket.has(key)) bucket.set(key, post);
  }
}

function findLookupItem(map, contentType, value) {
  const key = normalizeLookupKey(value);
  if (!key) return null;
  const bucket = map[contentType] || new Map();
  if (bucket.has(key)) return bucket.get(key);
  for (const [candidateKey, post] of bucket.entries()) {
    if (candidateKey.includes(key) || key.includes(candidateKey)) return post;
  }
  return null;
}

function buildRelatedLookup(posts) {
  const map = { blog: new Map(), case: new Map() };
  const generatedDir = path.join('content', 'static-posts', 'generated');
  const rawPosts = [];

  if (fs.existsSync(generatedDir)) {
    for (const file of fs.readdirSync(generatedDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(generatedDir, file), 'utf8').replace(/^\uFEFF/, ''));
        rawPosts.push(...(Array.isArray(data) ? data : [data]));
      } catch {
        // Ignore incomplete drafts in the lookup; the main generator still validates the requested input.
      }
    }
  }

  for (const post of rawPosts) {
    try {
      addLookupItem(map, makeLookupPost(post));
    } catch {
      // Ignore records that are not usable as related links.
    }
  }

  for (const post of posts) {
    addLookupItem(map, {
      contentType: post.contentType,
      title: post.title,
      fileName: post.fileName,
      urlSlug: post.urlSlug,
      href: getPublicUrlPath(post.outputPath),
    });
  }

  return map;
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

function renderTextBlocks(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;

  return raw
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
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

function renderOptionalSection(title, body, id, extraHtml = '') {
  const value = String(body || '').trim();
  if (!value && !extraHtml) return '';
  return `<section class="article-section" id="${escapeHtml(id || slugifyHeading(title, 'case-section'))}"><h2>${escapeHtml(title)}</h2><div class="blog-content">${renderTextBlocks(value)}${extraHtml}</div></section>`;
}

function renderHtmlSection(title, html, id) {
  const value = String(html || '').trim();
  if (!value) return '';
  return `<section class="article-section" id="${escapeHtml(id || slugifyHeading(title, 'article-section'))}"><h2>${escapeHtml(title)}</h2><div class="blog-content">${value}</div></section>`;
}

function renderListSection(title, values, id) {
  const items = splitLines(values);
  if (!items.length) return '';
  return `<section class="article-section" id="${escapeHtml(id || slugifyHeading(title, 'case-list'))}"><h2>${escapeHtml(title)}</h2><ul class="static-detail-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
}

function renderProjectGallery(images, prefix) {
  const items = splitLines(images);
  if (!items.length) return '';
  return `<div class="project-gallery">${items.map(item => {
    const [src, alt] = item.split('|').map(part => part.trim());
    return `<figure><img src="${escapeHtml(prefixSitePath(src, prefix))}" alt="${escapeHtml(alt || 'Project image')}"></figure>`;
  }).join('')}</div>`;
}

function normalizeSectionTitle(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function splitHtmlIntoH2Sections(contentHtml) {
  const source = String(contentHtml || '').trim();
  if (!source) return [];

  const headingPattern = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi;
  const headings = [];
  let match;
  while ((match = headingPattern.exec(source)) !== null) {
    headings.push({
      index: match.index,
      end: headingPattern.lastIndex,
      heading: stripHtml(match[2]),
    });
  }

  if (!headings.length) {
    return [{ heading: 'Project Overview / Opening', body: source }];
  }

  const sections = [];
  const leading = source.slice(0, headings[0].index).trim();
  if (leading) sections.push({ heading: 'Project Overview / Opening', body: leading });

  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index];
    const next = headings[index + 1];
    const body = source.slice(current.end, next ? next.index : source.length).trim();
    sections.push({ heading: current.heading, body });
  }
  return sections.filter(section => section.body || section.heading);
}

function matchesSectionTitle(heading, aliases) {
  const key = normalizeSectionTitle(heading);
  return aliases.some(alias => {
    const aliasKey = normalizeSectionTitle(alias);
    return key === aliasKey || key.includes(aliasKey) || aliasKey.includes(key);
  });
}

function renderOrderedBodySections(contentHtml, prefix) {
  const sections = splitHtmlIntoH2Sections(contentHtml);
  const used = new Set();
  const order = [
    {
      title: 'Project Overview / Opening',
      id: 'project-overview-opening',
      aliases: ['Project Overview', 'Project Overview / Opening', 'Opening', 'Overview'],
    },
    {
      title: 'Key Points',
      id: 'key-points',
      aliases: ['Key Points', 'Key Point', 'Highlights', 'Key Features'],
    },
    {
      title: 'Implementation / Workflow',
      id: 'implementation-workflow',
      aliases: ['Implementation / Workflow', 'Implementation & Workflow', 'Implementation Workflow', 'Implementation', 'Workflow'],
    },
    {
      title: 'Customer Value / Results',
      id: 'customer-value-results',
      aliases: ['Customer Value / Results', 'Customer Value & Results', 'Customer Value', 'Customer Results'],
    },
    {
      title: 'Conclusion / Next Step',
      id: 'conclusion-next-step',
      aliases: ['Conclusion / Next Step', 'Conclusion', 'Next Step', 'Next Steps'],
    },
  ];

  const rendered = [];
  for (const target of order) {
    const matchIndex = sections.findIndex((section, index) => !used.has(index) && matchesSectionTitle(section.heading, target.aliases));
    if (matchIndex === -1) continue;
    used.add(matchIndex);
    rendered.push({
      id: target.id,
      title: target.title,
      html: renderHtmlSection(target.title, prefixHtmlRefs(sections[matchIndex].body, prefix), target.id),
    });
  }

  sections.forEach((section, index) => {
    if (used.has(index)) return;
    const title = section.heading || 'Additional Details';
    const id = slugifyHeading(title, `additional-details-${index + 1}`);
    rendered.push({
      id,
      title,
      html: renderHtmlSection(title, prefixHtmlRefs(section.body, prefix), id),
    });
  });

  return rendered.filter(section => section.html);
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

function renderToc(toc) {
  if (!toc.length) return '';
  return toc.map(item => `<a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`).join('');
}

function renderRelatedCards(items, defaults, stringHref = 'case-studies.html') {
  const values = splitConfiguredList(items);
  const cards = values.length ? [...values, ...defaults] : defaults;
  return cards.slice(0, 3).map(item => {
    const label = typeof item === 'string' ? item : item.title;
    const href = typeof item === 'string' ? stringHref : item.href;
    return `<a class="related-card" href="${escapeHtml(href || '#')}"><span class="eyebrow">Recommended</span><h3>${escapeHtml(label || 'Related Resource')}</h3><p>Explore a relevant 13ASRS reference before planning your project.</p></a>`;
  }).join('');
}

function renderCaseStudiesInternalLinks(siteHref) {
  return `<section class="case-study-internal-links" data-case-study-internal-links="true">
            <div class="container">
                <span class="eyebrow">Automation Case Studies</span>
                <h2>See real automation projects before planning your system.</h2>
                <p>Compare warehouse automation, smart factory, packaging, and industrial manufacturing case studies from 13ASRS.</p>
                <div class="case-study-link-list">
                    <a href="${escapeHtml(siteHref('case-studies.html'))}">All Case Studies</a>
                    <a href="${escapeHtml(siteHref('case-studies.html?solution=asrs#caseGrid'))}">ASRS Case Studies</a>
                    <a href="${escapeHtml(siteHref('case-studies.html?solution=smart-factory#caseGrid'))}">Smart Factory Cases</a>
                    <a href="${escapeHtml(siteHref('case-studies.html?industry=packaging-printing#caseGrid'))}">Packaging & Printing Cases</a>
                </div>
            </div>
        </section>`;
}

function resolveRelatedItems(items, contentType, relatedLookup, siteHref) {
  return splitConfiguredList(items).map(item => {
    if (typeof item === 'string') {
      const match = findLookupItem(relatedLookup, contentType, item);
      return match ? { title: match.title, href: siteHref(match.href) } : item;
    }

    const title = item.title || item.href || 'Related Resource';
    const href = String(item.href || '').trim();
    if (!looksLikeHref(href)) {
      const match = findLookupItem(relatedLookup, contentType, href) || findLookupItem(relatedLookup, contentType, title);
      if (match) return { title, href: siteHref(match.href) };
    }
    return { ...item, href: siteHref(href || '#') };
  });
}

function renderStaticPost(post, relatedLookup) {
  const prefix = getRelativePrefix(post.outputPath);
  const siteHref = href => prefixSitePath(href, prefix);
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
    ['Country', post.countryLabel || post.country],
    ['Industry', post.industryLabel || post.industry],
    ['Function', post.functionLabel || post.functionCategory],
    ['Application', post.applicationLabel || post.application],
    ['Technology', technologyLabels],
  ].filter(([, value]) => value);
  const projectGalleryHtml = renderProjectGallery(post.projectImages, prefix);
  const seoKeywords = splitLines(post.seoKeywords || post.keywords);
  const articleSections = [
    { id: 'summary', title: 'Summary', html: renderOptionalSection('Summary', post.summary, 'summary') },
    { id: 'technology', title: 'Technology', html: renderListSection('Technology', post.technology, 'technology') },
    { id: 'challenge', title: 'Challenge', html: renderOptionalSection('Challenge', post.challenge, 'challenge') },
    { id: 'solution', title: 'Solution', html: renderOptionalSection('Solution', post.solutionDetail || post.solutionText, 'solution') },
    { id: 'workflow-layout', title: 'Workflow & Layout', html: renderOptionalSection('Workflow & Layout', post.layoutWorkflow, 'workflow-layout', projectGalleryHtml) },
    { id: 'results-roi', title: 'Results & ROI', html: renderListSection('Results & ROI', post.results, 'results-roi') },
    { id: 'equipment-list', title: 'Equipment List', html: renderListSection('Equipment List', post.equipmentList, 'equipment-list') },
    ...renderOrderedBodySections(post.contentHtml, prefix),
    { id: 'seo-title', title: 'SEO Title', html: renderOptionalSection('SEO Title', post.seoTitle, 'seo-title') },
    { id: 'seo-description', title: 'SEO Description', html: renderOptionalSection('SEO Description', post.seoDescription, 'seo-description') },
    { id: 'seo-keywords', title: 'SEO Keywords', html: renderListSection('SEO Keywords', seoKeywords, 'seo-keywords') },
  ].filter(section => section.html);
  const pageToc = articleSections.map(({ id, title }) => ({ id, text: title }));
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
  const relatedProjects = resolveRelatedItems(post.relatedProjects, 'case', relatedLookup, siteHref);
  const relatedSolutions = resolveRelatedItems(post.relatedSolutions, 'blog', relatedLookup, siteHref);

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
    ${seoKeywords.length ? `<meta name="keywords" content="${escapeHtml(seoKeywords.join(', '))}">` : ''}
    <link rel="canonical" href="https://13asrs.com/${escapeHtml(getPublicUrlPath(post.outputPath))}">
    <link rel="stylesheet" href="${escapeHtml(siteHref('style.css'))}">
</head>
<body class="static-post-page ${isCase ? 'static-case-page' : 'static-blog-page'}">
    <header>
        <div class="header-main">
            <div class="container">
                <div class="logo-brand">
                    <div class="logo"><a href="${escapeHtml(siteHref('index.html'))}"><img src="/logo.jpg?v=20260710" alt="13ASRS" onerror="this.replaceWith(document.createTextNode('13ASRS'))"></a></div>
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
                            <section class="article-side-panel"${pageToc.length ? '' : ' style="display:none;"'}>
                                <h2>Table of Contents</h2>
                                <nav class="toc-list">${renderToc(pageToc)}</nav>
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
                            ${articleSections.map(section => section.html).join('\n                            ')}
                            <section class="article-section" id="related-projects">
                                <h2>Related Case Studies</h2>
                                <div class="related-grid">${renderRelatedCards(relatedProjects, relatedProjectDefaults, siteHref('case-studies.html'))}</div>
                            </section>
                            <section class="article-section">
                                <h2>Related Blog</h2>
                                <div class="related-grid">${renderRelatedCards(relatedSolutions, relatedSolutionDefaults, siteHref('blog.html'))}</div>
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
        ${renderCaseStudiesInternalLinks(siteHref)}
    </main>

    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo"><img src="/logo.jpg?v=20260710" alt="13ASRS" onerror="this.replaceWith(document.createTextNode('13ASRS'))"></div>
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
  const relatedLookup = buildRelatedLookup(posts);

  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  for (const post of posts) {
    const outPath = path.join(outDir, post.outputPath);
    if (fs.existsSync(outPath) && !options.force) {
      throw new Error(`${post.outputPath} already exists. Use --force to overwrite it.`);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderStaticPost(post, relatedLookup), 'utf8');
    console.log(`Generated ${post.outputPath}`);
  }
  if (skipped) console.log(`Skipped ${skipped} item(s) without fileName.`);
}

main();
