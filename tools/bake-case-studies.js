#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = path.join('outputs', 'blogs-api-snapshot.json');
const DEFAULT_OUTPUT = 'case-studies.html';
const DEFAULT_HOME_OUTPUT = 'index.html';
const HOME_LATEST_LIMIT = 6;

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    homeOutput: DEFAULT_HOME_OUTPUT,
  };

  for (const arg of argv) {
    if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
    } else if (arg.startsWith('--home-output=')) {
      options.homeOutput = arg.slice('--home-output='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Bake published KV case posts into case-studies.html and the home latest case section.

Usage:
  node tools/bake-case-studies.js
  node tools/bake-case-studies.js --input=outputs/blogs-api-snapshot.json
  node tools/bake-case-studies.js --output=case-studies.html --home-output=index.html
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

function getCaseExcerpt(item, length = 155) {
  const source = item.summary || item.plainText || stripHtml(item.contentHtml || item.content || '');
  return source.length > length ? `${source.slice(0, length)}...` : source;
}

function getCaseCover(item) {
  if (item.coverImage) return item.coverImage;
  const imgMatch = String(item.contentHtml || item.content || '').match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  return imgMatch ? imgMatch[1] : 'system-acr.webp';
}

function getCaseLink(item) {
  return item.href || `blog-detail.html?id=${encodeURIComponent(item.id)}`;
}

function renderCaseCard(item) {
  const href = getCaseLink(item);
  const title = escapeHtml(item.title || 'Automation Case Study');
  return `
                    <article class="blog-index-card case-card-filter" data-case-id="${escapeHtml(item.id)}" data-industry="${escapeHtml(item.industry)}" data-solution="${escapeHtml(item.solution)}">
                        <a class="blog-index-media" href="${href}"><img src="${escapeHtml(getCaseCover(item))}" alt="${title}" onerror="this.onerror=null;this.src='system-acr.webp';"></a>
                        <div class="blog-index-body">
                            <div class="blog-card-meta"><span>${escapeHtml(item.industryLabel || 'Case Study')}</span><span>${escapeHtml(item.date || '')}</span></div>
                            <h3><a href="${href}">${title}</a></h3>
                            <p>${escapeHtml(getCaseExcerpt(item))}</p>
                            <div class="blog-card-meta"><span>${escapeHtml(item.solutionLabel || item.category || 'Automation Solution')}</span></div>
                            <a class="text-link" href="${href}">View complete case and video</a>
                        </div>
                    </article>`;
}

function renderLatestCaseSlider(caseItems) {
  const cards = caseItems.map((item, index) => {
    const href = getCaseLink(item);
    const title = escapeHtml(item.title || 'Automation Case Study');
    const industry = escapeHtml(item.industryLabel || item.category || 'Case Study');
    const solution = escapeHtml(item.solutionLabel || 'Automation Solution');
    return `
            <article class="latest-case-card" data-case-id="${escapeHtml(item.id)}">
                <a class="latest-case-media" href="${escapeHtml(href)}"><img src="${escapeHtml(getCaseCover(item))}" alt="${title}" onerror="this.onerror=null;this.src='system-acr.webp';"></a>
                <div class="latest-case-body">
                    <span class="eyebrow">${industry}</span>
                    <h3><a href="${escapeHtml(href)}">${title}</a></h3>
                    <p>${escapeHtml(getCaseExcerpt(item, 125))}</p>
                    <div class="latest-case-meta"><span>${solution}</span><span>${String(index + 1).padStart(2, '0')}</span></div>
                    <a class="text-link" href="${escapeHtml(href)}">View complete case and video</a>
                </div>
            </article>`;
  }).join('');

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

function replaceDivById(html, id, nextMarkup) {
  const openTag = new RegExp(`<div\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').exec(html);
  if (!openTag) {
    throw new Error(`Could not find ${id} opening tag.`);
  }

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

function sortLatestCases(cases) {
  return [...cases].sort((a, b) => new Date(b.publishedAt || b.date || b.updatedAt || 0) - new Date(a.publishedAt || a.date || a.updatedAt || 0));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = fs.readFileSync(options.input, 'utf8').replace(/^\uFEFF/, '');
  const posts = JSON.parse(raw);
  const cases = posts.filter(item => item.contentType === 'case' && item.status === 'published');

  if (!cases.length) {
    throw new Error('No published case posts found in snapshot.');
  }

  const caseHtmlPath = path.resolve(options.output);
  let caseHtml = fs.readFileSync(caseHtmlPath, 'utf8');
  const nextGrid = `<div class="blog-index-grid case-index-grid" id="caseGrid" data-static-case-ids="${escapeHtml(cases.map(item => item.id).join(','))}">${cases.map(renderCaseCard).join('')}
                </div>`;
  caseHtml = replaceDivById(caseHtml, 'caseGrid', nextGrid);
  fs.writeFileSync(caseHtmlPath, caseHtml, 'utf8');
  console.log(`Baked ${cases.length} case posts into ${options.output}`);

  const homeCases = sortLatestCases(cases).slice(0, HOME_LATEST_LIMIT);
  const homeHtmlPath = path.resolve(options.homeOutput);
  let homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');
  const nextHomeLatest = `<div class="card-grid" id="latestBlogGrid" data-static-case-ids="${escapeHtml(homeCases.map(item => item.id).join(','))}">${renderLatestCaseSlider(homeCases)}
                </div>`;

  homeHtml = replaceDivById(homeHtml, 'latestBlogGrid', nextHomeLatest);
  fs.writeFileSync(homeHtmlPath, homeHtml, 'utf8');
  console.log(`Baked ${homeCases.length} latest case posts into ${options.homeOutput}`);
}

main();
