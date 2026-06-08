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
        contentType: 'blog',
        currentPage: 'home',
        pageModules: [],
        currentModuleId: null,
    };

    const els = {
        navButtons: document.querySelectorAll('[data-admin-tab]'),
        sections: {
            blogs: document.getElementById('blogsSection'),
            pages: document.getElementById('pagesSection'),
            settings: document.getElementById('settingsSection'),
        },
        blogList: document.getElementById('blogList'),
        contentListTitle: document.getElementById('contentListTitle'),
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
            industry: document.getElementById('blogIndustry'),
            solution: document.getElementById('blogSolution'),
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
        pageSelector: document.getElementById('pageSelector'),
        pageModuleCount: document.getElementById('pageModuleCount'),
        pageModuleList: document.getElementById('pageModuleList'),
        addModuleType: document.getElementById('addModuleType'),
        addPageModule: document.getElementById('addPageModule'),
        savePageModules: document.getElementById('savePageModules'),
        pageBuilderNotice: document.getElementById('pageBuilderNotice'),
        pageBuilderStatus: document.getElementById('pageBuilderStatus'),
        moduleEditorEmpty: document.getElementById('moduleEditorEmpty'),
        pageModuleForm: document.getElementById('pageModuleForm'),
        duplicatePageModule: document.getElementById('duplicatePageModule'),
        moveModuleUp: document.getElementById('moveModuleUp'),
        moveModuleDown: document.getElementById('moveModuleDown'),
        deletePageModule: document.getElementById('deletePageModule'),
        addModuleItem: document.getElementById('addModuleItem'),
        moduleItems: document.getElementById('moduleItems'),
        moduleItemsField: document.getElementById('moduleItemsField'),
        moduleFields: {
            type: document.getElementById('moduleType'),
            label: document.getElementById('moduleLabel'),
            eyebrow: document.getElementById('moduleEyebrow'),
            title: document.getElementById('moduleTitle'),
            text: document.getElementById('moduleText'),
            image: document.getElementById('moduleImage'),
            youtubeUrl: document.getElementById('moduleYoutubeUrl'),
            ctaText: document.getElementById('moduleCtaText'),
            ctaHref: document.getElementById('moduleCtaHref'),
        },
    };

    function showNotice(message, tone = 'info') {
        els.notice.textContent = message;
        els.notice.className = `notice show ${tone}`;
        window.setTimeout(() => {
            els.notice.classList.remove('show');
        }, 3200);
    }

    function showPageNotice(message, tone = 'info') {
        if (!els.pageBuilderNotice) return;
        els.pageBuilderNotice.textContent = message;
        els.pageBuilderNotice.className = `notice show ${tone}`;
        window.setTimeout(() => {
            els.pageBuilderNotice.classList.remove('show');
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

    function getSelectedOptionText(select) {
        if (!select?.value) return '';
        return select?.selectedOptions?.[0]?.textContent.trim() || '';
    }

    function isCaseMode() {
        return state.contentType === 'case';
    }

    function updateContentModeLabels() {
        if (els.contentListTitle) els.contentListTitle.textContent = isCaseMode() ? 'Case Studies 列表' : '文章列表';
        if (els.newBlog) els.newBlog.textContent = isCaseMode() ? '新建案例' : '新建';
        if (els.blogSearch) {
            els.blogSearch.placeholder = isCaseMode()
                ? '搜索案例标题、摘要、行业、方案'
                : '搜索标题、摘要、分类';
        }
    }

    function coerceSelectValue(select, value, label) {
        if (!select) return '';
        const options = [...select.options];
        const exactValue = options.find(option => option.value === value);
        if (exactValue) return exactValue.value;
        const exactLabel = options.find(option => option.textContent.trim() === label || option.textContent.trim() === value);
        return exactLabel ? exactLabel.value : '';
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
        const orderedBlogs = getBlogsByPublishOrder();
        const total = orderedBlogs.length;
        if (!state.currentBlogId) {
            els.blogOrderCounter.textContent = `-/${total}`;
            els.blogOrderCounter.title = 'Select a blog to show its reverse publish-order number.';
            return;
        }

        const index = orderedBlogs.findIndex(blog => blog.id === state.currentBlogId);
        const position = index >= 0 ? total - index : '-';
        els.blogOrderCounter.textContent = `${position}/${total}`;
        els.blogOrderCounter.title = index >= 0
            ? `This blog is number ${position} of ${total} by reverse publish date.`
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
        if (tab === 'blogs' || tab === 'cases') {
            state.contentType = tab === 'cases' ? 'case' : 'blog';
            updateContentModeLabels();
            clearBlogForm();
            refreshBlogs(null).catch(error => showNotice(error.message || 'Could not load content.', 'error'));
        }

        els.navButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.adminTab === tab);
        });
        Object.entries(els.sections).forEach(([key, section]) => {
            if (section) section.classList.toggle('active', key === (tab === 'cases' ? 'blogs' : tab));
        });
    }

    function getFilteredBlogs() {
        const query = state.search.trim().toLowerCase();
        return getBlogsByPublishOrder().filter(blog => {
            const contentType = blog.contentType || 'blog';
            if (contentType !== state.contentType) return false;
            const statusOk = state.filter === 'all' || blog.status === state.filter;
            const text = `${blog.title || ''} ${blog.summary || ''} ${blog.category || ''} ${blog.industryLabel || ''} ${blog.solutionLabel || ''}`.toLowerCase();
            return statusOk && (!query || text.includes(query));
        });
    }

    function renderBlogList() {
        const blogs = getFilteredBlogs();
        updateBlogOrderCounter();
        if (!blogs.length) {
            els.blogList.innerHTML = `<div class="blog-list-item"><h3>No ${isCaseMode() ? 'case studies' : 'blog posts'} yet</h3><div class="blog-meta">Create a draft to start.</div></div>`;
            return;
        }

        els.blogList.innerHTML = blogs.map(blog => `
            <button type="button" class="blog-list-item ${blog.id === state.currentBlogId ? 'active' : ''}" data-blog-id="${escapeHtml(blog.id)}">
                <h3>${escapeHtml(blog.title)}</h3>
                <div class="blog-meta">
                    <span class="status-pill ${escapeHtml(blog.status)}">${blog.status === 'published' ? 'Published' : 'Draft'}</span>
                    <span>${escapeHtml(blog.date || '')}</span>
                    <span>${escapeHtml(blog.industryLabel || 'No industry')}</span>
                    <span>${escapeHtml(blog.solutionLabel || blog.category || 'No solution')}</span>
                </div>
            </button>
        `).join('');
    }

    function clearBlogForm() {
        state.currentBlogId = null;
        els.form.reset();
        els.fields.industry.value = isCaseMode() ? '' : 'all-industries';
        els.fields.solution.value = isCaseMode() ? '' : 'all-solutions';
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
        els.fields.industry.value = coerceSelectValue(els.fields.industry, blog.industry, blog.industryLabel);
        els.fields.solution.value = coerceSelectValue(els.fields.solution, blog.solution, blog.solutionLabel || blog.category);
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
        const industryLabel = getSelectedOptionText(els.fields.industry);
        const solutionLabel = getSelectedOptionText(els.fields.solution);
        return {
            title: els.fields.title.value.trim(),
            summary: els.fields.summary.value.trim(),
            coverImage: els.fields.coverImage.value.trim(),
            industry: els.fields.industry.value,
            industryLabel,
            solution: els.fields.solution.value,
            solutionLabel,
            category: solutionLabel,
            youtubeUrl: els.fields.youtubeUrl.value.trim(),
            author: els.fields.author.value.trim() || '13ASRS',
            date: els.fields.date.value || today(),
            seoTitle: els.fields.seoTitle.value.trim(),
            seoDescription: els.fields.seoDescription.value.trim(),
            contentHtml: els.fields.content.innerHTML.trim(),
            plainText: els.fields.content.textContent.trim(),
            status,
            contentType: state.contentType,
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
        if (payload.status === 'published' && !payload.industry) {
            showNotice('Industry is required before publishing.', 'error');
            els.fields.industry.focus();
            return false;
        }
        if (payload.status === 'published' && !payload.solution) {
            showNotice('Solution is required before publishing.', 'error');
            els.fields.solution.focus();
            return false;
        }
        if (payload.status === 'published' && payload.contentType === 'case' && (payload.industry === 'all-industries' || payload.solution === 'all-solutions')) {
            showNotice('Choose a specific Industry and Solution before publishing a case study.', 'error');
            (payload.industry === 'all-industries' ? els.fields.industry : els.fields.solution).focus();
            return false;
        }
        if (payload.status === 'published' && payload.contentType === 'case' && !payload.coverImage && !payload.youtubeUrl) {
            showNotice('Add a local image, image URL, or video URL before publishing.', 'error');
            els.fields.coverImage.focus();
            return false;
        }
        return true;
    }

    async function refreshBlogs(selectId = state.currentBlogId) {
        els.blogList.innerHTML = '<div class="blog-list-item"><h3>Loading...</h3></div>';
        state.blogs = await blogApi.getAdminBlogs(state.contentType);
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
            showNotice(status === 'published' ? (isCaseMode() ? '案例已发布。' : 'Blog 已发布。') : '草稿已保存。');
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
                <div class="meta">${escapeHtml(payload.date)} ${payload.industryLabel ? ' / ' + escapeHtml(payload.industryLabel) : ''}${payload.solutionLabel ? ' / ' + escapeHtml(payload.solutionLabel) : ''}</div>
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

    function getModuleTypeName(type = 'text') {
        const labels = {
            hero: '首屏 Hero',
            text: '文本区块',
            cards: '卡片网格',
            media: '媒体区块',
            dynamic: '动态区块',
            cta: 'CTA',
        };
        return labels[type] || '模块';
    }

    function moduleUsesItems(module) {
        return module?.type === 'cards' || ['blog-index', 'case-library'].includes(module?.variant);
    }

    function makeModule(type = 'text') {
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type,
            label: getModuleTypeName(type),
            eyebrow: '',
            title: '',
            text: '',
            anchor: '',
            theme: '',
            grid: '',
            variant: type === 'dynamic' ? 'latest-blog' : '',
            image: '',
            youtubeUrl: '',
            ctaText: '',
            ctaHref: '',
            items: type === 'cards' ? [makeModuleItem(), makeModuleItem()] : [],
        };
    }

    function makeModuleItem() {
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: '',
            text: '',
            href: '',
            image: '',
            alt: '',
        };
    }

    function pageHero(id, label, eyebrow, title, text) {
        return {
            id,
            type: 'hero',
            label,
            variant: 'page-hero',
            eyebrow,
            title,
            text,
            image: '',
            youtubeUrl: '',
            ctaText: '',
            ctaHref: '',
            items: [],
        };
    }

    function cardItem(id, title, text, href = '', image = '', alt = '') {
        return { id, title, text, href, image, alt };
    }

    function getDefaultPageModules(page) {
        if (page === 'home') {
            return [
                pageHero('home-hero', 'Hero / Home intro', '13ASRS Industrial Automation', 'Industrial Automation Solutions for Warehouses and Factories', 'Warehouse automation, smart factory systems, packaging technologies, and industrial manufacturing solutions designed to improve efficiency, productivity, and operational performance.'),
                {
                    id: 'home-core-solutions',
                    type: 'cards',
                    label: 'Core Solutions',
                    theme: 'soft',
                    grid: 'three',
                    eyebrow: 'Core Solutions',
                    title: 'Automation technologies designed to solve real warehouse, production, and material handling challenges.',
                    text: 'Explore integrated solutions across warehousing, manufacturing, packaging, and industrial processing.',
                    items: [
                        cardItem('home-core-asrs', 'ASRS & Smart Warehouse Solutions', 'Shuttle ASRS, stacker crane, miniload, cold storage, conveyors, WMS/WES, and AGV logistics.', 'case-studies.html?solution=asrs#caseGrid'),
                        cardItem('home-core-factory', 'Smart Factory Automation', 'Automated production lines, robotic automation, intelligent material handling, factory upgrades, and multi-machine systems.', 'case-studies.html?industry=manufacturing-industrial&solution=conveyor-transport#caseGrid'),
                        cardItem('home-core-machinery', 'Industrial Machinery Solutions', 'Printing, packaging, filling, film blowing, bag making, laser equipment, and supporting manufacturing systems.', 'case-studies.html?industry=manufacturing-industrial#caseGrid'),
                    ],
                },
                {
                    id: 'home-featured-cases',
                    type: 'cards',
                    label: 'Featured Case Studies',
                    theme: 'soft',
                    grid: 'three',
                    eyebrow: 'Featured Case Studies',
                    title: 'Real Projects. Practical Solutions.',
                    text: 'Explore how manufacturers and logistics operators improve storage capacity, production efficiency, and operational performance through automation technologies.',
                    items: [
                        cardItem('home-case-chemical', 'Shuttle ASRS Warehouse for Chemical Industry', 'Height: 18m\nCapacity: +300%\nThroughput: +60%\nLabor: Reduced', 'case-studies.html?industry=chemical-petrochemical&solution=asrs#caseGrid'),
                        cardItem('home-case-pharma', 'Stacker Crane ASRS for Pharmaceutical Storage', 'System: Crane ASRS\nTraceability: WMS\nQuality: Controlled\nOperation: 24/7', 'case-studies.html?industry=pharmaceutical-biotech&solution=asrs#caseGrid'),
                        cardItem('home-case-agv', 'AGV Logistics for Smart Factory Material Flow', 'AGV: Multi-route\nLine Feed: Automated\nSafety: Improved\nHandling: Reduced', 'case-studies.html?industry=manufacturing-industrial&solution=conveyor-transport#caseGrid'),
                    ],
                },
                {
                    id: 'home-process',
                    type: 'cards',
                    label: 'Why Automation Projects Succeed',
                    variant: 'process-strip',
                    theme: 'dark',
                    eyebrow: 'Why Automation Projects Succeed',
                    title: 'Project success depends on planning, integration, delivery, reliability, and handover.',
                    text: '13ASRS focuses on practical automation systems that can be planned, integrated, commissioned, and operated with long-term stability.',
                    items: [
                        cardItem('home-process-design', 'Engineering Design', 'Practical system planning and layout optimization.'),
                        cardItem('home-process-integration', 'Technology Integration', 'Equipment, software, and controls working together.'),
                        cardItem('home-process-delivery', 'Project Delivery', 'Installation, commissioning, and acceptance support.'),
                        cardItem('home-process-reliability', 'Operational Reliability', 'Designed for long-term performance and scalability.'),
                        cardItem('home-process-transfer', 'Knowledge Transfer', 'Training and operational handover.'),
                    ],
                },
                {
                    id: 'home-knowledge',
                    type: 'dynamic',
                    label: 'Latest Case Studies',
                    variant: 'latest-blog',
                    theme: 'soft',
                    eyebrow: 'Latest Case Studies',
                    title: 'Recently published automation cases from real warehouse and factory projects.',
                    text: 'Browse the newest ASRS, smart factory, packaging automation, cold storage, and industrial manufacturing cases published from the CMS.',
                    ctaText: 'Browse all case studies',
                    ctaHref: 'case-studies.html',
                    items: [],
                },
                {
                    id: 'home-proof',
                    type: 'cards',
                    label: 'Why Choose 13ASRS',
                    variant: 'proof-list',
                    theme: 'dark',
                    eyebrow: 'Why Choose 13ASRS',
                    title: 'Why Companies Work With 13ASRS',
                    text: '',
                    items: [
                        cardItem('home-proof-1', 'Real Project Experience', ''),
                        cardItem('home-proof-2', 'Engineering Integration', ''),
                        cardItem('home-proof-3', 'Global Manufacturing Resources', ''),
                        cardItem('home-proof-4', 'Warehouse & Factory Automation Expertise', ''),
                        cardItem('home-proof-5', 'Practical Automation Solutions', ''),
                        cardItem('home-proof-6', 'Long-Term Project Support', ''),
                    ],
                },
                {
                    id: 'home-cta',
                    type: 'cta',
                    label: 'Business Challenge CTA',
                    eyebrow: 'Business Challenge',
                    title: 'Start with Your Business Challenge',
                    text: "Whether you're planning a warehouse upgrade, factory automation project, packaging production line, or manufacturing expansion, we can help you explore practical solutions and relevant project references.",
                    ctaText: 'Discuss Your Project',
                    ctaHref: 'contact.html',
                    items: [],
                },
            ];
        }

        if (page === 'industries') {
            return [
                pageHero('industries-hero', 'Hero / Industries intro', 'Industries', 'Automation Solutions Designed Around Real Operational Challenges.', 'Explore how manufacturers, warehouses, and logistics operators improve storage capacity, production efficiency, material flow, and operational performance through practical automation technologies.'),
                {
                    id: 'industries-proof',
                    type: 'cards',
                    label: 'Industries We Support',
                    variant: 'proof-list',
                    theme: 'dark',
                    eyebrow: 'Industries We Support',
                    title: 'Automation experience across production, warehousing, logistics, packaging, and industrial processing.',
                    text: '',
                    items: [
                        cardItem('industries-proof-1', '10+ Industries', ''),
                        cardItem('industries-proof-2', '100+ Project References', ''),
                        cardItem('industries-proof-3', 'Warehouse Automation', ''),
                        cardItem('industries-proof-4', 'Smart Factory Solutions', ''),
                        cardItem('industries-proof-5', 'Industrial Manufacturing Systems', ''),
                    ],
                },
                {
                    id: 'industries-list',
                    type: 'cards',
                    label: 'Industry Cards',
                    theme: 'soft',
                    grid: 'two',
                    eyebrow: '',
                    title: '',
                    text: '',
                    items: [
                        cardItem('industry-chemical', 'Chemical Industry', 'Safe, dense, and traceable warehouse automation for palletized chemicals and production materials.\nKey Challenges: hazardous material handling, inventory accuracy, throughput pressure, traceability requirements\nTypical Solutions: Shuttle ASRS, stacker crane systems, WMS integration, automated conveyors', '', '', 'Chemical'),
                        cardItem('industry-food', 'Food & Beverage', 'Clean, reliable automation for food storage, packaging lines, and high-frequency logistics centers.\nTypical Solutions: ASRS, conveyors, AGV transfer, pallet handling', '', '', 'Food & Beverage'),
                        cardItem('industry-packaging', 'Packaging & Converting', 'Automation solutions for packaging, bag making, filling, film blowing, converting, and finished goods storage.\nTypical Solutions: production line automation, conveyors, AGV logistics, packaging systems', '', '', 'Packaging & Converting'),
                        cardItem('industry-cold', 'Cold Storage', 'Automated cold warehouses reduce manual exposure and improve storage density in low-temperature environments.\nTypical Solutions: cold storage ASRS, stacker crane, shuttle, WMS', '', '', 'Cold Storage'),
                        cardItem('industry-pharma', 'Pharmaceutical', 'Traceable and controlled storage systems for pharmaceutical materials and finished goods.\nTypical Solutions: ASRS, WMS, controlled handling, validated workflows', '', '', 'Pharmaceutical'),
                        cardItem('industry-printing', 'Printing Industry', 'Automation solutions for printing, converting, flexible packaging, and production material handling.\nRelated Technologies: printing equipment, AGV, conveyors, WMS, ASRS', '', '', 'Printing'),
                        cardItem('industry-manufacturing', 'Industrial Manufacturing', 'Smart factory upgrades for material flow, robotic handling, and multi-machine coordination.\nTypical Solutions: AGV logistics, automated lines, robotic automation', '', '', 'Industrial Manufacturing'),
                        cardItem('industry-logistics', 'Logistics & Distribution', 'High-throughput automation for fulfillment centers, order waves, and dense storage operations.\nTypical Solutions: shuttle ASRS, conveyor sorting, WES, AGV transfer', '', '', 'Logistics & Distribution'),
                        cardItem('industry-electronics', 'Electronics Manufacturing', 'Material flow, line feeding, and storage automation for electronics production environments.', '', '', 'Electronics'),
                        cardItem('industry-automotive', 'Automotive Manufacturing', 'Automation for line-side logistics, parts storage, production handling, and factory upgrades.', '', '', 'Automotive'),
                    ],
                },
                {
                    id: 'industries-tech',
                    type: 'cards',
                    label: 'Explore Solutions by Technology',
                    variant: 'chip-list',
                    theme: 'soft',
                    eyebrow: 'Explore Solutions by Technology',
                    title: 'Connect industry challenges with practical automation technologies.',
                    text: '',
                    items: [
                        cardItem('tech-asrs', 'ASRS Systems', '', 'solutions.html#asrs'),
                        cardItem('tech-smart-factory', 'Smart Factory Automation', '', 'solutions.html#factory'),
                        cardItem('tech-printing', 'Printing & Packaging', '', 'solutions.html#machinery'),
                        cardItem('tech-filling', 'Filling Systems', '', 'solutions.html#machinery'),
                        cardItem('tech-film', 'Film Blowing', '', 'solutions.html#machinery'),
                        cardItem('tech-laser', 'Laser Processing', '', 'solutions.html#machinery'),
                    ],
                },
                {
                    id: 'industries-cta',
                    type: 'cta',
                    label: 'Business Challenge CTA',
                    eyebrow: 'Business Challenge',
                    title: 'Start with Your Business Challenge',
                    text: "Whether you're planning a warehouse upgrade, factory automation project, packaging production line, or manufacturing expansion, we can help you explore practical solutions, relevant technologies, and real project references.",
                    ctaText: 'Discuss Your Project',
                    ctaHref: 'contact.html',
                    items: [],
                },
            ];
        }

        if (page === 'case-studies') {
            return [
                pageHero('case-studies-hero', 'Hero / Case Studies intro', 'Case Studies', 'Learn from Real Automation Projects.', 'Explore warehouse automation systems, smart factory solutions, packaging production lines, and industrial manufacturing projects from around the world. Discover how businesses improve storage capacity, production efficiency, material flow, and operational performance through practical automation technologies.'),
                {
                    id: 'case-studies-proof',
                    type: 'cards',
                    label: 'Project Reference Library',
                    variant: 'proof-list',
                    theme: 'dark',
                    eyebrow: 'Project Reference Library',
                    title: 'Real project references for warehouse, factory, and industrial automation planning.',
                    text: '',
                    items: [
                        cardItem('case-proof-1', '100+ Automation Projects', ''),
                        cardItem('case-proof-2', '20+ Industries', ''),
                        cardItem('case-proof-3', 'Warehouse Automation', ''),
                        cardItem('case-proof-4', 'Smart Factory Solutions', ''),
                        cardItem('case-proof-5', 'Industrial Manufacturing Systems', ''),
                    ],
                },
                {
                    id: 'case-library',
                    type: 'dynamic',
                    label: 'Case Library',
                    variant: 'case-library',
                    theme: 'soft',
                    eyebrow: '',
                    title: '',
                    text: '',
                    items: [
                        cardItem('case-chemical', 'Shuttle ASRS Warehouse', 'Challenge: Manual pallet handling and limited storage density.\nSolution: 18m Shuttle ASRS with WMS integration.', 'case-ecommerce.html', 'solutions-asrs-technology.webp', 'Chemical & Petrochemical'),
                        cardItem('case-pharma', 'Stacker Crane ASRS for Pharmaceutical Storage', 'Challenge: Controlled storage, batch visibility, and reliable handling.\nSolution: Stacker crane ASRS with WMS traceability.', 'case-pharma.html', 'system-crane.webp', 'Pharmaceutical & Biotech'),
                        cardItem('case-miniload', 'Miniload Automation for E-commerce Fulfillment', 'Challenge: High SKU mix, peak order waves, and labor-intensive picking.\nSolution: Dense miniload automation for small-item fulfillment.', 'case-miniload.html', 'system-shuttle.webp', 'E-commerce Fulfillment'),
                        cardItem('case-agv', 'AGV Logistics for Smart Factory Material Flow', 'Challenge: Manual line feeding and disconnected production logistics.\nSolution: AGV routes connecting storage, production, and assembly flow.', 'case-automotive.html', 'system-agv.webp', 'Manufacturing / Industrial'),
                    ],
                },
                {
                    id: 'case-solutions',
                    type: 'cards',
                    label: 'Explore Related Solutions',
                    variant: 'chip-list',
                    theme: 'soft',
                    eyebrow: 'Explore Solutions Related to These Projects',
                    title: 'Move from project examples to practical automation planning.',
                    text: '',
                    items: [
                        cardItem('case-chip-warehouse', 'Warehouse Automation', '', 'solutions.html#asrs'),
                        cardItem('case-chip-agv', 'AGV Logistics', '', 'solutions.html#factory'),
                        cardItem('case-chip-factory', 'Smart Factory', '', 'solutions.html#factory'),
                        cardItem('case-chip-machinery', 'Industrial Manufacturing', '', 'solutions.html#machinery'),
                    ],
                },
                {
                    id: 'case-browse',
                    type: 'cards',
                    label: 'Browse Project Library',
                    variant: 'chip-list',
                    theme: 'dark',
                    eyebrow: 'Browse Project Library',
                    title: 'Browse by Industry and Technology',
                    text: '',
                    items: [
                        cardItem('browse-chemical', 'Chemical', '', 'industries.html#chemical'),
                        cardItem('browse-food', 'Food & Beverage', '', 'industries.html#food'),
                        cardItem('browse-pharma', 'Pharmaceutical', '', 'industries.html#pharmaceutical'),
                        cardItem('browse-manufacturing', 'Manufacturing', '', 'industries.html#manufacturing'),
                        cardItem('browse-printing', 'Printing', '', 'industries.html#printing'),
                        cardItem('browse-packaging', 'Packaging', '', 'industries.html#packaging'),
                        cardItem('browse-cold', 'Cold Storage', '', 'industries.html#cold-storage'),
                        cardItem('browse-ecommerce', 'E-commerce', '', 'industries.html#ecommerce'),
                        cardItem('browse-asrs', 'ASRS', '', 'solutions.html#asrs'),
                        cardItem('browse-wms', 'WMS/WES', '', 'solutions.html#asrs'),
                        cardItem('browse-smart-factory', 'Smart Factory', '', 'solutions.html#factory'),
                        cardItem('browse-production', 'Production Line Automation', '', 'solutions.html#factory'),
                    ],
                },
                {
                    id: 'case-cta',
                    type: 'cta',
                    label: 'Business Challenge CTA',
                    eyebrow: 'Business Challenge',
                    title: 'Start with Your Business Challenge',
                    text: "Whether you're planning a warehouse upgrade, factory automation project, packaging production line, or manufacturing expansion, we can help you explore practical solutions, relevant technologies, and real project references.",
                    ctaText: 'Discuss Your Project',
                    ctaHref: 'contact.html',
                    items: [],
                },
            ];
        }

        if (page === 'blog') {
            return [
                pageHero('blog-hero', 'Hero / Knowledge Center intro', 'Knowledge Center', 'Industrial Knowledge for Better Automation Decisions.', 'Explore technology insights, project breakdowns, industry trends, and practical automation solutions covering warehouse automation, smart manufacturing, packaging technologies, and industrial machinery.\n\nLearn from real-world applications and discover ideas that help improve efficiency, productivity, and operational performance.'),
                {
                    id: 'blog-index',
                    type: 'dynamic',
                    label: 'Published Articles',
                    variant: 'blog-index',
                    theme: 'soft',
                    eyebrow: 'Published Articles',
                    title: 'Latest Blog Posts',
                    text: 'Browse published automation articles from the CMS. Drafts stay hidden until they are published from the admin panel.',
                    items: [
                        cardItem('blog-topic-warehouse', 'Warehouse Automation', '', 'solutions.html#asrs'),
                        cardItem('blog-topic-factory', 'Smart Factory', '', 'solutions.html#factory'),
                        cardItem('blog-topic-robotics', 'AGV & Robotics', '', 'solutions.html#factory'),
                        cardItem('blog-topic-packaging', 'Packaging & Printing', '', 'solutions.html#machinery'),
                        cardItem('blog-topic-filling', 'Filling & Film Blowing', '', 'solutions.html#machinery'),
                        cardItem('blog-topic-machinery', 'Industrial Machinery', '', 'solutions.html#machinery'),
                    ],
                },
                {
                    id: 'blog-cta',
                    type: 'cta',
                    label: 'Business Challenge CTA',
                    eyebrow: 'Business Challenge',
                    title: 'Start with Your Business Challenge',
                    text: "Whether you're planning a warehouse upgrade, factory automation project, packaging production line, or manufacturing expansion, we can help you explore practical solutions, relevant technologies, and real project references.",
                    ctaText: 'Discuss Your Project',
                    ctaHref: 'contact.html',
                    items: [],
                },
            ];
        }

        if (page === 'about') {
            return [
                pageHero('about-hero', 'Hero / About intro', 'About 13ASRS', 'Global Industrial Automation Solutions Partner', 'Helping manufacturers and logistics operators improve storage, production, and material flow through practical automation solutions.\n\n13ASRS combines engineering expertise, project integration, and global manufacturing resources to support automation projects from concept to operation.'),
                {
                    id: 'about-what-we-do',
                    type: 'cards',
                    label: 'What We Do',
                    theme: 'soft',
                    grid: 'three',
                    eyebrow: 'What We Do',
                    title: 'We help businesses solve real operational challenges through practical automation solutions.',
                    text: 'We connect warehouse automation, smart factory technologies, and industrial manufacturing systems into practical solutions that support long-term business growth.',
                    items: [
                        cardItem('about-warehouse', 'Warehouse Automation', 'ASRS systems, shuttle solutions, stacker cranes, AGV logistics, warehouse software, and material handling technologies.'),
                        cardItem('about-factory', 'Smart Factory Solutions', 'Automated production lines, robotic systems, process automation, quality control, and intelligent manufacturing technologies.'),
                        cardItem('about-machinery', 'Industrial Manufacturing Systems', 'Printing and packaging equipment, film blowing systems, filling solutions, laser processing equipment, and specialized industrial machinery.'),
                    ],
                },
                {
                    id: 'about-industries',
                    type: 'cards',
                    label: 'Industries We Support',
                    variant: 'chip-list',
                    theme: 'dark',
                    eyebrow: 'Industries We Support',
                    title: 'Automation experience across manufacturing, warehousing, logistics, packaging, and industrial processing sectors.',
                    text: '',
                    items: [
                        cardItem('about-chip-logistics', 'Warehousing & Logistics', '', 'industries.html'),
                        cardItem('about-chip-food', 'Food & Beverage', '', 'industries.html#food'),
                        cardItem('about-chip-packaging', 'Printing & Packaging', '', 'industries.html#packaging'),
                        cardItem('about-chip-manufacturing', 'Manufacturing', '', 'industries.html#manufacturing'),
                        cardItem('about-chip-automotive', 'Automotive', '', 'industries.html#automotive'),
                        cardItem('about-chip-electronics', 'Electronics', '', 'industries.html#electronics'),
                        cardItem('about-chip-pharma', 'Pharmaceutical', '', 'industries.html#pharmaceutical'),
                        cardItem('about-chip-chemical', 'Industrial Processing', '', 'industries.html#chemical'),
                    ],
                },
                {
                    id: 'about-process',
                    type: 'cards',
                    label: 'How We Work',
                    variant: 'process-strip',
                    theme: 'soft',
                    eyebrow: 'How We Work',
                    title: 'From Concept to Operational Performance.',
                    text: '',
                    items: [
                        cardItem('about-discover', 'Discover', 'Understand operational goals, project requirements, and business challenges.'),
                        cardItem('about-design', 'Design', 'Develop practical automation concepts, layouts, and system architecture.'),
                        cardItem('about-integrate', 'Integrate', 'Coordinate equipment, controls, software, and engineering resources into a complete solution.'),
                        cardItem('about-deliver', 'Deliver', 'Support installation, commissioning, testing, and project acceptance.'),
                        cardItem('about-optimize', 'Optimize', 'Assist with operational handover, training, and long-term performance improvement.'),
                    ],
                },
                {
                    id: 'about-difference',
                    type: 'cards',
                    label: 'What Makes Us Different',
                    theme: 'dark',
                    grid: 'four',
                    eyebrow: 'What Makes Us Different',
                    title: 'Focused on business outcomes, not equipment listings.',
                    text: '',
                    items: [
                        cardItem('about-engineering', 'Engineering-Oriented', 'We focus on project outcomes, not product catalogs.'),
                        cardItem('about-solution', 'Solution-Focused', 'Every recommendation starts with the business challenge, not a machine.'),
                        cardItem('about-project', 'Project-Based', 'Real project references, implementation experience, and practical automation knowledge guide every solution.'),
                        cardItem('about-global', 'Global Perspective', 'Supporting industrial projects across manufacturing, warehousing, logistics, and processing industries.'),
                    ],
                },
                {
                    id: 'about-focus',
                    type: 'cards',
                    label: 'Our Focus Areas',
                    variant: 'chip-list',
                    theme: 'soft',
                    eyebrow: 'Our Focus Areas',
                    title: 'What We Support',
                    text: '',
                    items: [
                        cardItem('about-focus-warehouse', 'Warehouse Automation', '', 'solutions.html#asrs'),
                        cardItem('about-focus-factory', 'Smart Factory Automation', '', 'solutions.html#factory'),
                        cardItem('about-focus-machinery', 'Industrial Manufacturing Systems', '', 'solutions.html#machinery'),
                        cardItem('about-focus-manufacturing', 'Manufacturing', '', 'industries.html#manufacturing'),
                        cardItem('about-focus-packaging', 'Packaging', '', 'industries.html#packaging'),
                        cardItem('about-focus-food', 'Food Processing', '', 'industries.html#food'),
                        cardItem('about-focus-electronics', 'Electronics', '', 'industries.html#electronics'),
                        cardItem('about-focus-pharma', 'Pharmaceutical', '', 'industries.html#pharmaceutical'),
                    ],
                },
                {
                    id: 'about-locations',
                    type: 'text',
                    label: 'Locations',
                    theme: 'soft',
                    eyebrow: 'Locations',
                    title: 'Supported by engineering, manufacturing, and integration resources across China.',
                    text: 'Shenzhen · Foshan · Nanjing · Wenzhou · Jining\n\nServing customers worldwide.',
                    items: [],
                },
                {
                    id: 'about-cta',
                    type: 'cta',
                    label: 'Business Challenge CTA',
                    eyebrow: 'Business Challenge',
                    title: 'Start with Your Business Challenge',
                    text: "Whether you're planning a warehouse upgrade, factory automation project, production line expansion, or manufacturing investment, we can help you explore practical solutions and relevant project references.",
                    ctaText: 'Discuss Your Project',
                    ctaHref: 'contact.html',
                    items: [],
                },
            ];
        }

        if (page === 'contact') {
            return [
                pageHero('contact-hero', 'Hero / Contact intro', 'Contact', 'Start with Your Business Challenge', "Whether you're planning a warehouse automation project, smart factory upgrade, packaging production line, or manufacturing expansion, we're here to help.\n\nShare your goals, requirements, or operational challenges, and we'll recommend relevant technologies, project references, and practical automation approaches.\n\nAfter reviewing your requirements, we can recommend relevant technologies, project references, implementation approaches, and next-step recommendations tailored to your application."),
                {
                    id: 'contact-help',
                    type: 'cards',
                    label: 'How We Can Help',
                    variant: 'proof-list',
                    theme: 'dark',
                    eyebrow: 'How We Can Help',
                    title: 'Practical guidance for automation planning and project evaluation.',
                    text: '',
                    items: [
                        cardItem('contact-help-1', 'Explore suitable automation solutions', ''),
                        cardItem('contact-help-2', 'Review similar project references', ''),
                        cardItem('contact-help-3', 'Evaluate technology options', ''),
                        cardItem('contact-help-4', 'Discuss system layouts and workflows', ''),
                        cardItem('contact-help-5', 'Estimate project scope and investment range', ''),
                        cardItem('contact-help-6', 'Connect with relevant engineering resources', ''),
                    ],
                },
                {
                    id: 'contact-form',
                    type: 'dynamic',
                    label: 'Project Information Form',
                    variant: 'contact-form',
                    theme: 'soft',
                    eyebrow: 'Project Information',
                    title: 'Tell Us About Your Project',
                    text: 'The more information you provide, the better we can understand your requirements and recommend relevant solutions.',
                    items: [],
                },
                {
                    id: 'contact-direct',
                    type: 'cards',
                    label: 'Other Ways to Reach Us',
                    variant: 'proof-list',
                    theme: 'dark',
                    eyebrow: 'Other Ways to Reach Us',
                    title: 'Prefer direct contact?',
                    text: '',
                    items: [
                        cardItem('contact-email', 'Email: pjm@13asrs.com', ''),
                        cardItem('contact-wechat', 'WeChat: b1805339953', ''),
                        cardItem('contact-response', 'Response Time: Typically within 12 hours', ''),
                    ],
                },
            ];
        }

        const simplePageDefaults = {
            home: {
                eyebrow: 'Industrial Automation Solutions',
                title: 'Automation Solutions for Warehouses and Factories',
                text: 'Smart warehouse and factory integration for storage, handling, production, and logistics automation.'
            },
            industries: {
                eyebrow: 'Industries',
                title: 'Automation Solutions Designed Around Real Operational Challenges.',
                text: 'Explore how manufacturers, warehouses, and logistics operators improve storage capacity, production efficiency, material flow, and operational performance through practical automation technologies.'
            },
            'case-studies': {
                eyebrow: 'Case Studies',
                title: 'Learn from Real Automation Projects.',
                text: 'Explore warehouse automation systems, smart factory solutions, packaging production lines, and industrial manufacturing projects from around the world.'
            },
            blog: {
                eyebrow: 'Knowledge Center',
                title: 'Industrial Knowledge for Better Automation Decisions.',
                text: 'Explore technology insights, project breakdowns, industry trends, and practical automation solutions covering warehouse automation, smart manufacturing, packaging technologies, and industrial machinery.'
            },
            about: {
                eyebrow: 'About 13ASRS',
                title: 'Global Industrial Automation Solutions Partner.',
                text: 'We help manufacturers and logistics operators explore practical automation technologies, project references, and implementation approaches.'
            },
            contact: {
                eyebrow: 'Contact',
                title: 'Start with Your Business Challenge',
                text: "Whether you're planning a warehouse automation project, smart factory upgrade, packaging production line, or manufacturing expansion, we're here to help."
            }
        };
        if (page !== 'solutions') {
            const defaults = simplePageDefaults[page];
            return defaults ? [{
                id: `${page}-hero`,
                type: 'hero',
            label: '首屏文字',
                variant: 'page-hero',
                eyebrow: defaults.eyebrow,
                title: defaults.title,
                text: defaults.text,
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [],
            }] : [];
        }
        return [
            {
                id: 'solutions-hero',
                type: 'hero',
                label: 'Hero / Solutions intro',
                variant: 'page-hero',
                eyebrow: 'Solutions',
                title: 'Automation Solutions for Warehouses, Factories, and Industrial Manufacturing.',
                text: 'Explore practical technologies and integrated systems designed to improve storage capacity, material flow, production efficiency, and operational performance.',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [],
            },
            {
                id: 'solutions-asrs',
                type: 'cards',
                label: '01 / ASRS & Smart Warehouse',
                anchor: 'asrs',
                theme: 'soft',
                grid: 'two',
                eyebrow: '01 / ASRS & Smart Warehouse',
                title: 'ASRS & Smart Warehouse Solutions',
                text: 'Increase Storage Capacity. Improve Throughput. Reduce Manual Operations.\n\nFrom shuttle systems and stacker cranes to AGV logistics and warehouse software, our solutions help warehouses operate more efficiently, accurately, and reliably.',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [
                    {
                        id: 'solutions-asrs-tech',
                        title: 'Typical Technologies',
                        text: 'Shuttle ASRS and four-way shuttle systems\nStacker crane, miniload, and cold storage ASRS\nConveyor systems, AGV logistics, WMS/WES integration',
                        href: '',
                        image: 'solutions-asrs-technology.webp',
                        alt: 'Shuttle ASRS and warehouse automation technologies',
                    },
                    {
                        id: 'solutions-asrs-planning',
                        title: 'How We Approach Projects',
                        text: 'Understand operational challenges and business goals\nEvaluate warehouse data and process requirements\nRecommend suitable automation technologies\nReference similar projects and implementation experience\nSupport planning, integration, and delivery',
                        href: '',
                        image: 'solutions-project-planning.webp',
                        alt: 'Automation project planning and warehouse layout review',
                    },
                ],
            },
            {
                id: 'solutions-asrs-faq',
                type: 'cards',
                label: 'ASRS FAQ',
                variant: 'faq-list',
                theme: 'soft',
                eyebrow: '',
                title: '',
                text: '',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [
                    {
                        id: 'solutions-asrs-faq-1',
                        title: 'When should an ASRS system be considered?',
                        text: 'When storage density, labor availability, throughput, temperature control, or traceability become limiting factors for growth.',
                        href: '',
                        image: '',
                        alt: '',
                    },
                    {
                        id: 'solutions-asrs-faq-2',
                        title: 'What does 13ASRS provide?',
                        text: 'System design, equipment coordination, controls, software integration, installation, commissioning, and case-based project planning.',
                        href: '',
                        image: '',
                        alt: '',
                    },
                ],
            },
            {
                id: 'solutions-factory',
                type: 'cards',
                label: '02 / Smart Factory',
                anchor: 'factory',
                theme: 'dark',
                grid: 'two',
                eyebrow: '02 / Smart Factory',
                title: 'Smart Factory Automation',
                text: 'Key application areas for improving production efficiency, material flow, labor stability, and factory operations.',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [
                    { id: 'solutions-factory-production', title: 'Production Line Automation', text: 'Improve production efficiency and process consistency through integrated manufacturing systems.', href: '', image: 'solutions-production-line.webp', alt: 'Production line automation' },
                    { id: 'solutions-factory-robotic', title: 'Robotic Handling & Automation', text: 'Reduce repetitive labor and increase operational stability.', href: '', image: 'solutions-robotic-handling.webp', alt: 'Robotic handling and automation' },
                    { id: 'solutions-factory-flow', title: 'Material Flow & Logistics', text: 'Connect production processes through intelligent transportation and line-feeding systems.', href: '', image: 'solutions-material-flow.webp', alt: 'Material flow and logistics automation' },
                    { id: 'solutions-factory-upgrade', title: 'Factory Upgrade Programs', text: 'Implement automation step by step without disrupting existing operations.', href: '', image: 'solutions-factory-upgrade.webp', alt: 'Factory upgrade automation program' },
                ],
            },
            {
                id: 'solutions-factory-faq',
                type: 'cards',
                label: 'Factory FAQ',
                variant: 'faq-list',
                theme: 'dark',
                eyebrow: '',
                title: '',
                text: '',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [
                    {
                        id: 'solutions-factory-faq-1',
                        title: 'Can smart factory work be phased?',
                        text: 'Yes. 13ASRS can begin with material handling, line feeding, or logistics automation, then expand into connected production systems.',
                        href: '',
                        image: '',
                        alt: '',
                    },
                ],
            },
            {
                id: 'solutions-machinery',
                type: 'cards',
                label: '03 / Industrial Machinery',
                anchor: 'machinery',
                theme: 'soft',
                grid: 'three',
                eyebrow: '03 / Industrial Machinery',
                title: 'Industrial Manufacturing Solutions',
                text: 'Supporting packaging, printing, converting, processing, and production industries with specialized equipment and integrated manufacturing systems.\n\nFrom individual machines to complete production lines, we help manufacturers improve efficiency, consistency, and operational performance.',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [
                    { id: 'solutions-machinery-printing', title: 'Printing & Packaging Systems', text: 'Printing, converting, packaging, and bag-making technologies for flexible packaging and industrial production.', href: '', image: '', alt: '' },
                    { id: 'solutions-machinery-filling', title: 'Filling & Film Blowing Systems', text: 'Filling lines, film extrusion equipment, and integrated packaging production solutions.', href: '', image: '', alt: '' },
                    { id: 'solutions-machinery-laser', title: 'Laser Processing & Industrial Equipment', text: 'Laser cutting, laser processing, and advanced manufacturing equipment for industrial applications.', href: '', image: '', alt: '' },
                ],
            },
            {
                id: 'solutions-proof',
                type: 'cards',
                label: 'Why Choose 13ASRS',
                variant: 'proof-list',
                theme: 'dark',
                eyebrow: 'Why Choose 13ASRS',
                title: 'Why Companies Work With 13ASRS',
                text: '',
                image: '',
                youtubeUrl: '',
                ctaText: '',
                ctaHref: '',
                items: [
                    { id: 'proof-1', title: 'Practical Automation Solutions', text: '', href: '', image: '', alt: '' },
                    { id: 'proof-2', title: 'Real Project Experience', text: '', href: '', image: '', alt: '' },
                    { id: 'proof-3', title: 'Engineering Integration', text: '', href: '', image: '', alt: '' },
                    { id: 'proof-4', title: 'Warehouse & Factory Expertise', text: '', href: '', image: '', alt: '' },
                    { id: 'proof-5', title: 'Global Manufacturing Resources', text: '', href: '', image: '', alt: '' },
                    { id: 'proof-6', title: 'Long-Term Project Support', text: '', href: '', image: '', alt: '' },
                ],
            },
            {
                id: 'solutions-cta',
                type: 'cta',
                label: 'Business Challenge CTA',
                eyebrow: 'Business Challenge',
                title: 'Start with Your Business Challenge',
                text: "Whether you're planning a warehouse upgrade, factory automation project, packaging production line, or manufacturing expansion, we can help you explore practical solutions, relevant technologies, and real project references.",
                image: '',
                youtubeUrl: '',
                ctaText: 'Discuss Your Project',
                ctaHref: 'contact.html',
                items: [],
            },
        ];
    }

    function getCurrentModule() {
        return state.pageModules.find(module => module.id === state.currentModuleId) || null;
    }

    function updateModuleFromForm() {
        const module = getCurrentModule();
        if (!module || !els.pageModuleForm || els.pageModuleForm.hidden) return;

        module.type = els.moduleFields.type.value;
        module.label = els.moduleFields.label.value.trim();
        module.eyebrow = els.moduleFields.eyebrow.value.trim();
        module.title = els.moduleFields.title.value.trim();
        module.text = els.moduleFields.text.value.trim();
        module.image = els.moduleFields.image.value.trim();
        module.youtubeUrl = els.moduleFields.youtubeUrl.value.trim();
        module.ctaText = els.moduleFields.ctaText.value.trim();
        module.ctaHref = els.moduleFields.ctaHref.value.trim();
        module.items = [...els.moduleItems.querySelectorAll('[data-module-item-id]')].map(row => ({
            id: row.dataset.moduleItemId,
            title: row.querySelector('[data-item-field="title"]').value.trim(),
            text: row.querySelector('[data-item-field="text"]').value.trim(),
            href: row.querySelector('[data-item-field="href"]').value.trim(),
            image: row.querySelector('[data-item-field="image"]').value.trim(),
            alt: row.querySelector('[data-item-field="alt"]').value.trim(),
        }));
    }

    function renderPageModuleList() {
        if (!els.pageModuleList) return;
        els.pageModuleCount.textContent = String(state.pageModules.length);
        if (els.pageBuilderStatus) {
            els.pageBuilderStatus.textContent = `${state.currentPage} / 已加载 ${state.pageModules.length} 个模块`;
        }

        if (!state.pageModules.length) {
            els.pageModuleList.innerHTML = '<div class="empty-builder-note">当前页面还没有模块，可在上方新增模块。</div>';
            return;
        }

        els.pageModuleList.innerHTML = state.pageModules.map((module, index) => {
            const name = module.label || module.title || module.type;
            return `
                <button type="button" class="module-list-item ${module.id === state.currentModuleId ? 'active' : ''}" data-module-id="${escapeHtml(module.id)}">
                    <strong>${index + 1}. ${escapeHtml(name)}</strong>
                    <span>${escapeHtml(getModuleTypeName(module.type))}${module.title ? ' / ' + escapeHtml(module.title) : ''}</span>
                </button>
            `;
        }).join('');
    }

    function renderModuleItems(module) {
        if (!els.moduleItems) return;
        const items = Array.isArray(module.items) ? module.items : [];
        if (!items.length) {
            els.moduleItems.innerHTML = '<div class="empty-builder-note">还没有卡片。</div>';
            return;
        }

        els.moduleItems.innerHTML = items.map(item => `
            <div class="module-item-row" data-module-item-id="${escapeHtml(item.id)}">
                <input type="text" data-item-field="title" placeholder="卡片标题" value="${escapeHtml(item.title)}">
                <textarea rows="2" data-item-field="text" placeholder="卡片正文">${escapeHtml(item.text)}</textarea>
                <input type="text" data-item-field="image" placeholder="图片 URL" value="${escapeHtml(item.image)}">
                <input type="text" data-item-field="alt" placeholder="图片说明" value="${escapeHtml(item.alt)}">
                <input type="text" data-item-field="href" placeholder="链接" value="${escapeHtml(item.href)}">
                <button type="button" class="btn danger" data-remove-module-item="${escapeHtml(item.id)}">删除</button>
            </div>
        `).join('');
    }

    function clearModuleEditorFields() {
        Object.values(els.moduleFields).forEach(field => {
            if (field) field.value = '';
        });
        if (els.moduleFields.type) els.moduleFields.type.value = 'hero';
        if (els.moduleItems) els.moduleItems.innerHTML = '';
        if (els.moduleItemsField) els.moduleItemsField.hidden = true;
    }

    function renderEmptyModuleEditor() {
        const typeName = getModuleTypeName(els.addModuleType?.value || 'hero');
        els.moduleEditorEmpty.innerHTML = `
            <div>当前页面还没有选中模块。</div>
            <button type="button" class="btn primary" data-empty-add-module>新增${escapeHtml(typeName)}</button>
        `;
    }

    function renderModuleEditor() {
        const module = getCurrentModule();
        const hasModule = Boolean(module);
        els.moduleEditorEmpty.hidden = hasModule;
        els.pageModuleForm.hidden = !hasModule;
        els.duplicatePageModule.disabled = !hasModule;
        els.moveModuleUp.disabled = !hasModule;
        els.moveModuleDown.disabled = !hasModule;
        els.deletePageModule.disabled = !hasModule;

        if (!module) {
            clearModuleEditorFields();
            renderEmptyModuleEditor();
            return;
        }

        els.moduleFields.type.value = module.type || 'text';
        els.moduleFields.label.value = module.label || '';
        els.moduleFields.eyebrow.value = module.eyebrow || '';
        els.moduleFields.title.value = module.title || '';
        els.moduleFields.text.value = module.text || '';
        els.moduleFields.image.value = module.image || '';
        els.moduleFields.youtubeUrl.value = module.youtubeUrl || '';
        els.moduleFields.ctaText.value = module.ctaText || '';
        els.moduleFields.ctaHref.value = module.ctaHref || '';
        els.moduleItemsField.hidden = !moduleUsesItems(module);
        renderModuleItems(module);
    }

    function renderPageBuilder() {
        renderPageModuleList();
        renderModuleEditor();
    }

    async function loadPageModules(page = state.currentPage) {
        if (!els.pageSelector || typeof pageApi === 'undefined') return;
        state.currentPage = page;
        state.pageModules = [];
        state.currentModuleId = null;
        els.pageSelector.value = page;
        renderPageBuilder();
        els.pageModuleList.innerHTML = '<div class="empty-builder-note">正在加载模块...</div>';
        if (els.pageBuilderStatus) {
            els.pageBuilderStatus.textContent = `${page} / 正在加载模块...`;
        }

        try {
            const pageData = await pageApi.getAdminPage(page);
            const modules = Array.isArray(pageData.modules) ? pageData.modules : [];
            const defaultModules = getDefaultPageModules(page);
            if (
                modules.length === 1 &&
                modules[0]?.variant === 'page-hero' &&
                defaultModules.length > 1 &&
                defaultModules[0]?.variant === 'page-hero'
            ) {
                state.pageModules = [{ ...defaultModules[0], ...modules[0] }, ...defaultModules.slice(1)];
            } else {
                state.pageModules = modules.length ? modules : defaultModules;
            }
            state.currentModuleId = state.pageModules[0]?.id || null;
            renderPageBuilder();
            if ((!modules.length || modules.length < state.pageModules.length) && state.pageModules.length) {
                showPageNotice('已加载默认可编辑页面模板，修改后点击保存发布。', 'info');
            }
        } catch (error) {
            console.error('Could not load page modules:', error);
            state.pageModules = [];
            renderPageBuilder();
            showPageNotice(error.message || 'Could not load page modules.', 'error');
        }
    }

    async function savePageModules() {
        updateModuleFromForm();
        try {
            const saved = await pageApi.saveAdminPage(state.currentPage, {
                page: state.currentPage,
                modules: state.pageModules,
            });
            state.pageModules = Array.isArray(saved.modules) ? saved.modules : [];
            state.currentModuleId = state.currentModuleId && state.pageModules.some(module => module.id === state.currentModuleId)
                ? state.currentModuleId
                : state.pageModules[0]?.id || null;
            renderPageBuilder();
            showPageNotice('页面内容已保存。', 'success');
        } catch (error) {
            console.error('Could not save page modules:', error);
            showPageNotice(error.message || 'Could not save page modules.', 'error');
        }
    }

    function addPageModule() {
        updateModuleFromForm();
        const module = makeModule(els.addModuleType.value);
        state.pageModules.push(module);
        state.currentModuleId = module.id;
        renderPageBuilder();
    }

    function duplicatePageModule() {
        updateModuleFromForm();
        const module = getCurrentModule();
        if (!module) return;
        const copy = JSON.parse(JSON.stringify(module));
        copy.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        copy.label = `${copy.label || copy.title || copy.type} 复制`;
        copy.items = (copy.items || []).map(item => ({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        const index = state.pageModules.findIndex(item => item.id === module.id);
        state.pageModules.splice(index + 1, 0, copy);
        state.currentModuleId = copy.id;
        renderPageBuilder();
    }

    function moveCurrentModule(direction) {
        updateModuleFromForm();
        const index = state.pageModules.findIndex(module => module.id === state.currentModuleId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= state.pageModules.length) return;
        const [module] = state.pageModules.splice(index, 1);
        state.pageModules.splice(nextIndex, 0, module);
        renderPageBuilder();
    }

    function deleteCurrentModule() {
        const index = state.pageModules.findIndex(module => module.id === state.currentModuleId);
        if (index < 0) return;
        if (!confirm('确定删除这个页面模块吗？')) return;
        state.pageModules.splice(index, 1);
        state.currentModuleId = state.pageModules[Math.min(index, state.pageModules.length - 1)]?.id || null;
        renderPageBuilder();
    }

    function addModuleItem() {
        updateModuleFromForm();
        const module = getCurrentModule();
        if (!module) return;
        module.items = Array.isArray(module.items) ? module.items : [];
        module.items.push(makeModuleItem());
        renderModuleEditor();
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

    els.pageSelector.addEventListener('change', event => loadPageModules(event.target.value));
    els.addPageModule.addEventListener('click', addPageModule);
    els.addModuleType.addEventListener('change', () => {
        if (!getCurrentModule()) renderModuleEditor();
    });
    els.savePageModules.addEventListener('click', savePageModules);
    els.duplicatePageModule.addEventListener('click', duplicatePageModule);
    els.moveModuleUp.addEventListener('click', () => moveCurrentModule(-1));
    els.moveModuleDown.addEventListener('click', () => moveCurrentModule(1));
    els.deletePageModule.addEventListener('click', deleteCurrentModule);
    els.addModuleItem.addEventListener('click', addModuleItem);
    els.moduleEditorEmpty.addEventListener('click', event => {
        if (event.target.closest('[data-empty-add-module]')) addPageModule();
    });
    els.pageModuleList.addEventListener('click', event => {
        const item = event.target.closest('[data-module-id]');
        if (!item) return;
        updateModuleFromForm();
        state.currentModuleId = item.dataset.moduleId;
        renderPageBuilder();
    });
    els.pageModuleForm.addEventListener('input', () => {
        updateModuleFromForm();
        renderPageModuleList();
        if (getCurrentModule()) {
            els.moduleItemsField.hidden = !moduleUsesItems(getCurrentModule());
        }
    });
    els.moduleFields.type.addEventListener('change', () => {
        updateModuleFromForm();
        renderModuleEditor();
        renderPageModuleList();
    });
    els.moduleItems.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-module-item]');
        if (!button) return;
        updateModuleFromForm();
        const module = getCurrentModule();
        if (!module) return;
        module.items = (module.items || []).filter(item => item.id !== button.dataset.removeModuleItem);
        renderModuleEditor();
    });

    document.querySelectorAll('[data-command]').forEach(button => {
        button.addEventListener('click', () => runEditorCommand(button.dataset.command));
    });

    await initializeAllData();
    await loadPageModules(state.currentPage);
    updateContentModeLabels();
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
