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
                    <div><h3>Solutions</h3><a href="solutions.html#asrs">Warehouse Automation</a><a href="solutions.html#factory">Smart Factory Automation</a><a href="solutions.html#machinery">Industrial Manufacturing</a></div>
                    <div><h3>Industries</h3><a href="industries.html">Warehousing</a><a href="industries.html#manufacturing">Manufacturing</a><a href="industries.html#food">Food & Beverage</a><a href="industries.html#packaging">Packaging</a><a href="industries.html#automotive">Automotive</a><a href="industries.html#electronics">Electronics</a></div>
                    <div><h3>Resources</h3><a href="case-studies.html">Case Studies</a><a href="blog.html">Knowledge Center</a><a href="blog.html">Blog</a><a href="blog.html">YouTube Channel</a></div>
                    <div><h3>Contact</h3><span>Website: 13asrs.com</span><span>Email: pjm@13asrs.com</span><span>Location: China</span></div>
                </div>
            </div>
            <div class="footer-bottom"><p>&copy; 2026 13ASRS. All rights reserved.</p></div>
        </div>
    `;
}

async function renderLatestBlogs(containerId, limit = 1) {
    const container = document.getElementById(containerId);
    if (!container || typeof blogApi === 'undefined') return;

    container.innerHTML = '<div class="loading-message">Loading latest blog posts...</div>';
    try {
        const blogs = await blogApi.getAllBlogs();
        const latest = [...blogs].filter(blog => !isPlaceholderBlog(blog)).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
        if (!latest.length) {
            container.innerHTML = `
                <div class="knowledge-empty-grid">
                    <a class="knowledge-topic-card" href="solutions.html#asrs"><span>01</span><h3>Warehouse Automation</h3><p>ASRS, shuttle systems, WMS/WES, and high-density storage planning.</p></a>
                    <a class="knowledge-topic-card" href="solutions.html#factory"><span>02</span><h3>Smart Factory</h3><p>AGV logistics, robotic handling, line feeding, and production flow.</p></a>
                    <a class="knowledge-topic-card" href="case-studies.html"><span>03</span><h3>Project References</h3><p>Review case examples before planning your next automation project.</p></a>
                </div>
            `;
            return;
        }
        container.innerHTML = latest.map(blog => `
            <article class="content-card media-card">
                <img src="${getBlogCover(blog)}" alt="${blog.title}">
                <div>
                    <span class="eyebrow">${blog.category || 'Blog'}</span>
                    <h3>${blog.title}</h3>
                    <p>${getBlogSummary(blog, 130)}</p>
                    <div class="mini-video">${renderYouTubeFrame(blog.youtubeUrl, blog.title)}</div>
                    <a class="text-link" href="blog-detail.html?id=${encodeURIComponent(blog.id)}">Read article</a>
                </div>
            </article>
        `).join('');
    } catch (error) {
        console.error('Error rendering latest blogs:', error);
        container.innerHTML = '<div class="loading-message">Unable to load blog posts.</div>';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setActiveNavigation();
    upgradeFooter();
    renderLatestBlogs('latestBlogGrid', 1);
});
