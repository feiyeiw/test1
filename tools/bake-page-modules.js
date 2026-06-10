#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_SNAPSHOT = path.join('outputs', 'page-modules-snapshot.js');
const PAGE_FILES = {
  home: 'index.html',
  solutions: 'solutions.html',
  industries: 'industries.html',
  'case-studies': 'case-studies.html',
  blog: 'blog.html',
  about: 'about.html',
  contact: 'contact.html',
};

function parseArgs(argv) {
  const options = {
    snapshot: DEFAULT_SNAPSHOT,
    pages: null,
  };

  for (const arg of argv) {
    if (arg.startsWith('--snapshot=')) {
      options.snapshot = arg.slice('--snapshot='.length);
    } else if (arg.startsWith('--pages=')) {
      options.pages = arg.slice('--pages='.length).split(',').map(page => page.trim()).filter(Boolean);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Bake a page module snapshot into static HTML.

Usage:
  node tools/bake-page-modules.js
  node tools/bake-page-modules.js --snapshot=outputs/page-modules-snapshot.js
  node tools/bake-page-modules.js --pages=home,solutions,about,contact

Run tools/snapshot-page-modules.js first. This tool edits HTML files.
`);
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

function renderModuleText(value) {
  const blocks = String(value || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
  return blocks.map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}

function renderCardText(value) {
  const lines = String(value || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return `<ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
  }
  return lines.length ? `<p>${escapeHtml(lines[0])}</p>` : '';
}

function renderModuleHeader(eyebrow, title, text) {
  return (eyebrow || title || text) ? `<div class="section-header">${eyebrow}${title}${text}</div>` : '';
}

function renderChipGrid(items = []) {
  return `<div class="industry-chip-grid">${items.map(item => {
    const href = item.href || '#';
    return `<a class="industry-chip" href="${escapeHtml(href)}">${escapeHtml(item.title || item.text || 'Link')}</a>`;
  }).join('')}</div>`;
}

function renderContactFormModule(module, eyebrow, title, text, sectionTheme) {
  return `
        <section class="section-band ${sectionTheme} cms-module">
            <div class="container">
                ${renderModuleHeader(eyebrow, title, text)}
                <form class="inquiry-form" id="contactInquiryForm">
                    <div class="form-group"><label for="company">Company Name</label><input id="company" name="company" type="text" required></div>
                    <div class="form-group"><label for="industry">Industry</label><select id="industry" name="industry" required><option value="">Select industry</option><option>Warehousing & Logistics</option><option>Manufacturing</option><option>Food & Beverage</option><option>Pharmaceutical</option><option>Chemical</option><option>Printing</option><option>Packaging</option><option>Electronics</option><option>Automotive</option><option>Building Materials</option><option>Other</option></select></div>
                    <div class="form-group"><label for="countryCity">Country / Region</label><input id="countryCity" name="countryCity" type="text" placeholder="Country / Region" required></div>
                    <div class="form-group"><label for="contactPerson">Contact Person</label><input id="contactPerson" name="contactPerson" type="text" required></div>
                    <div class="form-group"><label for="email">Email</label><input id="email" name="email" type="email" required></div>
                    <div class="form-group"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" required></div>
                    <div class="form-group"><label for="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" type="text"></div>
                    <div class="form-group"><label for="wechat">WeChat (Optional)</label><input id="wechat" name="wechat" type="text"></div>
                    <div class="form-group"><label for="projectType">Automation Interest</label><select id="projectType" name="projectType" required><option value="">Select automation interest</option><option>ASRS & Smart Warehouse</option><option>Shuttle System</option><option>Stacker Crane ASRS</option><option>AGV / AMR Logistics</option><option>Smart Factory Automation</option><option>Production Line Automation</option><option>Printing & Packaging Systems</option><option>Filling Systems</option><option>Film Blowing Systems</option><option>Laser Processing Equipment</option><option>Not Sure Yet</option></select></div>
                    <div class="form-group"><label for="budgetRange">Estimated Project Budget</label><select id="budgetRange" name="budgetRange" required><option value="">Select estimated project budget</option><option>Under USD 300K</option><option>USD 300K - 800K</option><option>USD 800K - 2M</option><option>USD 2M - 5M</option><option>USD 5M+</option><option>Not decided yet</option></select></div>
                    <div class="form-group full"><label for="detailedRequirements">Detailed Requirements</label><textarea id="detailedRequirements" name="detailedRequirements" placeholder="Project goals, operational challenges, storage requirements, production capacity targets, preferred technologies, site information, or reference projects." required></textarea></div>
                    <button class="submit-industrial" type="submit">Request Project Consultation</button>
                </form>
            </div>
        </section>`;
}

function renderPageModule(module, page) {
  const eyebrow = module.eyebrow ? `<span class="eyebrow">${escapeHtml(module.eyebrow)}</span>` : '';
  const title = module.title ? `<h2>${escapeHtml(module.title)}</h2>` : '';
  const text = renderModuleText(module.text);
  const cta = module.ctaText && module.ctaHref
    ? `<a class="btn-industrial" href="${escapeHtml(module.ctaHref)}">${escapeHtml(module.ctaText)}</a>`
    : '';
  const sectionTheme = module.theme === 'dark' ? 'dark' : 'soft';
  const sectionId = module.anchor ? ` id="${escapeHtml(module.anchor)}"` : '';

  if (module.type === 'hero') {
    if (module.variant === 'page-hero') {
      return `
        <section class="page-hero cms-module">
            <div class="container">${eyebrow}${module.title ? `<h1>${escapeHtml(module.title)}</h1>` : ''}${text}</div>
        </section>`;
    }
    return `
        <section class="cms-module cms-hero-module">
            <div class="container">
                <div class="cms-module-copy">${eyebrow}${title}${text}<div class="btn-row">${cta}</div></div>
                ${module.image ? `<img src="${escapeHtml(module.image)}" alt="${escapeHtml(module.title || module.label || 'Page image')}">` : ''}
            </div>
        </section>`;
  }

  if (module.type === 'cards') {
    if (module.variant === 'chip-list') {
      return `
        <section class="section-band ${sectionTheme} cms-module"${sectionId}>
            <div class="container">
                ${renderModuleHeader(eyebrow, title, text)}
                ${renderChipGrid(module.items || [])}
            </div>
        </section>`;
    }

    if (module.variant === 'process-strip') {
      const steps = (module.items || []).map((item, index) => `
                <div class="process-step">
                    <span>${String(index + 1).padStart(2, '0')}</span>
                    <h3>${escapeHtml(item.title || 'Step')}</h3>
                    ${renderModuleText(item.text)}
                </div>`).join('');
      return `
        <section class="section-band ${sectionTheme} cms-module"${sectionId}>
            <div class="container">
                ${renderModuleHeader(eyebrow, title, text)}
                <div class="process-strip">${steps}
                </div>
            </div>
        </section>`;
    }

    if (module.variant === 'proof-list') {
      const proofItems = (module.items || [])
        .filter(item => item.title || item.text)
        .map(item => item.href ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.title || item.text)}</a>` : `<span>${escapeHtml(item.title || item.text)}</span>`)
        .join('');
      return `
        <section class="section-band ${sectionTheme} cms-module"${sectionId}>
            <div class="container">
                <div class="section-header">${eyebrow}${title}${text}</div>
                <div class="proof-list">${proofItems}</div>
            </div>
        </section>`;
    }

    if (module.variant === 'faq-list') {
      const faqs = (module.items || []).map(item => `
                <div class="faq-item">
                    <h3>${escapeHtml(item.title || 'Question')}</h3>
                    ${renderModuleText(item.text)}
                </div>`).join('');
      const hasHeader = module.eyebrow || module.title || module.text;
      return `
        <section class="section-band ${sectionTheme} cms-module ${hasHeader ? '' : 'compact-faq-module'}"${sectionId}>
            <div class="container">
                ${hasHeader ? `<div class="section-header">${eyebrow}${title}${text}</div>` : ''}
                <div class="faq-list-upgrade">${faqs}
                </div>
            </div>
        </section>`;
    }

    const gridClass = module.grid === 'two' ? 'card-grid two' : module.grid === 'four' ? 'card-grid four' : 'card-grid';
    const cards = (module.items || []).map(item => `
                <article class="content-card">
                    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || 'Solution image')}">` : ''}
                    <div class="${item.image ? '' : 'card-body'}">
                        <h3>${escapeHtml(item.title || 'Card')}</h3>
                        ${renderCardText(item.text)}
                        ${item.href ? `<a class="text-link" href="${escapeHtml(item.href)}">Learn more</a>` : ''}
                    </div>
                </article>`).join('');
    return `
        <section class="section-band ${sectionTheme} cms-module"${sectionId}>
            <div class="container">
                ${renderModuleHeader(eyebrow, title, text)}
                <div class="${gridClass}">${cards}
                </div>
            </div>
        </section>`;
  }

  if (module.type === 'dynamic' && module.variant === 'latest-blog') {
    const latestSectionClass = page === 'home' ? 'section-band soft home-knowledge-section cms-module' : `section-band ${sectionTheme} cms-module`;
    const latestEyebrow = page === 'home' ? '<span class="eyebrow">Latest Case Studies</span>' : eyebrow;
    const latestTitle = page === 'home' ? '<h2>Recently published automation cases from real warehouse and factory projects.</h2>' : title;
    const latestText = page === 'home'
      ? `<p>${escapeHtml(module.text || 'Browse the newest ASRS, smart factory, packaging automation, cold storage, and industrial manufacturing cases published from the CMS.')}</p>`
      : text;
    const caseLinks = `
                    <div class="case-link-stack">
                        <a class="text-link" href="case-studies.html?solution=asrs#caseGrid">ASRS cases</a>
                        <a class="text-link" href="case-studies.html?industry=manufacturing-industrial#caseGrid">Manufacturing cases</a>
                        <a class="text-link" href="case-studies.html?industry=packaging-printing#caseGrid">Packaging cases</a>
                    </div>`;
    return `
        <section class="${latestSectionClass}">
            <div class="container">
                <div class="section-header">
                    ${latestEyebrow}${latestTitle}${latestText}
                    ${page === 'home' ? caseLinks : (module.ctaText && module.ctaHref ? `<a class="text-link" href="${escapeHtml(module.ctaHref)}">${escapeHtml(module.ctaText)}</a>` : '')}
                </div>
                <div class="card-grid" id="latestBlogGrid"></div>
            </div>
        </section>`;
  }

  if (module.type === 'dynamic' && module.variant === 'contact-form') {
    return renderContactFormModule(module, eyebrow, title, text, sectionTheme);
  }

  if (module.type === 'cta') {
    return `
        <section class="cta-panel cms-module">
            <div class="container">
                <div>${eyebrow}${title}${text}</div>
                ${cta}
            </div>
        </section>`;
  }

  return `
        <section class="section-band ${sectionTheme} cms-module"${sectionId}>
            <div class="container">
                <div class="section-header">${eyebrow}${title}${text}</div>
            </div>
        </section>`;
}

function renderMain(page, modules) {
  return `<main data-static-page-modules="true">${modules.map(module => renderPageModule(module, page)).join('')}
    </main>`;
}

function removeLegacyContactSubmitScript(html) {
  return html.replace(/\s*<script>\s*document\.getElementById\('contactInquiryForm'\)\.addEventListener\('submit'[\s\S]*?<\/script>\s*(?=<\/body>)/, '\n');
}

function bakePage(page, modules) {
  const file = PAGE_FILES[page];
  if (!file) return false;
  if (!modules.length) return false;

  const filePath = path.resolve(file);
  let html = fs.readFileSync(filePath, 'utf8');
  const nextMain = renderMain(page, modules);
  html = html.replace(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/, nextMain);
  if (page === 'contact') {
    html = removeLegacyContactSubmitScript(html);
  }
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Baked ${page} -> ${file} (${modules.length} modules)`);
  return true;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshotPath = path.resolve(options.snapshot);
  const { PAGE_MODULE_SNAPSHOT } = require(snapshotPath);
  const pages = options.pages || Object.keys(PAGE_MODULE_SNAPSHOT.pages || {});

  let count = 0;
  for (const page of pages) {
    const modules = PAGE_MODULE_SNAPSHOT.pages?.[page] || [];
    if (bakePage(page, modules)) count += 1;
  }

  console.log(`Updated ${count} HTML files.`);
}

main();
