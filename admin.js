const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorMessage.textContent = '';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok && data.token) {
                _setAdminJwtToken(data.token);
                window.location.href = 'admin.html';
                return;
            }

            errorMessage.textContent = data.error || 'Invalid username or password';
        } catch (error) {
            console.error('Login request failed:', error);
            errorMessage.textContent = 'Network error. Please try again.';
        }
    });
}

window.initAdminPage = async function() {
    const isLoggedIn = await checkAdminLogin();
    if (!isLoggedIn) return;

    const state = {
        blogs: [],
        currentBlogId: null,
        filter: 'all',
        search: '',
    };

    const els = {
        navButtons: document.querySelectorAll('[data-admin-tab]'),
        sections: {
            blogs: document.getElementById('blogsSection'),
            pages: document.getElementById('pagesSection'),
            settings: document.getElementById('settingsSection'),
        },
        blogList: document.getElementById('blogList'),
        blogSearch: document.getElementById('blogSearch'),
        blogStatusFilter: document.getElementById('blogStatusFilter'),
        newBlog: document.getElementById('newBlog'),
        notice: document.getElementById('editorNotice'),
        saveDraft: document.getElementById('saveDraft'),
        publishBlog: document.getElementById('publishBlog'),
        unpublishBlog: document.getElementById('unpublishBlog'),
        deleteBlog: document.getElementById('deleteBlog'),
        previewBlog: document.getElementById('previewBlog'),
        form: document.getElementById('blogForm'),
        fields: {
            title: document.getElementById('blogTitle'),
            summary: document.getElementById('blogSummary'),
            coverImage: document.getElementById('blogCoverImage'),
            category: document.getElementById('blogCategory'),
            author: document.getElementById('blogAuthor'),
            date: document.getElementById('blogDate'),
            seoTitle: document.getElementById('blogSeoTitle'),
            seoDescription: document.getElementById('blogSeoDescription'),
            content: document.getElementById('blogContentEditor'),
        },
        savePages: document.getElementById('savePages'),
    };

    function showNotice(message, tone = 'info') {
        els.notice.textContent = message;
        els.notice.className = `notice show ${tone}`;
        window.setTimeout(() => {
            els.notice.classList.remove('show');
        }, 3200);
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

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    function setActiveTab(tab) {
        els.navButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.adminTab === tab);
        });
        Object.entries(els.sections).forEach(([key, section]) => {
            if (section) section.classList.toggle('active', key === tab);
        });
    }

    function getFilteredBlogs() {
        const query = state.search.trim().toLowerCase();
        return state.blogs.filter(blog => {
            const statusOk = state.filter === 'all' || blog.status === state.filter;
            const text = `${blog.title || ''} ${blog.summary || ''} ${blog.category || ''}`.toLowerCase();
            return statusOk && (!query || text.includes(query));
        });
    }

    function renderBlogList() {
        const blogs = getFilteredBlogs();
        if (!blogs.length) {
            els.blogList.innerHTML = '<div class="blog-list-item"><h3>No blog posts yet</h3><div class="blog-meta">Create a draft to start.</div></div>';
            return;
        }

        els.blogList.innerHTML = blogs.map(blog => `
            <button type="button" class="blog-list-item ${blog.id === state.currentBlogId ? 'active' : ''}" data-blog-id="${escapeHtml(blog.id)}">
                <h3>${escapeHtml(blog.title)}</h3>
                <div class="blog-meta">
                    <span class="status-pill ${escapeHtml(blog.status)}">${blog.status === 'published' ? 'Published' : 'Draft'}</span>
                    <span>${escapeHtml(blog.date || '')}</span>
                    <span>${escapeHtml(blog.category || 'Uncategorized')}</span>
                </div>
            </button>
        `).join('');
    }

    function clearBlogForm() {
        state.currentBlogId = null;
        els.form.reset();
        els.fields.author.value = '13ASRS';
        els.fields.date.value = today();
        els.fields.content.innerHTML = '';
        renderBlogList();
    }

    function setBlogForm(blog) {
        state.currentBlogId = blog.id;
        els.fields.title.value = blog.title || '';
        els.fields.summary.value = blog.summary || '';
        els.fields.coverImage.value = blog.coverImage || '';
        els.fields.category.value = blog.category || '';
        els.fields.author.value = blog.author || '13ASRS';
        els.fields.date.value = blog.date || today();
        els.fields.seoTitle.value = blog.seoTitle || '';
        els.fields.seoDescription.value = blog.seoDescription || '';
        els.fields.content.innerHTML = blog.contentHtml || blog.content || '';
        renderBlogList();
    }

    function collectBlogData(status) {
        return {
            title: els.fields.title.value.trim(),
            summary: els.fields.summary.value.trim(),
            coverImage: els.fields.coverImage.value.trim(),
            category: els.fields.category.value.trim(),
            author: els.fields.author.value.trim() || '13ASRS',
            date: els.fields.date.value || today(),
            seoTitle: els.fields.seoTitle.value.trim(),
            seoDescription: els.fields.seoDescription.value.trim(),
            contentHtml: els.fields.content.innerHTML.trim(),
            plainText: els.fields.content.textContent.trim(),
            status,
        };
    }

    function validateBlogPayload(payload) {
        if (!payload.title) {
            showNotice('Title is required.', 'error');
            els.fields.title.focus();
            return false;
        }
        if (!payload.contentHtml) {
            showNotice('Content is required.', 'error');
            els.fields.content.focus();
            return false;
        }
        return true;
    }

    async function refreshBlogs(selectId = state.currentBlogId) {
        els.blogList.innerHTML = '<div class="blog-list-item"><h3>Loading...</h3></div>';
        state.blogs = await blogApi.getAdminBlogs();
        state.currentBlogId = selectId;
        renderBlogList();
    }

    async function saveBlog(status) {
        const payload = collectBlogData(status);
        if (!validateBlogPayload(payload)) return null;

        const saved = state.currentBlogId
            ? await blogApi.updateBlog(state.currentBlogId, payload)
            : await blogApi.createBlog(payload);

        state.currentBlogId = saved.id;
        await refreshBlogs(saved.id);
        setBlogForm(saved);
        showNotice(status === 'published' ? 'Blog published.' : 'Draft saved.');
        return saved;
    }

    async function selectBlog(id) {
        try {
            const blog = await blogApi.getAdminBlogById(id);
            setBlogForm(blog);
        } catch (error) {
            console.error('Could not load blog:', error);
            showNotice(error.message || 'Could not load blog.', 'error');
        }
    }

    async function deleteCurrentBlog() {
        if (!state.currentBlogId) {
            showNotice('Select a blog before deleting.', 'error');
            return;
        }
        if (!confirm('Delete this blog permanently?')) return;

        await blogApi.deleteBlog(state.currentBlogId);
        clearBlogForm();
        await refreshBlogs(null);
        showNotice('Blog deleted.');
    }

    async function unpublishCurrentBlog() {
        if (!state.currentBlogId) {
            showNotice('Save the blog before changing status.', 'error');
            return;
        }
        const blog = await blogApi.unpublishBlog(state.currentBlogId);
        await refreshBlogs(blog.id);
        setBlogForm(blog);
        showNotice('Blog moved to draft.');
    }

    function previewCurrentBlog() {
        const payload = collectBlogData(state.currentBlogId ? undefined : 'draft');
        const preview = window.open('', '_blank');
        if (!preview) {
            showNotice('Popup blocked. Allow popups to preview.', 'error');
            return;
        }
        preview.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${escapeHtml(payload.title || 'Blog Preview')}</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #17202a; }
                    img { max-width: 100%; height: auto; }
                    .meta { color: #667085; margin-bottom: 24px; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(payload.title || 'Untitled')}</h1>
                <div class="meta">${escapeHtml(payload.date)} ${payload.category ? ' / ' + escapeHtml(payload.category) : ''}</div>
                <p>${escapeHtml(payload.summary)}</p>
                ${payload.coverImage ? `<img src="${escapeHtml(payload.coverImage)}" alt="${escapeHtml(payload.title)}">` : ''}
                <article>${payload.contentHtml}</article>
            </body>
            </html>
        `);
        preview.document.close();
    }

    function runEditorCommand(command) {
        els.fields.content.focus();
        if (command === 'heading') {
            document.execCommand('formatBlock', false, '<h2>');
        } else if (command === 'link') {
            const url = prompt('Enter link URL:', 'https://');
            if (url) document.execCommand('createLink', false, url);
        } else if (command === 'image') {
            const url = prompt('Enter image URL:', 'https://');
            if (url) document.execCommand('insertImage', false, url);
        } else {
            document.execCommand(command, false, null);
        }
    }

    function loadPageContent() {
        const content = JSON.parse(localStorage.getItem('siteContent') || '{}');
        const pages = content.pages || {};
        document.getElementById('heroTitle').value = content.hero?.title || '';
        document.getElementById('heroDescription').value = content.hero?.description || '';
        document.getElementById('servicesTitle').value = pages.services?.title || '';
        document.getElementById('servicesDescription').value = pages.services?.description || '';
        document.getElementById('solutionsTitle').value = pages.solutions?.title || '';
        document.getElementById('solutionsDescription').value = pages.solutions?.description || '';
        document.getElementById('aboutTitle').value = pages.about?.title || '';
        document.getElementById('aboutDescription').value = pages.about?.description || '';
    }

    function savePageContent() {
        const content = JSON.parse(localStorage.getItem('siteContent') || '{}');
        content.hero = {
            title: document.getElementById('heroTitle').value.trim(),
            description: document.getElementById('heroDescription').value.trim(),
        };
        content.pages = {
            services: {
                title: document.getElementById('servicesTitle').value.trim(),
                description: document.getElementById('servicesDescription').value.trim(),
            },
            solutions: {
                title: document.getElementById('solutionsTitle').value.trim(),
                description: document.getElementById('solutionsDescription').value.trim(),
            },
            about: {
                title: document.getElementById('aboutTitle').value.trim(),
                description: document.getElementById('aboutDescription').value.trim(),
            },
        };
        localStorage.setItem('siteContent', JSON.stringify(content));
        alert('Page content saved in this browser.');
    }

    els.navButtons.forEach(button => {
        button.addEventListener('click', () => setActiveTab(button.dataset.adminTab));
    });

    els.blogList.addEventListener('click', event => {
        const item = event.target.closest('[data-blog-id]');
        if (item) selectBlog(item.dataset.blogId);
    });

    els.blogSearch.addEventListener('input', event => {
        state.search = event.target.value;
        renderBlogList();
    });

    els.blogStatusFilter.addEventListener('change', event => {
        state.filter = event.target.value;
        renderBlogList();
    });

    els.newBlog.addEventListener('click', clearBlogForm);
    els.saveDraft.addEventListener('click', () => saveBlog('draft').catch(error => showNotice(error.message, 'error')));
    els.publishBlog.addEventListener('click', () => saveBlog('published').catch(error => showNotice(error.message, 'error')));
    els.unpublishBlog.addEventListener('click', () => unpublishCurrentBlog().catch(error => showNotice(error.message, 'error')));
    els.deleteBlog.addEventListener('click', () => deleteCurrentBlog().catch(error => showNotice(error.message, 'error')));
    els.previewBlog.addEventListener('click', previewCurrentBlog);
    els.savePages.addEventListener('click', savePageContent);

    document.querySelectorAll('[data-command]').forEach(button => {
        button.addEventListener('click', () => runEditorCommand(button.dataset.command));
    });

    await initializeAllData();
    loadPageContent();
    clearBlogForm();
    await refreshBlogs(null);
};

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('adminDashboard') && typeof window.initAdminPage === 'function') {
        window.initAdminPage().catch(error => {
            console.error('Admin page initialization failed:', error);
        });
    }
});
