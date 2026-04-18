// Page content updates and DOMContentLoaded coordinator

async function updateMainPage() {
    await initializeAllData();

    if (currentLanguage === 'en') {
        const savedContent = localStorage.getItem('siteContent');
        if (savedContent) {
            const content = JSON.parse(savedContent);

            const heroTitle = document.querySelector('.hero h1');
            const heroDesc = document.querySelector('.hero p');
            if (heroTitle && heroDesc) {
                heroTitle.textContent = content.hero.title;
                heroDesc.textContent = content.hero.description;
            }

            const serviceItems = document.querySelectorAll('.service-item');
            if (serviceItems.length === content.services.length) {
                serviceItems.forEach((item, index) => {
                    const title = item.querySelector('h3');
                    const desc = item.querySelector('p');
                    if (title && desc) {
                        title.textContent = content.services[index].title;
                        desc.textContent = content.services[index].description;
                    }
                });
            }
        }
    }

    loadBlogsOnHome();
}

async function loadBlogsOnHome() {
    const blogsSection = document.getElementById('blogsSection');
    if (!blogsSection) {
        console.log('blogsSection not found in DOM');
        return;
    }

    const tLoading = getNestedValue(translations[currentLanguage], 'common.loading') || 'Loading...';
    blogsSection.innerHTML = `<div class="service-item"><h3>${tLoading}</h3><p>Fetching latest blogs</p></div>`;
    console.log('Starting to load blogs for home page...');

    try {
        console.log('Fetching blogs from blogApi.getAllBlogs()...');
        const blogs = await blogApi.getAllBlogs();
        console.log('Loaded blogs count:', blogs.length);
        console.log('Blogs:', blogs);

        const tNoBlogs = getNestedValue(translations[currentLanguage], 'insights.no_blogs') || 'No blogs yet';
        const tNoBlogsDesc = getNestedValue(translations[currentLanguage], 'insights.no_blogs_desc') || 'Check back soon for our latest insights and updates. Please visit admin.html to create blogs.';
        if (blogs.length === 0) {
            blogsSection.innerHTML = `<div class="service-item"><h3>${tNoBlogs}</h3><p>${tNoBlogsDesc}</p></div>`;
            return;
        }

        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Sorted blogs count:', sortedBlogs.length);

        const latestBlogs = sortedBlogs.slice(0, 3);
        console.log('Latest blogs to display:', latestBlogs.length);

        blogsSection.innerHTML = '';

        latestBlogs.forEach(blog => {
            console.log('Rendering blog:', blog.id, blog.title);
            const blogLink = document.createElement('a');
            blogLink.href = `blog-detail.html?id=${encodeURIComponent(blog.id)}`;
            blogLink.className = 'service-item blog-link';
            blogLink.style.display = 'block';
            blogLink.style.textDecoration = 'none';
            blogLink.style.color = 'inherit';

            const previewText = blog.plainText ||
                blog.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

            const tReadMore = getNestedValue(translations[currentLanguage], 'common.read_more') || 'Read More →';
            blogLink.innerHTML = `
                <h3>${blog.title}</h3>
                <p style="font-size: 14px; color: #666; margin-bottom: 10px;">${blog.date}</p>
                <p style="line-height: 1.6;">${previewText.substring(0, 150)}${previewText.length > 150 ? '...' : ''}</p>
                <div style="margin-top: 15px; color: #e60000; font-weight: bold; font-size: 14px;">${tReadMore}</div>
            `;

            blogsSection.appendChild(blogLink);
        });

        console.log('Successfully rendered', latestBlogs.length, 'blogs');
    } catch (error) {
        console.error('Error loading blogs for home page:', error);
        const tErr = getNestedValue(translations[currentLanguage], 'insights.error_loading') || 'Error loading blogs';
        const tErrDesc = getNestedValue(translations[currentLanguage], 'insights.error_loading_desc') || 'Please try again later.';
        blogsSection.innerHTML = `<div class="service-item"><h3>${tErr}</h3><p>${tErrDesc}</p></div>`;
    }
}

async function updatePageContent() {
    await initializeAllData();

    if (currentLanguage !== 'en') return;

    const savedContent = localStorage.getItem('siteContent');
    if (!savedContent) return;

    const content = JSON.parse(savedContent);
    if (!content.pages) return;

    const path = window.location.pathname;
    const pageName = path.substring(path.lastIndexOf('/') + 1);

    const heroTitle = document.querySelector('.hero h1');
    const heroDesc = document.querySelector('.hero p');

    if (heroTitle && heroDesc) {
        if ((pageName === 'services' || pageName === 'services.html') && content.pages.services) {
            heroTitle.textContent = content.pages.services.title;
            heroDesc.textContent = content.pages.services.description;
        } else if ((pageName === 'solutions' || pageName === 'solutions.html') && content.pages.solutions) {
            heroTitle.textContent = content.pages.solutions.title;
            heroDesc.textContent = content.pages.solutions.description;
        } else if ((pageName === 'about' || pageName === 'about.html') && content.pages.about) {
            heroTitle.textContent = content.pages.about.title;
            heroDesc.textContent = content.pages.about.description;
        }
    }
}

async function runPageSpecificScripts() {
    const pathname = window.location.pathname;
    if (pathname.endsWith('index.html') || pathname === '/') {
        await updateMainPage();
    } else if (pathname.includes('services') ||
               pathname.includes('solutions') ||
               pathname.includes('about')) {
        await updatePageContent();
    }
}

// Prefetch / Prerender for faster page transitions
const prefetchedUrls = window.__prefetchedUrls || new Set();
const prerenderedUrls = window.__prerenderedUrls || new Set();
window.__prefetchedUrls = prefetchedUrls;
window.__prerenderedUrls = prerenderedUrls;

function initPagePrefetch() {
    function addPrefetch(url) {
        if (prefetchedUrls.has(url)) return;
        prefetchedUrls.add(url);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    }

    function addPrerender(url) {
        if (prerenderedUrls.has(url)) return;
        prerenderedUrls.add(url);
        const link = document.createElement('link');
        link.rel = 'prerender';
        link.href = url;
        document.head.appendChild(link);
    }

    function isInternalHtmlLink(url) {
        if (!url) return false;
        if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:')) return false;
        try {
            const link = new URL(url, window.location.href);
            return link.origin === window.location.origin && link.pathname.endsWith('.html');
        } catch (e) {
            return false;
        }
    }

    document.querySelectorAll('header nav a[href]').forEach(a => {
        const url = a.getAttribute('href');
        if (isInternalHtmlLink(url)) {
            addPrerender(url);
        }
    });

    let hoverTimer = null;
    document.addEventListener('mouseover', function(e) {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const url = a.getAttribute('href');
        if (!isInternalHtmlLink(url)) return;

        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            addPrefetch(url);
        }, 65);
    }, { passive: true });

    document.addEventListener('mouseout', function(e) {
        const a = e.target.closest('a[href]');
        if (a && hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    }, { passive: true });

    document.addEventListener('touchstart', function(e) {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const url = a.getAttribute('href');
        if (isInternalHtmlLink(url)) {
            addPrefetch(url);
        }
    }, { passive: true });
}

// DOMContentLoaded coordinator
document.addEventListener('DOMContentLoaded', async function() {
    const savedLang = localStorage.getItem('siteLanguage') || 'en';
    document.querySelectorAll('#lang-select').forEach(function(el) {
        el.value = savedLang;
    });

    await loadTranslations();
    currentLanguage = savedLang;
    translatePage();
    document.documentElement.classList.remove('i18n-pending');

    initSmoothScroll();
    initPagePrefetch();

    await runPageSpecificScripts();

    if (typeof initBlogPages === 'function') await initBlogPages();
    if (typeof initAdminPage === 'function') await initAdminPage();
});
