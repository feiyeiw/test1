#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRAFT_DIR = path.join(ROOT, 'content', 'static-posts', 'generated');
const HOME_LATEST_LIMIT = 6;

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

function normalizeSlug(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\.html$/i, '');
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function listValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value).split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
}

function excerpt(item, length = 155) {
  const source = item.summary || item.plainText || stripHtml(item.contentHtml || item.content || '');
  return source.length > length ? `${source.slice(0, length)}...` : source;
}

function getCover(item) {
  if (item.coverImage) return item.coverImage;
  const imgMatch = String(item.contentHtml || item.content || '').match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  return imgMatch ? imgMatch[1] : '';
}

function getOutputPath(item) {
  const contentType = item.contentType === 'case' ? 'case' : 'blog';
  const slug = normalizeSlug(item.urlSlug, item.fileName);
  if (!slug) return '';
  return `${contentType}/${slug}/index.html`;
}

function getHref(item) {
  return item.outputPath.replace(/index\.html$/i, '');
}

function enrichPost(item, draftPath) {
  const outputPath = getOutputPath(item);
  if (!outputPath) return null;
  if (!fs.existsSync(path.join(ROOT, outputPath))) return null;
  const slug = outputPath.split('/')[1];
  return {
    ...item,
    id: item.id || slug,
    urlSlug: item.urlSlug || slug,
    outputPath,
    draftPath: path.relative(ROOT, draftPath).replace(/\\/g, '/'),
  };
}

function readGeneratedPosts() {
  if (!fs.existsSync(DRAFT_DIR)) return [];
  return fs.readdirSync(DRAFT_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => {
      const draftPath = path.join(DRAFT_DIR, entry.name);
      try {
        return enrichPost(JSON.parse(fs.readFileSync(draftPath, 'utf8').replace(/^\uFEFF/, '')), draftPath);
      } catch (error) {
        console.warn(`Skipping ${entry.name}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt || b.date || b.updatedAt || 0) - new Date(a.publishedAt || a.date || a.updatedAt || 0));
}

function replaceDivById(html, id, nextMarkup) {
  const openTag = new RegExp(`<div\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').exec(html);
  if (!openTag) throw new Error(`Could not find ${id} opening tag.`);

  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = openTag.index + openTag[0].length;
  let depth = 1;
  let match;

  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) {
        return `${html.slice(0, openTag.index)}${nextMarkup}${html.slice(tagPattern.lastIndex)}`;
      }
    } else {
      depth += 1;
    }
  }

  throw new Error(`Could not find ${id} closing tag.`);
}

function renderMedia(className, item) {
  const cover = getCover(item);
  if (!cover) return '';
  const title = escapeHtml(item.title || '13ASRS article');
  return `<a class="${className}" href="${escapeHtml(getHref(item))}"><img src="${escapeHtml(cover)}" alt="${title}"></a>`;
}

function renderBlogCard(item) {
  const href = escapeHtml(getHref(item));
  const title = escapeHtml(item.title || 'Automation Article');
  return `
                    <article class="blog-index-card" data-static-post-id="${escapeHtml(item.id)}">
                        ${renderMedia('blog-index-media', item)}
                        <div class="blog-index-body">
                            <div class="blog-card-meta"><span>${escapeHtml(item.blogCategoryLabel || item.category || item.solutionLabel || 'Blog')}</span><span>${escapeHtml(item.date || '')}</span></div>
                            <h3><a href="${href}">${title}</a></h3>
                            <p>${escapeHtml(excerpt(item))}</p>
                            <a href="${href}" class="text-link">Read article</a>
                        </div>
                    </article>`;
}

function renderFeaturedBlog(item) {
  if (!item) return '';
  const href = escapeHtml(getHref(item));
  const title = escapeHtml(item.title || 'Automation Article');
  return `<article class="blog-featured-card" data-static-post-id="${escapeHtml(item.id)}">
                    ${renderMedia('blog-featured-media', item)}
                    <div class="blog-featured-body">
                        <h3><a href="${href}">${title}</a></h3>
                        <p>${escapeHtml(excerpt(item, 150))}</p>
                        <a href="${href}" class="text-link">Read article</a>
                    </div>
                </article>`;
}

function renderEmptyBlogPanel() {
  return `<div class="blog-empty-panel">
                    <div>
                        <span class="eyebrow">Static Library</span>
                        <h3>No local blog pages yet</h3>
                        <p>Generate a blog page in the local Static Blog / Case Studio and it will appear here.</p>
                    </div>
                </div>`;
}

function renderCaseCard(item) {
  const href = escapeHtml(getHref(item));
  const title = escapeHtml(item.title || 'Automation Case Study');
  const technologies = listValues(item.technology || item.technologies).slice(0, 4);
  const technologyText = technologies.join(', ');
  const resultText = listValues(item.results || item.result || item.metrics)[0] || '';
  const action = item.youtubeUrl || item.videoUrl || item.projectVideo ? 'View case and video' : 'View complete case';
  return `
                    <article class="blog-index-card case-card-filter" data-case-id="${escapeHtml(item.id)}" data-function="${escapeHtml(item.functionCategory || item.function || item.solution || '')}" data-industry="${escapeHtml(item.industry || '')}" data-application="${escapeHtml(item.application || '')}" data-technology="${escapeHtml(technologyText)}">
                        ${renderMedia('blog-index-media', item)}
                        <div class="blog-index-body">
                            <div class="blog-card-meta"><span>${escapeHtml(item.countryLabel || item.country || 'Project')}</span><span>${escapeHtml(item.industryLabel || item.industry || 'Industry')}</span></div>
                            <h3><a href="${href}">${title}</a></h3>
                            <p>${escapeHtml(excerpt(item))}</p>
                            <div class="blog-card-meta"><span>${escapeHtml(item.functionLabel || item.functionCategory || item.category || 'Automation Function')}</span><span>${escapeHtml(technologyText || 'Technology')}</span></div>
                            ${resultText ? `<p><strong>${escapeHtml(resultText)}</strong></p>` : ''}
                            <a class="text-link" href="${href}">${action}</a>
                        </div>
                    </article>`;
}

function renderLatestCaseSlider(items) {
  const cards = items.map((item, index) => {
    const href = escapeHtml(getHref(item));
    const title = escapeHtml(item.title || 'Automation Case Study');
    return `
            <article class="latest-case-card" data-case-id="${escapeHtml(item.id)}">
                ${renderMedia('latest-case-media', item)}
                <div class="latest-case-body">
                    <span class="eyebrow">${escapeHtml(item.industryLabel || item.industry || item.category || 'Case Study')}</span>
                    <h3><a href="${href}">${title}</a></h3>
                    <p>${escapeHtml(excerpt(item, 125))}</p>
                    <div class="latest-case-meta"><span>${escapeHtml(item.functionLabel || item.functionCategory || item.solutionLabel || 'Automation Solution')}</span><span>${String(index + 1).padStart(2, '0')}</span></div>
                    <a class="text-link" href="${href}">View complete case</a>
                </div>
            </article>`;
  }).join('');

  if (!items.length) {
    return `<div class="blog-single-note"><h3>No local case pages yet</h3><p>Generate a case page in the local Studio and it will appear here.</p></div>`;
  }

  return `
        <div class="latest-case-slider" data-latest-case-slider>
            <div class="latest-case-controls">
                <a class="text-link" href="case-studies.html">Browse all case studies</a>
            </div>
            <div class="latest-case-frame">
                <button class="slider-btn slider-btn-prev" type="button" data-slider-prev aria-label="Previous case">&lsaquo;</button>
                <div class="latest-case-track" tabindex="0">${cards}
                </div>
                <button class="slider-btn slider-btn-next" type="button" data-slider-next aria-label="Next case">&rsaquo;</button>
            </div>
        </div>`;
}

function bakeBlogPage(posts) {
  const blogPath = path.join(ROOT, 'blog.html');
  let html = fs.readFileSync(blogPath, 'utf8');
  const [featured, ...rest] = posts;
  html = replaceDivById(html, 'blogFeaturedContainer', `<div id="blogFeaturedContainer" class="blog-featured-slot">${renderFeaturedBlog(featured)}</div>`);
  const gridMarkup = rest.length
    ? rest.map(renderBlogCard).join('')
    : (featured ? `<div class="blog-single-note"><h3>More articles are coming</h3><p>This local article is live. New generated blog pages will appear here.</p></div>` : renderEmptyBlogPanel());
  html = replaceDivById(html, 'blogListContainer', `<div class="blog-index-grid" id="blogListContainer" data-static-post-ids="${escapeHtml(posts.map(item => item.id).join(','))}">${gridMarkup}
                </div>`);
  fs.writeFileSync(blogPath, html, 'utf8');
}

function bakeCasePage(posts) {
  const casePath = path.join(ROOT, 'case-studies.html');
  let html = fs.readFileSync(casePath, 'utf8');
  const gridMarkup = posts.length
    ? posts.map(renderCaseCard).join('')
    : `<div class="blog-single-note"><h3>No local case pages yet</h3><p>Generate a case page in the local Studio and it will appear here.</p></div>`;
  html = replaceDivById(html, 'caseGrid', `<div class="blog-index-grid case-index-grid" id="caseGrid" data-static-case-ids="${escapeHtml(posts.map(item => item.id).join(','))}">${gridMarkup}
                </div>`);
  fs.writeFileSync(casePath, html, 'utf8');
}

function bakeHomeLatestCases(posts) {
  const homePath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(homePath)) return;
  let html = fs.readFileSync(homePath, 'utf8');
  const latest = posts.slice(0, HOME_LATEST_LIMIT);
  html = replaceDivById(html, 'latestBlogGrid', `<div class="card-grid" id="latestBlogGrid" data-static-case-ids="${escapeHtml(latest.map(item => item.id).join(','))}">${renderLatestCaseSlider(latest)}
                </div>`);
  fs.writeFileSync(homePath, html, 'utf8');
}

function main() {
  const posts = readGeneratedPosts();
  const blogs = posts.filter(item => item.contentType !== 'case');
  const cases = posts.filter(item => item.contentType === 'case');
  bakeBlogPage(blogs);
  bakeCasePage(cases);
  bakeHomeLatestCases(cases);
  console.log(`Baked ${blogs.length} local blog pages and ${cases.length} local case pages into indexes.`);
}

main();
