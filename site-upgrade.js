function getYouTubeEmbedUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url, window.location.origin);
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
    } catch (error) {
        console.warn('Invalid YouTube URL:', url);
    }
    return '';
}

function renderYouTubeFrame(url, title = '13ASRS project video') {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (!embedUrl) {
        return '<div class="video-placeholder">YouTube project video</div>';
    }
    return `<iframe src="${embedUrl}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getBlogCover(blog) {
    if (blog.coverImage) return blog.coverImage;
    const imgMatch = (blog.content || '').match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    return imgMatch ? imgMatch[1] : 'system-acr.webp';
}

function getBlogSummary(blog, length = 150) {
    const source = blog.summary || blog.plainText || (blog.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return source.length > length ? `${source.substring(0, length)}...` : source;
}

function isPlaceholderBlog(blog) {
    const text = `${blog.title || ''} ${blog.summary || ''} ${blog.plainText || ''} ${blog.content || ''}`.toLowerCase();
    return /tiandikaili|asdascawfq|wwwwww|test blog|测试/.test(text);
}

function setActiveNavigation() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    const aliases = {
        'insights.html': 'blog.html',
        'services.html': 'solutions.html'
    };
    const activeTarget = aliases[current] || current;
    document.querySelectorAll('nav a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href === activeTarget) {
            link.classList.add('active');
        }
    });
}

function upgradeFooter() {
    const footer = document.querySelector('footer');
    if (!footer) return;
    footer.innerHTML = `
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo"><img src="logo.jpg" alt="13ASRS"></div>
                <div class="footer-columns">
                    <div><h3>Solutions</h3><a href="solutions.html#asrs">Warehouse Automation</a><a href="asrs-cost.html">ASRS Cost Guide</a><a href="asrs-design.html">ASRS Design Guide</a><a href="solutions.html#factory">Smart Factory Automation</a><a href="solutions.html#machinery">Industrial Manufacturing</a></div>
                    <div><h3>Industries</h3><a href="industries.html">Warehousing</a><a href="industries.html#manufacturing">Manufacturing</a><a href="industries.html#food">Food & Beverage</a><a href="industries.html#packaging">Packaging</a><a href="industries.html#automotive">Automotive</a><a href="industries.html#electronics">Electronics</a></div>
                    <div><h3>Resources</h3><a href="case-studies.html">Case Studies</a><a href="blog.html">Knowledge Center</a><a href="blog.html">Blog</a><a href="https://www.youtube.com/channel/UCg4UaJdHvit-Ny9QNRPD7Mw" target="_blank" rel="noopener">YouTube Channel</a></div>
                    <div><h3>Contact</h3><span>Website: 13asrs.com</span><span>Email: pjm@13asrs.com</span><span>Location: China</span></div>
                </div>
            </div>
            <div class="footer-bottom"><p>&copy; 2026 13ASRS. All rights reserved.</p></div>
        </div>
    `;
}

const HOME_FALLBACK_CASES = [
    {
        id: 'fallback-chemical-asrs',
        title: 'Shuttle ASRS Warehouse for Chemical Industry',
        industryLabel: 'Chemical & Petrochemical',
        solutionLabel: 'ASRS / Automated Storage & Retrieval Systems',
        summary: '18m shuttle ASRS with WMS integration improves storage density, throughput, and material handling safety.',
        coverImage: 'solutions-asrs-technology.webp',
        href: 'case-ecommerce.html',
    },
    {
        id: 'fallback-pharma-asrs',
        title: 'Stacker Crane ASRS for Pharmaceutical Storage',
        industryLabel: 'Pharmaceutical & Biotech',
        solutionLabel: 'ASRS / Automated Storage & Retrieval Systems',
        summary: 'Crane ASRS supports controlled storage, batch visibility, traceability, and reliable 24/7 handling.',
        coverImage: 'system-crane.webp',
        href: 'case-pharma.html',
    },
    {
        id: 'fallback-ecommerce-miniload',
        title: 'Miniload Automation for E-commerce Fulfillment',
        industryLabel: 'E-commerce Fulfillment',
        solutionLabel: 'ASRS / Automated Storage & Retrieval Systems',
        summary: 'Dense miniload automation helps handle high SKU mix, order waves, and labor-intensive picking.',
        coverImage: 'system-shuttle.webp',
        href: 'case-miniload.html',
    },
    {
        id: 'fallback-manufacturing-agv',
        title: 'AGV Logistics for Smart Factory Material Flow',
        industryLabel: 'Manufacturing / Industrial',
        solutionLabel: 'Conveyor Systems / Automated Transport',
        summary: 'AGV routes connect storage, production, and assembly flow to reduce manual line feeding.',
        coverImage: 'system-agv.webp',
        href: 'case-automotive.html',
    },
    {
        id: 'fallback-packaging-line',
        title: 'Packaging Automation Case Library',
        industryLabel: 'Packaging & Printing',
        solutionLabel: 'Packaging Automation',
        summary: 'Browse packaging, filling, labeling, cartoning, printing, and production line automation references.',
        coverImage: 'solutions-production-line.webp',
        href: 'case-studies.html?industry=packaging-printing&solution=packaging-automation#caseGrid',
    },
    {
        id: 'fallback-cold-storage',
        title: 'Cold Storage Automation Case Library',
        industryLabel: 'Cold Chain / Frozen Food',
        solutionLabel: 'Cold Storage / Low-Temperature Automation',
        summary: 'Explore low-temperature automation references for cold chain storage and frozen food operations.',
        coverImage: 'hero-case-studies-automation.webp',
        href: 'case-studies.html?industry=cold-chain-frozen-food&solution=cold-storage-automation#caseGrid',
    },
];

function getCaseLink(caseItem) {
    return caseItem.href || `blog-detail.html?id=${encodeURIComponent(caseItem.id)}`;
}

function renderLatestCaseSlider(caseItems) {
    const cards = caseItems.map((caseItem, index) => {
        const href = getCaseLink(caseItem);
        const title = escapeHtml(caseItem.title || 'Automation Case Study');
        const image = escapeHtml(getBlogCover(caseItem));
        const industry = escapeHtml(caseItem.industryLabel || caseItem.category || 'Case Study');
        const solution = escapeHtml(caseItem.solutionLabel || 'Automation Solution');
        const summary = escapeHtml(getBlogSummary(caseItem, 125));
        return `
            <article class="latest-case-card">
                <a class="latest-case-media" href="${escapeHtml(href)}"><img src="${image}" alt="${title}"></a>
                <div class="latest-case-body">
                    <span class="eyebrow">${industry}</span>
                    <h3><a href="${escapeHtml(href)}">${title}</a></h3>
                    <p>${summary}</p>
                    <div class="latest-case-meta"><span>${solution}</span><span>${String(index + 1).padStart(2, '0')}</span></div>
                    <a class="text-link" href="${escapeHtml(href)}">View complete case and video</a>
                </div>
            </article>
        `;
    }).join('');

    return `
        <div class="latest-case-slider" data-latest-case-slider>
            <div class="latest-case-controls">
                <a class="text-link" href="case-studies.html">Browse all case studies</a>
            </div>
            <div class="latest-case-frame">
                <button class="slider-btn slider-btn-prev" type="button" data-slider-prev aria-label="Previous case">&lsaquo;</button>
                <div class="latest-case-track" tabindex="0">${cards}</div>
                <button class="slider-btn slider-btn-next" type="button" data-slider-next aria-label="Next case">&rsaquo;</button>
            </div>
        </div>
    `;
}

function hydrateLatestCaseSliders(root = document) {
    root.querySelectorAll('[data-latest-case-slider]').forEach(slider => {
        if (slider.dataset.bound === 'true') return;
        slider.dataset.bound = 'true';
        const track = slider.querySelector('.latest-case-track');
        const prev = slider.querySelector('[data-slider-prev]');
        const next = slider.querySelector('[data-slider-next]');
        const scrollByCard = direction => {
            const amount = track?.clientWidth || 360;
            track?.scrollBy({ left: direction * amount, behavior: 'smooth' });
        };
        prev?.addEventListener('click', () => scrollByCard(-1));
        next?.addEventListener('click', () => scrollByCard(1));
    });
}

async function renderLatestCases(containerId, limit = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (typeof blogApi === 'undefined') {
        container.innerHTML = renderLatestCaseSlider(HOME_FALLBACK_CASES.slice(0, limit));
        hydrateLatestCaseSliders(container);
        if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
        return;
    }

    container.innerHTML = '<div class="loading-message">Loading latest case studies...</div>';
    if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
    try {
        const cases = typeof blogApi.getAllCases === 'function' ? await blogApi.getAllCases() : [];
        const latest = [...cases]
            .filter(caseItem => !isPlaceholderBlog(caseItem))
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, limit);
        const caseItems = latest.length ? latest : HOME_FALLBACK_CASES.slice(0, limit);
        container.innerHTML = renderLatestCaseSlider(caseItems);
        hydrateLatestCaseSliders(container);
        if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
    } catch (error) {
        console.error('Error rendering latest cases:', error);
        container.innerHTML = renderLatestCaseSlider(HOME_FALLBACK_CASES.slice(0, limit));
        hydrateLatestCaseSliders(container);
        if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
    }
}

function getCurrentPageKey() {
    const file = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/i, '');
    if (!file || file === 'index') return 'home';
    return file;
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

const HOME_CASE_LINKS = {
    'home-core-asrs': 'case-studies.html?solution=asrs#caseGrid',
    'home-core-factory': 'case-studies.html?industry=manufacturing-industrial&solution=conveyor-transport#caseGrid',
    'home-core-machinery': 'case-studies.html?industry=manufacturing-industrial#caseGrid',
    'home-case-chemical': 'case-studies.html?industry=chemical-petrochemical&solution=asrs#caseGrid',
    'home-case-pharma': 'case-studies.html?industry=pharmaceutical-biotech&solution=asrs#caseGrid',
    'home-case-agv': 'case-studies.html?industry=manufacturing-industrial&solution=conveyor-transport#caseGrid',
};

const SOLUTIONS_CASE_LINKS = {
    'solutions-factory-production': 'case-studies.html?solution=production-line#caseGrid',
    'solutions-factory-robotic': 'case-studies.html?solution=robotics-integration#caseGrid',
    'solutions-factory-flow': 'case-studies.html?solution=conveyor-transport#caseGrid',
    'solutions-factory-upgrade': 'case-studies.html?solution=smart-factory#caseGrid',
    'solutions-machinery-printing': 'case-studies.html?industry=packaging-printing&solution=printing-inkjet-flexo-ci#caseGrid',
    'solutions-machinery-filling': 'case-studies.html?industry=packaging-printing&solution=film-blowing-extrusion#caseGrid',
    'solutions-machinery-laser': 'case-studies.html?solution=laser-industrial-machining#caseGrid',
};

const INDUSTRIES_CASE_LINKS = {
    'industries-proof-1': 'case-studies.html#caseGrid',
    'industries-proof-2': 'case-studies.html#caseGrid',
    'industries-proof-3': 'case-studies.html?solution=asrs#caseGrid',
    'industries-proof-4': 'case-studies.html?solution=smart-factory#caseGrid',
    'industries-proof-5': 'case-studies.html?industry=manufacturing-industrial#caseGrid',
    'industry-chemical': 'case-studies.html?industry=chemical-petrochemical#caseGrid',
    'industry-food': 'case-studies.html?industry=food-beverage#caseGrid',
    'industry-packaging': 'case-studies.html?industry=packaging-printing#caseGrid',
    'industry-cold': 'case-studies.html?industry=cold-chain-frozen-food#caseGrid',
    'industry-pharma': 'case-studies.html?industry=pharmaceutical-biotech#caseGrid',
    'industry-printing': 'case-studies.html?industry=packaging-printing&solution=printing-inkjet-flexo-ci#caseGrid',
    'industry-manufacturing': 'case-studies.html?industry=manufacturing-industrial#caseGrid',
    'industry-logistics': 'case-studies.html?industry=logistics-distribution#caseGrid',
    'industry-electronics': 'case-studies.html?industry=electronics-semiconductors#caseGrid',
    'industry-automotive': 'case-studies.html?industry=automotive-transportation#caseGrid',
    'industry-building-materials': 'case-studies.html?solution=material-pallet-handling#caseGrid',
    'tech-asrs': 'case-studies.html?solution=asrs#caseGrid',
    'tech-shuttle': 'case-studies.html?solution=asrs#caseGrid',
    'tech-stacker': 'case-studies.html?solution=asrs#caseGrid',
    'tech-agv': 'case-studies.html?solution=conveyor-transport#caseGrid',
    'tech-smart-factory': 'case-studies.html?solution=smart-factory#caseGrid',
    'tech-printing': 'case-studies.html?industry=packaging-printing#caseGrid',
    'tech-filling': 'case-studies.html?solution=filling-bottling#caseGrid',
    'tech-film': 'case-studies.html?solution=film-blowing-extrusion#caseGrid',
    'tech-laser': 'case-studies.html?solution=laser-industrial-machining#caseGrid',
};

function getModuleItemHref(item = {}) {
    if (getCurrentPageKey() === 'home' && HOME_CASE_LINKS[item.id]) {
        return HOME_CASE_LINKS[item.id];
    }
    if (getCurrentPageKey() === 'solutions' && SOLUTIONS_CASE_LINKS[item.id]) {
        return SOLUTIONS_CASE_LINKS[item.id];
    }
    if (getCurrentPageKey() === 'industries' && INDUSTRIES_CASE_LINKS[item.id]) {
        return INDUSTRIES_CASE_LINKS[item.id];
    }
    return item.href || '';
}

function renderChipGrid(items = []) {
    return `<div class="industry-chip-grid">${items.map(item => {
        const href = getModuleItemHref(item) || '#';
        return `<a class="industry-chip" href="${escapeHtml(href)}">${escapeHtml(item.title || item.text || 'Link')}</a>`;
    }).join('')}</div>`;
}

function renderCaseLibraryModule(module, eyebrow, title, text, sectionTheme) {
    const fallbackCases = (module.items || []).map(item => `
        <article class="content-card media-card case-card-filter" data-industry="${escapeHtml(item.industry || '')}" data-solution="${escapeHtml(item.solution || '')}">
            ${item.image ? `<a class="case-card-media" href="${escapeHtml(item.href || '#')}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || 'Case study')}"></a>` : ''}
            <div>
                ${item.alt ? `<span class="eyebrow">${escapeHtml(item.alt)}</span>` : ''}
                <h3>${escapeHtml(item.title || 'Automation Case Study')}</h3>
                ${renderModuleText(item.text)}
                ${item.href ? `<a class="text-link" href="${escapeHtml(item.href)}">View complete case and video</a>` : ''}
            </div>
        </article>
    `).join('');

    return `
        <section class="section-band ${sectionTheme} cms-module">
            <div class="container">
                ${renderModuleHeader(eyebrow, title, text)}
                <div class="filter-bar-upgrade">
                    <select id="industryFilter" aria-label="Industry filter">
                        <option value="all">Industry: All</option>
                        <option value="food-beverage">Food & Beverage</option>
                        <option value="pharmaceutical-biotech">Pharmaceutical & Biotech</option>
                        <option value="packaging-printing">Packaging & Printing</option>
                        <option value="cold-chain-frozen-food">Cold Chain / Frozen Food</option>
                        <option value="logistics-distribution">Logistics & Distribution</option>
                        <option value="ecommerce-fulfillment">E-commerce Fulfillment</option>
                        <option value="manufacturing-industrial">Manufacturing / Industrial</option>
                        <option value="chemical-petrochemical">Chemical & Petrochemical</option>
                        <option value="automotive-transportation">Automotive & Transportation</option>
                        <option value="electronics-semiconductors">Electronics & Semiconductors</option>
                        <option value="other">Other</option>
                    </select>
                    <select id="solutionFilter" aria-label="Solution filter">
                        <option value="all">Solution: All</option>
                        <option value="asrs">ASRS / Automated Storage & Retrieval Systems</option>
                        <option value="conveyor-transport">Conveyor Systems / Automated Transport</option>
                        <option value="smart-factory">Smart Factory / Factory Automation</option>
                        <option value="production-line">Production Line Automation</option>
                        <option value="packaging-automation">Packaging Automation</option>
                        <option value="wms-wes">Intelligent WMS / WES Integration</option>
                        <option value="robotics-integration">Robotics Integration</option>
                        <option value="other-industrial-automation">Other Industrial Automation Solutions</option>
                    </select>
                </div>
                <div class="card-grid two" id="caseGrid">${fallbackCases}</div>
            </div>
        </section>
    `;
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
        </section>
    `;
}

function renderPageModule(module) {
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
                </section>
            `;
        }
        return `
            <section class="cms-module cms-hero-module">
                <div class="container">
                    <div class="cms-module-copy">${eyebrow}${title}${text}<div class="btn-row">${cta}</div></div>
                    ${module.image ? `<img src="${escapeHtml(module.image)}" alt="${escapeHtml(module.title || module.label || 'Page image')}">` : ''}
                </div>
            </section>
        `;
    }

    if (module.type === 'cards') {
        if (module.variant === 'chip-list') {
            return `
                <section class="section-band ${sectionTheme} cms-module"${sectionId}>
                    <div class="container">
                        ${renderModuleHeader(eyebrow, title, text)}
                        ${renderChipGrid(module.items || [])}
                    </div>
                </section>
            `;
        }

        if (module.variant === 'process-strip') {
            const steps = (module.items || []).map((item, index) => `
                <div class="process-step">
                    <span>${String(index + 1).padStart(2, '0')}</span>
                    <h3>${escapeHtml(item.title || 'Step')}</h3>
                    ${renderModuleText(item.text)}
                </div>
            `).join('');
            return `
                <section class="section-band ${sectionTheme} cms-module"${sectionId}>
                    <div class="container">
                        ${renderModuleHeader(eyebrow, title, text)}
                        <div class="process-strip">${steps}</div>
                    </div>
                </section>
            `;
        }

        if (module.variant === 'proof-list') {
            const proofItems = (module.items || [])
                .filter(item => item.title || item.text)
                .map(item => {
                    const label = escapeHtml(item.title || item.text);
                    const href = getModuleItemHref(item);
                    return href ? `<a href="${escapeHtml(href)}">${label}</a>` : `<span>${label}</span>`;
                })
                .join('');
            return `
                <section class="section-band ${sectionTheme} cms-module"${sectionId}>
                    <div class="container">
                        <div class="section-header">${eyebrow}${title}${text}</div>
                        <div class="proof-list">${proofItems}</div>
                    </div>
                </section>
            `;
        }

        if (module.variant === 'faq-list') {
            const faqs = (module.items || []).map(item => `
                <div class="faq-item">
                    <h3>${escapeHtml(item.title || 'Question')}</h3>
                    ${renderModuleText(item.text)}
                </div>
            `).join('');
            return `
                <section class="section-band ${sectionTheme} cms-module"${sectionId}>
                    <div class="container">
                        ${(module.eyebrow || module.title || module.text) ? `<div class="section-header">${eyebrow}${title}${text}</div>` : ''}
                        <div class="faq-list-upgrade">${faqs}</div>
                    </div>
                </section>
            `;
        }

        const gridClass = module.grid === 'two' ? 'card-grid two' : module.grid === 'four' ? 'card-grid four' : 'card-grid';
        const cards = (module.items || []).map(item => {
            const href = getModuleItemHref(item);
            return `
                <article class="content-card">
                    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || 'Solution image')}">` : ''}
                    <div class="${item.image ? '' : 'card-body'}">
                        <h3>${escapeHtml(item.title || 'Card')}</h3>
                        ${renderCardText(item.text)}
                        ${href ? `<a class="text-link" href="${escapeHtml(href)}">Learn more</a>` : ''}
                    </div>
                </article>
            `;
        }).join('');
        return `
            <section class="section-band ${sectionTheme} cms-module"${sectionId}>
                <div class="container">
                    ${renderModuleHeader(eyebrow, title, text)}
                    <div class="${gridClass}">${cards}</div>
                </div>
            </section>
        `;
    }

    if (module.type === 'dynamic') {
        if (module.variant === 'latest-blog') {
            const isHomeLatest = getCurrentPageKey() === 'home';
            const latestSectionClass = isHomeLatest ? 'section-band soft home-knowledge-section cms-module' : `section-band ${sectionTheme} cms-module`;
            const latestEyebrow = isHomeLatest ? '<span class="eyebrow">Latest Case Studies</span>' : eyebrow;
            const latestTitle = isHomeLatest ? '<h2>Recently published automation cases from real warehouse and factory projects.</h2>' : title;
            const latestText = isHomeLatest
                ? '<p>Browse the newest ASRS, smart factory, packaging automation, cold storage, and industrial manufacturing cases published from the CMS.</p>'
                : text;
            const caseLinks = `
                <div class="case-link-stack">
                    <a class="text-link" href="case-studies.html?solution=asrs#caseGrid">ASRS cases</a>
                    <a class="text-link" href="case-studies.html?industry=manufacturing-industrial#caseGrid">Manufacturing cases</a>
                    <a class="text-link" href="case-studies.html?industry=packaging-printing#caseGrid">Packaging cases</a>
                </div>
            `;
            return `
                <section class="${latestSectionClass}">
                    <div class="container">
                        <div class="section-header">
                            ${latestEyebrow}${latestTitle}${latestText}
                            ${isHomeLatest ? caseLinks : (module.ctaText && module.ctaHref ? `<a class="text-link" href="${escapeHtml(module.ctaHref)}">${escapeHtml(module.ctaText)}</a>` : '')}
                        </div>
                        <div class="card-grid" id="latestBlogGrid"></div>
                    </div>
                </section>
            `;
        }

        if (module.variant === 'blog-index') {
            return `
                <section class="section-band ${sectionTheme} blog-index-section cms-module">
                    <div class="container">
                        <div class="section-header blog-index-header">${eyebrow}${title}${text}</div>
                        ${renderChipGrid(module.items || [])}
                        <div id="blogFeaturedContainer" class="blog-featured-slot"></div>
                        <div class="blog-index-grid" id="blogListContainer"><div class="loading-message"><h3>Loading published articles</h3><p>Fetching the latest published blog posts.</p></div></div>
                    </div>
                </section>
            `;
        }

        if (module.variant === 'case-library') {
            return renderCaseLibraryModule(module, eyebrow, title, text, sectionTheme);
        }

        if (module.variant === 'contact-form') {
            return renderContactFormModule(module, eyebrow, title, text, sectionTheme);
        }
    }

    if (module.type === 'media') {
        const media = module.youtubeUrl
            ? `<div class="video-frame">${renderYouTubeFrame(module.youtubeUrl, module.title || '13ASRS video')}</div>`
            : (module.image ? `<img src="${escapeHtml(module.image)}" alt="${escapeHtml(module.title || module.label || 'Page image')}">` : '<div class="video-frame"><div class="video-placeholder">Media placeholder</div></div>');
        return `
            <section class="section-band soft cms-module cms-media-module">
                <div class="container">
                    <div class="cms-module-copy">${eyebrow}${title}${text}${cta}</div>
                    <div class="cms-module-media">${media}</div>
                </div>
            </section>
        `;
    }

    if (module.type === 'cta') {
        return `
            <section class="cta-panel cms-module">
                <div class="container">
                    <div>${eyebrow}${title}${text}</div>
                    ${cta}
                </div>
            </section>
        `;
    }

    return `
        <section class="section-band ${sectionTheme} cms-module"${sectionId}>
            <div class="container">
                <div class="section-header">${eyebrow}${title}${text}</div>
            </div>
        </section>
    `;
}

function applyPageHeroModule(main, module) {
    const hero = main.querySelector('.industrial-hero, .page-hero');
    if (!hero) return;

    const title = hero.querySelector('h1, h2');
    const textHost = title?.parentElement || hero.querySelector('.container') || hero;
    const eyebrow = textHost.querySelector('.eyebrow') || hero.querySelector('.eyebrow');

    if (eyebrow && module.eyebrow) eyebrow.textContent = module.eyebrow;
    if (title && module.title) title.textContent = module.title;

    const paragraphs = String(module.text || '')
        .split(/\n{2,}/)
        .map(block => block.trim())
        .filter(Boolean);
    const existingParagraphs = [...textHost.querySelectorAll('p')];
    existingParagraphs.forEach((paragraph, index) => {
        if (paragraphs[index]) {
            paragraph.innerHTML = escapeHtml(paragraphs[index]).replace(/\n/g, '<br>');
        } else {
            paragraph.remove();
        }
    });

    const anchor = title || eyebrow;
    paragraphs.slice(existingParagraphs.length).forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
        if (anchor?.nextSibling) {
            textHost.insertBefore(paragraph, anchor.nextSibling);
        } else {
            textHost.appendChild(paragraph);
        }
    });
    if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations(main);
}

async function hydrateCaseLibrary() {
    const industry = document.getElementById('industryFilter');
    const solution = document.getElementById('solutionFilter');
    const caseGrid = document.getElementById('caseGrid');
    if (!industry || !solution || !caseGrid) return;

    function filterCases() {
        document.querySelectorAll('.case-card-filter').forEach(card => {
            const industryMatch = industry.value === 'all' || card.dataset.industry === industry.value;
            const solutionValues = (card.dataset.solution || '').split(/\s+/);
            const solutionMatch = solution.value === 'all' || solutionValues.includes(solution.value);
            card.style.display = industryMatch && solutionMatch ? '' : 'none';
        });
    }

    function setFilterFromParam(select, value) {
        if (!value) return;
        const hasOption = Array.from(select.options).some(option => option.value === value);
        if (hasOption) select.value = value;
    }

    function applyUrlFilters() {
        const params = new URLSearchParams(window.location.search);
        setFilterFromParam(industry, params.get('industry'));
        setFilterFromParam(solution, params.get('solution'));
    }

    applyUrlFilters();
    industry.addEventListener('change', filterCases);
    solution.addEventListener('change', filterCases);

    if (typeof blogApi === 'undefined') {
        filterCases();
        return;
    }

    try {
        const blogs = typeof blogApi.getAllCases === 'function'
            ? await blogApi.getAllCases()
            : await blogApi.getAllBlogs();
        const cases = blogs.filter(blog => blog.industry && blog.solution);
        if (cases.length) {
            caseGrid.innerHTML = cases.map(blog => {
                const href = `blog-detail.html?id=${encodeURIComponent(blog.id)}`;
                const image = getBlogCover(blog);
                return `
                    <article class="content-card media-card case-card-filter" data-industry="${escapeHtml(blog.industry)}" data-solution="${escapeHtml(blog.solution)}">
                        <a class="case-card-media" href="${href}"><img src="${escapeHtml(image)}" alt="${escapeHtml(blog.title || 'Automation case study')}"></a>
                        <div>
                            <span class="eyebrow">${escapeHtml(blog.industryLabel || 'Case Study')}</span>
                            <h3>${escapeHtml(blog.title || 'Automation Case Study')}</h3>
                            <p>${escapeHtml(blog.summary || blog.plainText || '')}</p>
                            <div class="case-meta-grid"><span>${escapeHtml(blog.solutionLabel || blog.category || 'Automation Solution')}</span><span>${escapeHtml(blog.date || '')}</span></div>
                            <a class="text-link" href="${href}">View complete case and video</a>
                        </div>
                    </article>
                `;
            }).join('');
        }
        filterCases();
        if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
    } catch (error) {
        console.warn('Could not hydrate case library:', error);
        filterCases();
    }
    if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
}

function hydrateContactForm() {
    const form = document.getElementById('contactInquiryForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const button = form.querySelector('.submit-industrial');
        const originalText = button?.textContent || 'Request Project Consultation';
        if (button) {
            button.textContent = 'Sending...';
            button.disabled = true;
        }

        const value = id => document.getElementById(id)?.value || '';
        const formData = {
            to_email: 'pjm@13asrs.com',
            requestTitle: 'New Project Consultation Request',
            sourcePage: '13ASRS Contact Page',
            company: value('company'),
            address: value('countryCity'),
            industry: value('industry'),
            contact_person: value('contactPerson'),
            contactName: value('contactPerson'),
            phone: value('phone'),
            email: value('email'),
            reply_to: value('email'),
            whatsapp: value('whatsapp') || 'Optional / not provided',
            wechat: value('wechat') || 'Optional / not provided',
            project_type: value('projectType'),
            automation_interest: value('projectType'),
            detailed_requirements: value('detailedRequirements'),
            budget_range: value('budgetRange'),
            estimated_investment_range: value('budgetRange'),
            message: `13ASRS inquiry from ${value('company')}`
        };

        if (typeof emailjs === 'undefined') {
            alert('Failed to send. Please contact pjm@13asrs.com directly.');
            if (button) {
                button.textContent = originalText;
                button.disabled = false;
            }
            return;
        }

        emailjs.send('service_yp6on5e', 'template_66p84u8', formData)
            .then(function() {
                alert('Thank you. Your inquiry has been sent to 13ASRS.');
                form.reset();
            }, function(error) {
                console.log('EmailJS error:', error);
                alert('Failed to send. Please try again or contact pjm@13asrs.com directly.');
            })
            .finally(function() {
                if (button) {
                    button.textContent = originalText;
                    button.disabled = false;
                }
            });
    });
}

async function hydrateDynamicModules(page) {
    if (document.getElementById('latestBlogGrid')) await renderLatestCases('latestBlogGrid', 6);
    if (page === 'blog' && typeof initBlogPages === 'function') {
        await initBlogPages();
        window.blogPageHydratedFromModules = true;
    }
    await hydrateCaseLibrary();
    hydrateContactForm();
    if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
}

async function renderPageModules() {
    if (typeof pageApi === 'undefined') return;
    const page = getCurrentPageKey();
    try {
        const pageData = await pageApi.getPublicPage(page);
        const modules = Array.isArray(pageData.modules) ? pageData.modules : [];
        if (!modules.length) return;

        const main = document.querySelector('main');
        if (!main) return;

        const pageHeroModule = modules.find(module => module.variant === 'page-hero');
        if (modules.length === 1 && pageHeroModule) {
            applyPageHeroModule(main, pageHeroModule);
            await hydrateDynamicModules(page);
            if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
            return;
        }

        if (pageHeroModule) {
            main.innerHTML = modules.map(renderPageModule).join('');
            await hydrateDynamicModules(page);
            if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
            return;
        }

        const renderableModules = modules.filter(module => module !== pageHeroModule);
        if (!renderableModules.length) {
            if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'dynamicPageModules';
        wrapper.innerHTML = renderableModules.map(renderPageModule).join('');

        const hero = main.querySelector('.industrial-hero, .page-hero');
        if (hero && hero.nextSibling) {
            main.insertBefore(wrapper, hero.nextSibling);
        } else {
            main.prepend(wrapper);
        }
        await hydrateDynamicModules(page);
        if (typeof applyRuntimeTranslations === 'function') applyRuntimeTranslations();
    } catch (error) {
        console.warn('Page modules not loaded:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setActiveNavigation();
    upgradeFooter();
    window.pageModulesReady = renderPageModules().then(() => renderLatestCases('latestBlogGrid', 6));
});
