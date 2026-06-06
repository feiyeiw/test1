const API_CONFIG = {
    baseUrl: '/api',
    retryAttempts: 1,
    retryDelay: 700,
};

function getJwtToken() {
    try {
        const session = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
        return session.token || null;
    } catch {
        return null;
    }
}

function _setAdminJwtToken(token) {
    sessionStorage.setItem('adminSession', JSON.stringify({
        loggedIn: true,
        token,
        loginTime: new Date().toISOString(),
    }));
}

async function apiRequest(endpoint, options = {}) {
    const attempts = options.retryAttempts ?? API_CONFIG.retryAttempts;
    let lastError;

    for (let attempt = 0; attempt <= attempts; attempt++) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            };

            const jwtToken = getJwtToken();
            if (jwtToken && !headers.Authorization) {
                headers.Authorization = `Bearer ${jwtToken}`;
            }

            const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
                ...options,
                headers,
            });

            const text = await response.text();
            const data = text ? JSON.parse(text) : null;

            if (!response.ok) {
                throw new Error(data?.error || `API error ${response.status}`);
            }

            return data;
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay * (attempt + 1)));
            }
        }
    }

    throw lastError;
}

function normalizeClientBlog(blog = {}) {
    const contentHtml = blog.contentHtml ?? blog.content ?? '';
    return {
        ...blog,
        contentHtml,
        content: contentHtml,
        plainText: blog.plainText || contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        status: blog.status === 'published' ? 'published' : 'draft',
    };
}

function normalizeBlogList(blogs) {
    return Array.isArray(blogs) ? blogs.map(normalizeClientBlog) : [];
}

const blogApi = {
    async getAllBlogs() {
        return normalizeBlogList(await apiRequest('/blogs', { method: 'GET' }));
    },

    async getBlogById(id) {
        if (!id) return null;
        return normalizeClientBlog(await apiRequest(`/blogs/${encodeURIComponent(id)}`, { method: 'GET' }));
    },

    async getAdminBlogs() {
        return normalizeBlogList(await apiRequest('/admin/blogs', { method: 'GET' }));
    },

    async getAdminBlogById(id) {
        if (!id) return null;
        return normalizeClientBlog(await apiRequest(`/admin/blogs/${encodeURIComponent(id)}`, { method: 'GET' }));
    },

    async createBlog(blogData) {
        return normalizeClientBlog(await apiRequest('/admin/blogs', {
            method: 'POST',
            body: JSON.stringify(blogData),
        }));
    },

    async updateBlog(id, blogData) {
        return normalizeClientBlog(await apiRequest(`/admin/blogs/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(blogData),
        }));
    },

    async deleteBlog(id) {
        await apiRequest(`/admin/blogs/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return true;
    },

    async publishBlog(id) {
        return normalizeClientBlog(await apiRequest(`/admin/blogs/${encodeURIComponent(id)}/publish`, { method: 'POST' }));
    },

    async unpublishBlog(id) {
        return normalizeClientBlog(await apiRequest(`/admin/blogs/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }));
    },

    async uploadMedia(mediaData) {
        return apiRequest('/admin/uploads', {
            method: 'POST',
            body: JSON.stringify(mediaData),
        });
    },

    async checkApiStatus() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/health`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal,
            });
            return response.ok;
        } catch {
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    },

    setJwtToken(token) {
        _setAdminJwtToken(token);
    },
};

const pageApi = {
    async getAdminPages() {
        const pages = await apiRequest('/admin/pages', { method: 'GET' });
        return Array.isArray(pages) ? pages : [];
    },

    async getAdminPage(page) {
        return apiRequest(`/admin/pages/${encodeURIComponent(page)}`, { method: 'GET' });
    },

    async saveAdminPage(page, pageData) {
        return apiRequest(`/admin/pages/${encodeURIComponent(page)}`, {
            method: 'PUT',
            body: JSON.stringify(pageData),
        });
    },

    async getPublicPage(page) {
        return apiRequest(`/pages/${encodeURIComponent(page)}`, { method: 'GET' });
    },
};
