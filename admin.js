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
        blogOrderCounter: document.getElementById('blogOrderCounter'),
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
            youtubeUrl: document.getElementById('blogYoutubeUrl'),
            author: document.getElementById('blogAuthor'),
            date: document.getElementById('blogDate'),
            seoTitle: document.getElementById('blogSeoTitle'),
            seoDescription: document.getElementById('blogSeoDescription'),
            content: document.getElementById('blogContentEditor'),
        },
        chooseCoverImage: document.getElementById('chooseCoverImage'),
        coverImageFile: document.getElementById('coverImageFile'),
        coverImagePreview: document.getElementById('coverImagePreview'),
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

    function getBlogSortTime(blog) {
        const value = blog.publishedAt || blog.date || blog.updatedAt || blog.createdAt || '';
        const time = new Date(value).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function getBlogsByPublishOrder() {
        return [...state.blogs].sort((a, b) => {
            const timeDiff = getBlogSortTime(b) - getBlogSortTime(a);
            if (timeDiff) return timeDiff;
            return String(b.updatedAt || b.id || '').localeCompare(String(a.updatedAt || a.id || ''));
        });
    }

    function updateBlogOrderCounter() {
        if (!els.blogOrderCounter) return;
        if (!state.currentBlogId) {
            els.blogOrderCounter.textContent = '-/100';
            els.blogOrderCounter.title = 'Select a blog to show its publish-order number.';
            return;
        }

        const orderedBlogs = getBlogsByPublishOrder();
        const index = orderedBlogs.findIndex(blog => blog.id === state.currentBlogId);
        const position = index >= 0 ? index + 1 : '-';
        els.blogOrderCounter.textContent = `${position}/100`;
        els.blogOrderCounter.title = index >= 0
            ? `This blog is number ${position} by publish date.`
            : 'Selected blog is not in the current list.';
    }

    function updateCoverPreview(src) {
        const preview = els.coverImagePreview;
        if (!preview) return;
        const img = preview.querySelector('img');
        if (src) {
            img.src = src;
            preview.classList.add('show');
            preview.setAttribute('aria-hidden', 'false');
        } else {
            img.removeAttribute('src');
            preview.classList.remove('show');
            preview.setAttribute('aria-hidden', 'true');
        }
    }

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const url = URL.createObjectURL(file);
            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not read the selected image.'));
            };
            image.src = url;
        });
    }

    function canvasToBlob(canvas, type = 'image/webp', quality = 0.84) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Could not process image.'));
            }, type, quality);
        });
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not prepare image upload.'));
            reader.readAsDataURL(blob);
        });
    }

    async function prepareSixteenNineImage(file) {
        const image = await loadImageFromFile(file);
        const targetWidth = 1280;
        const targetHeight = 720;
        const targetRatio = targetWidth / targetHeight;
        let sourceWidth = image.naturalWidth || image.width;
        let sourceHeight = image.naturalHeight || image.height;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceWidth / sourceHeight > targetRatio) {
            const croppedWidth = Math.round(sourceHeight * targetRatio);
            sourceX = Math.round((sourceWidth - croppedWidth) / 2);
            sourceWidth = croppedWidth;
        } else {
            const croppedHeight = Math.round(sourceWidth / targetRatio);
            sourceY = Math.round((sourceHeight - croppedHeight) / 2);
            sourceHeight = croppedHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

        const blob = await canvasToBlob(canvas);
        return {
            dataUrl: await blobToDataUrl(blob),
            width: targetWidth,
            height: targetHeight,
            contentType: blob.type || 'image/webp',
        };
    }

    async function uploadCoverImage(file) {
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
            showNotice('Please choose a JPG, PNG, or WebP image.', 'error');
            return;
        }

        const oldLabel = els.chooseCoverImage.textContent;
        els.chooseCoverImage.disabled = true;
        els.chooseCoverImage.textContent = '上传中...';

        try {
            const image = await prepareSixteenNineImage(file);
            updateCoverPreview(image.dataUrl);
            const uploaded = await blogApi.uploadMedia({
                filename: file.name,
                dataUrl: image.dataUrl,
                width: image.width,
                height: image.height,
            });
            els.fields.coverImage.value = uploaded.url;
            updateCoverPreview(uploaded.url);
            showNotice('Image uploaded and cropped to 16:9.', 'success');
        } catch (error) {
            console.error('Image upload failed:', error);
            showNotice(error.message || 'Image upload failed.', 'error');
        } finally {
            els.chooseCoverImage.disabled = false;
            els.chooseCoverImage.textContent = oldLabel;
            els.coverImageFile.value = '';
        }
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
        return getBlogsByPublishOrder().filter(blog => {
            const statusOk = state.filter === 'all' || blog.status === state.filter;
            const text = `${blog.title || ''} ${blog.summary || ''} ${blog.category || ''}`.toLowerCase();
            return statusOk && (!query || text.includes(query));
        });
    }

    function renderBlogList() {
        const blogs = getFilteredBlogs();
        updateBlogOrderCounter();
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
        updateCoverPreview('');
        renderBlogList();
    }

    function setBlogForm(blog) {
        state.currentBlogId = blog.id;
        els.fields.title.value = blog.title || '';
        els.fields.summary.value = blog.summary || '';
        els.fields.coverImage.value = blog.coverImage || '';
        els.fields.category.value = blog.category || '';
        els.fields.youtubeUrl.value = blog.youtubeUrl || '';
        els.fields.author.value = blog.author || '13ASRS';
        els.fields.date.value = blog.date || today();
        els.fields.seoTitle.value = blog.seoTitle || '';
        els.fields.seoDescription.value = blog.seoDescription || '';
        els.fields.content.innerHTML = blog.contentHtml || blog.content || '';
        updateCoverPreview(blog.coverImage || '');
        renderBlogList();
    }

    function collectBlogData(status) {
        return {
            title: els.fields.title.value.trim(),
            summary: els.fields.summary.value.trim(),
            coverImage: els.fields.coverImage.value.trim(),
            category: els.fields.category.value.trim(),
            youtubeUrl: els.fields.youtubeUrl.value.trim(),
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
                    iframe { width: 100%; height: 100%; border: 0; }
                    .meta { color: #667085; margin-bottom: 24px; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(payload.title || 'Untitled')}</h1>
                <div class="meta">${escapeHtml(payload.date)} ${payload.category ? ' / ' + escapeHtml(payload.category) : ''}</div>
                <p>${escapeHtml(payload.summary)}</p>
                ${payload.coverImage ? `<img src="${escapeHtml(payload.coverImage)}" alt="${escapeHtml(payload.title)}">` : ''}
                <div style="margin: 24px 0; aspect-ratio: 16 / 9; background: #07111f; color: #c8d6e2; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden;">
                    ${payload.youtubeUrl && typeof renderYouTubeFrame === 'function' ? renderYouTubeFrame(payload.youtubeUrl, payload.title) : 'YouTube project video'}
                </div>
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
    els.chooseCoverImage.addEventListener('click', () => els.coverImageFile.click());
    els.coverImageFile.addEventListener('change', event => uploadCoverImage(event.target.files?.[0]));
    els.fields.coverImage.addEventListener('input', event => updateCoverPreview(event.target.value.trim()));
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
