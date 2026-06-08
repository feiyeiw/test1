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
            const text = `${blog.title || ''} ${blog.summary || ''} ${blog.category || ''} ${blog.industryLabel || ''} ${blog.solutionLabel || ''}`.toLowerCase();
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
                    <span>${escapeHtml(blog.industryLabel || 'No industry')}</span>
                    <span>${escapeHtml(blog.solutionLabel || blog.category || 'No solution')}</span>
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
        if (payload.status === 'published' && !payload.coverImage && !payload.youtubeUrl) {
            showNotice('Add a local image, image URL, or video URL before publishing.', 'error');
            els.fields.coverImage.focus();
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
            hero: 'Hero section',
            text: 'Text block',
            cards: 'Card grid',
            media: 'Media block',
            cta: 'CTA',
        };
        return labels[type] || 'Module';
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
            variant: '',
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

    function getDefaultPageModules(page) {
        if (page !== 'solutions') return [];
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
            els.pageBuilderStatus.textContent = `${state.currentPage} / ${state.pageModules.length} module${state.pageModules.length === 1 ? '' : 's'} loaded`;
        }

        if (!state.pageModules.length) {
            els.pageModuleList.innerHTML = '<div class="empty-builder-note">This page has no modules yet. Add a module above.</div>';
            return;
        }

        els.pageModuleList.innerHTML = state.pageModules.map((module, index) => {
            const name = module.label || module.title || module.type;
            return `
                <button type="button" class="module-list-item ${module.id === state.currentModuleId ? 'active' : ''}" data-module-id="${escapeHtml(module.id)}">
                    <strong>${index + 1}. ${escapeHtml(name)}</strong>
                    <span>${escapeHtml(module.type)}${module.title ? ' / ' + escapeHtml(module.title) : ''}</span>
                </button>
            `;
        }).join('');
    }

    function renderModuleItems(module) {
        if (!els.moduleItems) return;
        const items = Array.isArray(module.items) ? module.items : [];
        if (!items.length) {
            els.moduleItems.innerHTML = '<div class="empty-builder-note">No cards yet.</div>';
            return;
        }

        els.moduleItems.innerHTML = items.map(item => `
            <div class="module-item-row" data-module-item-id="${escapeHtml(item.id)}">
                <input type="text" data-item-field="title" placeholder="Card title" value="${escapeHtml(item.title)}">
                <textarea rows="2" data-item-field="text" placeholder="Card text">${escapeHtml(item.text)}</textarea>
                <input type="text" data-item-field="image" placeholder="Image URL" value="${escapeHtml(item.image)}">
                <input type="text" data-item-field="alt" placeholder="Image alt" value="${escapeHtml(item.alt)}">
                <input type="text" data-item-field="href" placeholder="Link" value="${escapeHtml(item.href)}">
                <button type="button" class="btn danger" data-remove-module-item="${escapeHtml(item.id)}">Delete</button>
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
            <div>No module selected on this page yet.</div>
            <button type="button" class="btn primary" data-empty-add-module>Add ${escapeHtml(typeName)}</button>
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
        els.moduleItemsField.hidden = module.type !== 'cards';
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
        els.pageModuleList.innerHTML = '<div class="empty-builder-note">Loading modules...</div>';
        if (els.pageBuilderStatus) {
            els.pageBuilderStatus.textContent = `${page} / loading modules...`;
        }

        try {
            const pageData = await pageApi.getAdminPage(page);
            const modules = Array.isArray(pageData.modules) ? pageData.modules : [];
            const defaultModules = getDefaultPageModules(page);
            state.pageModules = modules.length ? modules : defaultModules;
            state.currentModuleId = state.pageModules[0]?.id || null;
            renderPageBuilder();
            if (!modules.length && state.pageModules.length) {
                showPageNotice('Loaded the default editable Solutions template. Click Save to publish your edits.', 'info');
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
            showPageNotice('Page modules saved to KV.', 'success');
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
        copy.label = `${copy.label || copy.title || copy.type} copy`;
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
        if (!confirm('Delete this page module?')) return;
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
            els.moduleItemsField.hidden = getCurrentModule().type !== 'cards';
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
