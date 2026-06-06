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

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getBlogExcerpt(blog, length = 170) {
    const html = blog.contentHtml || blog.content || '';
    const source = blog.summary || blog.plainText || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return source.length > length ? `${source.substring(0, length)}...` : source;
}

function getPublicBlogCover(blog) {
    if (typeof getBlogCover === 'function') return getBlogCover(blog);
    if (blog.coverImage) return blog.coverImage;
    const imgMatch = (blog.content || blog.contentHtml || '').match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    return imgMatch ? imgMatch[1] : 'system-acr.webp';
}

function buildArticleToc() {
    const content = document.getElementById('blogContent');
    const toc = document.getElementById('blogToc');
    const tocSection = document.getElementById('blogTocSection');
    if (!content || !toc) return;

    const headings = Array.from(content.querySelectorAll('h2, h3')).slice(0, 8);
    if (!headings.length) {
        toc.innerHTML = '';
        if (tocSection) tocSection.style.display = 'none';
        return;
    }

    if (tocSection) tocSection.style.display = '';

    toc.innerHTML = headings.map((heading, index) => {
        if (!heading.id) heading.id = slugifyHeading(heading.textContent, `section-${index + 1}`);
        return `<a href="#${heading.id}">${heading.textContent}</a>`;
    }).join('');
}

function renderRelatedCards(containerId, items, defaults) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const values = items.length ? items : defaults;
    container.innerHTML = values.slice(0, 3).map(item => {
        const label = typeof item === 'string' ? item : item.title;
        const href = typeof item === 'string' ? 'case-studies.html' : item.href;
        return `<a class="related-card" href="${href}"><span class="eyebrow">Recommended</span><h3>${label}</h3><p>Explore a relevant 13ASRS reference before planning your project.</p></a>`;
    }).join('');
}

// Load blog detail page
async function loadBlogDetail() {
    console.log('loadBlogDetail called, URL:', window.location.href);
    console.log('Search params:', window.location.search);
    const blogId = getUrlParameter('id');
    console.log('Loading blog with ID:', blogId, 'Type:', typeof blogId);

    const tBlogNotFound = getNestedValue(translations[currentLanguage], 'common.blog_not_found') || 'Blog Not Found';
    const tNoBlogId = getNestedValue(translations[currentLanguage], 'common.no_blog_id') || 'No blog ID specified. Please select a blog from the home page.';
    const tBackToHome = getNestedValue(translations[currentLanguage], 'common.back_to_home') || 'Back to home';
    if (!blogId) {
        // No blog ID specified, show error or redirect
        document.getElementById('blogTitle').textContent = tBlogNotFound;
        document.getElementById('blogContent').innerHTML = `<p>${tNoBlogId} <a href="index.html">${tBackToHome}</a></p>`;
        return;
    }

    try {
        const tLoadingBlog = getNestedValue(translations[currentLanguage], 'common.loading_blog') || 'Loading blog...';
        // Show loading state
        document.getElementById('blogContent').innerHTML = `<p style="text-align: center; color: #666;">${tLoadingBlog}</p>`;

        const blog = await blogApi.getBlogById(blogId);
        console.log('Loaded blog:', blog);

        const tBlogNotExist = getNestedValue(translations[currentLanguage], 'common.blog_not_exist') || 'The blog you are looking for does not exist or has been removed.';
        if (!blog) {
            document.getElementById('blogTitle').textContent = tBlogNotFound;
            document.getElementById('blogContent').innerHTML = `<p>${tBlogNotExist} <a href="index.html">${tBackToHome}</a></p>`;
            return;
        }

        // Set blog data
        document.getElementById('blogTitle').textContent = blog.title;
        document.getElementById('blogDate').textContent = blog.date;
        const blogCategory = document.getElementById('blogCategory');
        if (blogCategory) blogCategory.textContent = blog.category || '';
        const blogAuthor = document.getElementById('blogAuthor');
        if (blogAuthor) blogAuthor.textContent = blog.author || '13ASRS';
        const blogDateSide = document.getElementById('blogDateSide');
        if (blogDateSide) blogDateSide.textContent = blog.date || '-';
        const blogAuthorSide = document.getElementById('blogAuthorSide');
        if (blogAuthorSide) blogAuthorSide.textContent = blog.author || '13ASRS';
        const blogCategorySide = document.getElementById('blogCategorySide');
        if (blogCategorySide) blogCategorySide.textContent = blog.category || 'Blog';
        const blogSummary = document.getElementById('blogSummary');
        if (blogSummary) blogSummary.textContent = blog.summary || '';
        const blogCover = document.getElementById('blogCover');
        if (blogCover && typeof getBlogCover === 'function') {
            blogCover.src = getBlogCover(blog);
            blogCover.alt = blog.title;
        }
        const blogVideo = document.getElementById('blogVideo');
        if (blogVideo && typeof renderYouTubeFrame === 'function') {
            if (blog.youtubeUrl) {
                blogVideo.innerHTML = renderYouTubeFrame(blog.youtubeUrl, blog.title);
                blogVideo.style.display = '';
            } else {
                blogVideo.innerHTML = renderYouTubeFrame('', blog.title);
                blogVideo.style.display = '';
            }
        }
        if (blog.seoTitle) document.title = blog.seoTitle;
        if (blog.seoDescription) {
            const metaDescription = document.querySelector('meta[name="description"]');
            if (metaDescription) metaDescription.setAttribute('content', blog.seoDescription);
        }
        document.getElementById('blogContent').innerHTML = blog.content;
        const tocSection = document.getElementById('blogTocSection');
        if (tocSection) tocSection.style.display = blog.tocEnabled === false ? 'none' : '';
        if (blog.tocEnabled !== false) buildArticleToc();

        const relatedProjectItems = splitConfiguredList(blog.relatedProjects);
        if (blog.relatedCase) relatedProjectItems.unshift(blog.relatedCase);
        renderRelatedCards('relatedCaseStudies', relatedProjectItems, [
            { title: 'ASRS Project', href: 'case-ecommerce.html' },
            { title: 'AGV Project', href: 'case-automotive.html' },
            { title: 'Smart Factory Project', href: 'case-studies.html' }
        ]);
        renderRelatedCards('relatedSolutions', splitConfiguredList(blog.relatedSolutions), [
            { title: 'ASRS Warehouse Solution', href: 'solutions.html#asrs' },
            { title: 'AGV Solution', href: 'solutions.html#factory' },
            { title: 'Smart Factory Solution', href: 'solutions.html#factory' }
        ]);

        // Setup blog navigation (previous/next)
        await setupBlogNavigation(blog);

        // Load related blogs
        await loadRelatedBlogs(blog);
    } catch (error) {
        console.error('Error loading blog detail:', error);
        const tErrLoad = getNestedValue(translations[currentLanguage], 'common.error_loading_blog') || 'Error Loading Blog';
        const tErrLoadMsg = getNestedValue(translations[currentLanguage], 'common.error_loading_blog_msg') || 'An error occurred while loading the blog. Please try again later.';
        document.getElementById('blogTitle').textContent = tErrLoad;
        document.getElementById('blogContent').innerHTML = `<p>${tErrLoadMsg} <a href="index.html">${tBackToHome}</a></p>`;
    }
}

// Setup blog navigation links
async function setupBlogNavigation(currentBlog) {
    try {
        const blogs = await blogApi.getAllBlogs();

        // Sort blogs by date (newest first)
        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Find current blog index in sorted list
        const currentIndex = sortedBlogs.findIndex(b => b.id == currentBlog.id);

        const prevBlogLink = document.getElementById('prevBlog');
        const nextBlogLink = document.getElementById('nextBlog');

        if (!prevBlogLink || !nextBlogLink) return;

        const tNoNewer = getNestedValue(translations[currentLanguage], 'common.no_newer_posts') || '<- No newer posts';
        const tNoOlder = getNestedValue(translations[currentLanguage], 'common.no_older_posts') || 'No older posts ->';
        // Previous blog (newer blog if sorted newest first)
        if (currentIndex > 0) {
            const prevBlog = sortedBlogs[currentIndex - 1];
            prevBlogLink.href = `blog-detail.html?id=${encodeURIComponent(prevBlog.id)}`;
            prevBlogLink.textContent = `<- Newer: ${prevBlog.title.substring(0, 30)}${prevBlog.title.length > 30 ? '...' : ''}`;
            prevBlogLink.classList.remove('disabled');
        } else {
            prevBlogLink.href = '#';
            prevBlogLink.textContent = tNoNewer;
            prevBlogLink.classList.add('disabled');
        }

        // Next blog (older blog if sorted newest first)
        if (currentIndex < sortedBlogs.length - 1) {
            const nextBlog = sortedBlogs[currentIndex + 1];
            nextBlogLink.href = `blog-detail.html?id=${encodeURIComponent(nextBlog.id)}`;
            nextBlogLink.textContent = `Older: ${nextBlog.title.substring(0, 30)}${nextBlog.title.length > 30 ? '...' : ''} ->`;
            nextBlogLink.classList.remove('disabled');
        } else {
            nextBlogLink.href = '#';
            nextBlogLink.textContent = tNoOlder;
            nextBlogLink.classList.add('disabled');
        }
    } catch (error) {
        console.error('Error setting up blog navigation:', error);
    }
}

// Load related blogs (exclude current blog)
async function loadRelatedBlogs(currentBlog) {
    const container = document.getElementById('relatedBlogsContainer');
    if (!container) return;

    try {
        const blogs = await blogApi.getAllBlogs();

        // Clear container
        container.innerHTML = '';

        // Sort blogs by date (newest first)
        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Filter out current blog and take up to 3 related blogs
        const relatedBlogs = sortedBlogs
            .filter(blog => blog.id != currentBlog.id)
            .slice(0, 3);

        const tReadMore = getNestedValue(translations[currentLanguage], 'common.read_more') || 'Read More →';
        if (relatedBlogs.length === 0) {
            const tNoOther = getNestedValue(translations[currentLanguage], 'blog_detail.no_other_blogs') || 'No other blogs available.';
            container.innerHTML = `<p style="color: #666; text-align: center;">${tNoOther}</p>`;
            return;
        }

        relatedBlogs.forEach(blog => {
            const blogItem = document.createElement('div');
            blogItem.className = 'related-blog-item';

            // Create plain text preview by stripping HTML tags
            const previewText = blog.plainText ||
                blog.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

            blogItem.innerHTML = `
                <h4>${blog.title}</h4>
                <p style="font-size: 14px; color: #666; margin-bottom: 10px;">${blog.date}</p>
                <p>${previewText.substring(0, 100)}${previewText.length > 100 ? '...' : ''}</p>
                <a href="blog-detail.html?id=${encodeURIComponent(blog.id)}" class="related-blog-link">${tReadMore}</a>
            `;

            container.appendChild(blogItem);
        });
    } catch (error) {
        console.error('Error loading related blogs:', error);
        const tErrRelated = getNestedValue(translations[currentLanguage], 'blog_detail.error_related') || 'Error loading related blogs.';
        container.innerHTML = `<p style="color: #666; text-align: center;">${tErrRelated}</p>`;
    }
}

// Load blogs on insights page
async function loadBlogsOnInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) {
        console.log('insightsContainer not found in DOM');
        return;
    }

    const tLoading = getNestedValue(translations[currentLanguage], 'insights.loading') || 'Loading insights...';
    const tNoBlogs = getNestedValue(translations[currentLanguage], 'insights.no_blogs') || 'No blogs yet';
    const tNoBlogsDesc = getNestedValue(translations[currentLanguage], 'insights.no_blogs_desc') || 'Check back soon for our latest insights and updates. Please visit admin.html to create blogs.';
    const tErr = getNestedValue(translations[currentLanguage], 'insights.error_loading') || 'Error loading blogs';
    const tErrDesc = getNestedValue(translations[currentLanguage], 'insights.error_loading_desc') || 'Please try again later.';
    const tReadMore = getNestedValue(translations[currentLanguage], 'common.read_more') || 'Read More →';

    // Show loading state
    container.innerHTML = `<div class="loading-message" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">${tLoading}</div>`;
    console.log('Starting to load blogs for insights page...');

    try {
        console.log('Fetching blogs from blogApi.getAllBlogs()...');
        const blogs = await blogApi.getAllBlogs();
        console.log('Loaded blogs count:', blogs.length);

        if (blogs.length === 0) {
            container.innerHTML = `<div class="insight-item" style="grid-column: 1 / -1; text-align: center; padding: 40px;"><h3>${tNoBlogs}</h3><p>${tNoBlogsDesc}</p></div>`;
            return;
        }

        // Sort blogs by date (newest first)
        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Sorted blogs count:', sortedBlogs.length);

        container.innerHTML = '';

        sortedBlogs.forEach(blog => {
            console.log('Rendering blog:', blog.id, blog.title);

            // Create plain text preview by stripping HTML tags
            const previewText = blog.plainText ||
                blog.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

            // Create insight item
            const insightItem = document.createElement('div');
            insightItem.className = 'insight-item';

            // For now, we don't have blog images, so we can use a placeholder or leave empty
            // We'll add a placeholder image or use the first image from content if available
            let imageUrl = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20automation&image_size=landscape_4_3';

            // Try to extract first image from content if exists
            const imgMatch = blog.content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
            if (imgMatch && imgMatch[1]) {
                imageUrl = imgMatch[1];
            }

            insightItem.innerHTML = `
                <img src="${imageUrl}" alt="${blog.title}" class="insight-image">
                <div class="insight-content">
                    <div class="insight-date">${blog.date}</div>
                    <h3 class="insight-title">${blog.title}</h3>
                    <p class="insight-excerpt">${previewText.substring(0, 150)}${previewText.length > 150 ? '...' : ''}</p>
                    <a href="blog-detail.html?id=${encodeURIComponent(blog.id)}" class="insight-link">${tReadMore}</a>
                </div>
            `;

            container.appendChild(insightItem);
        });

        console.log('Successfully rendered', sortedBlogs.length, 'blogs');
    } catch (error) {
        console.error('Error loading blogs for insights page:', error);
        container.innerHTML = `<div class="insight-item" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #e60000;"><h3>${tErr}</h3><p>${tErrDesc}</p></div>`;
    }
}

async function loadBlogsOnBlog() {
    const container = document.getElementById('blogListContainer');
    const featuredContainer = document.getElementById('blogFeaturedContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-message"><h3>Loading published articles</h3><p>Fetching the latest published blog posts.</p></div>';
    if (featuredContainer) featuredContainer.innerHTML = '';

    try {
        const blogs = await blogApi.getAllBlogs();
        if (!blogs.length) {
            container.innerHTML = `
                <div class="blog-empty-panel">
                    <div>
                        <span class="eyebrow">Publishing Queue</span>
                        <h3>Knowledge Library in Progress</h3>
                        <p>New articles and project insights will appear here as soon as they are published from the CMS.</p>
                    </div>
                    <div class="knowledge-empty-grid">
                        <a class="knowledge-topic-card" href="solutions.html#asrs"><span>01</span><h3>ASRS Planning</h3><p>Storage density, shuttle systems, stacker cranes, and WMS/WES integration.</p></a>
                        <a class="knowledge-topic-card" href="solutions.html#factory"><span>02</span><h3>Factory Flow</h3><p>AGV logistics, robotic handling, line feeding, and production automation.</p></a>
                        <a class="knowledge-topic-card" href="case-studies.html"><span>03</span><h3>Case Studies</h3><p>Explore project references while the article library is being built.</p></a>
                    </div>
                </div>
            `;
            return;
        }

        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.publishedAt || b.date || b.updatedAt) - new Date(a.publishedAt || a.date || a.updatedAt));
        const [featured, ...rest] = sortedBlogs;

        if (featuredContainer && featured) {
            const href = `blog-detail.html?id=${encodeURIComponent(featured.id)}`;
            featuredContainer.innerHTML = `
                <article class="blog-featured-card">
                    <a class="blog-featured-media" href="${href}">
                        <img src="${escapeHtml(getPublicBlogCover(featured))}" alt="${escapeHtml(featured.title)}">
                    </a>
                    <div class="blog-featured-body">
                        <h3><a href="${href}">${escapeHtml(featured.title)}</a></h3>
                        <p>${escapeHtml(getBlogExcerpt(featured, 150))}</p>
                        <a href="${href}" class="text-link">Read article</a>
                    </div>
                </article>
            `;
        }

        const gridBlogs = rest.length ? rest : [];
        if (!gridBlogs.length) {
            container.innerHTML = `
                <div class="blog-single-note">
                    <h3>More articles are coming</h3>
                    <p>This published article is live. New CMS posts will appear here automatically after publishing.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = gridBlogs.map(blog => {
            const href = `blog-detail.html?id=${encodeURIComponent(blog.id)}`;
            return `
                <article class="blog-index-card">
                    <a class="blog-index-media" href="${href}">
                        <img src="${escapeHtml(getPublicBlogCover(blog))}" alt="${escapeHtml(blog.title)}">
                    </a>
                    <div class="blog-index-body">
                        <div class="blog-card-meta">
                            <span>${escapeHtml(blog.category || 'Blog')}</span>
                            <span>${escapeHtml(blog.date || '')}</span>
                        </div>
                        <h3><a href="${href}">${escapeHtml(blog.title)}</a></h3>
                        <p>${escapeHtml(getBlogExcerpt(blog, 155))}</p>
                        <a href="${href}" class="text-link">Read article</a>
                    </div>
                </article>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading blogs for blog page:', error);
        container.innerHTML = '<div class="loading-message">Unable to load blog posts.</div>';
    }
}

window.initBlogPages = async function() {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    if (pathname.includes('blog-detail')) {
        await loadBlogDetail();
    } else if (pathname.endsWith('/blog') || pathname.includes('blog.html')) {
        await loadBlogsOnBlog();
    } else if (pathname.includes('insights')) {
        await loadBlogsOnInsights();
    }
};
