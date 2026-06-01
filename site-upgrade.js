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

async function renderLatestBlogs(containerId, limit = 3) {
    const container = document.getElementById(containerId);
    if (!container || typeof blogApi === 'undefined') return;

    container.innerHTML = '<div class="loading-message">Loading latest blog posts...</div>';
    try {
        const blogs = await blogApi.getAllBlogs();
        const latest = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
        if (!latest.length) {
            container.innerHTML = '<div class="loading-message">No blog posts yet.</div>';
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
    renderLatestBlogs('latestBlogGrid', 3);
});
