// API Configuration
const API_CONFIG = {
    baseUrl: '/api',
    apiKey: localStorage.getItem('adminApiKey') || '',
    cacheTimeout: 5 * 60 * 1000,
    retryAttempts: 2,
    retryDelay: 1000,
};

// JWT Token helpers
function getJwtToken() {
    try {
        const session = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
        return session.token || null;
    } catch {
        return null;
    }
}

function _setAdminJwtToken(token) {
    const session = {
        loggedIn: true,
        token: token,
        loginTime: new Date().toISOString(),
    };
    sessionStorage.setItem('adminSession', JSON.stringify(session));
}

// Helper function to make API requests with retry logic
async function apiRequest(endpoint, options = {}) {
    const { retryAttempts = API_CONFIG.retryAttempts, retryDelay = API_CONFIG.retryDelay } = options;
    let lastError;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
            const url = `${API_CONFIG.baseUrl}${endpoint}`;
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers,
            };

            const jwtToken = getJwtToken();
            if (jwtToken && !headers['Authorization']) {
                headers['Authorization'] = `Bearer ${jwtToken}`;
            }

            if (!jwtToken && API_CONFIG.apiKey && !headers['X-API-Key']) {
                headers['X-API-Key'] = API_CONFIG.apiKey;
            }

            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;
            console.warn(`API request attempt ${attempt + 1}/${retryAttempts + 1} failed:`, error.message);

            if (attempt < retryAttempts) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            }
        }
    }

    throw lastError;
}

// Helper function to check if API is available
async function checkApiAvailability() {
    try {
        await fetch(`${API_CONFIG.baseUrl}/health`, { method: 'GET', timeout: 3000 });
        return true;
    } catch (error) {
        console.warn('API not available:', error.message);
        return false;
    }
}

// Cache management
const CACHE_KEYS = {
    BLOGS: 'blogs_cache',
    BLOGS_TIMESTAMP: 'blogs_cache_timestamp',
    API_AVAILABLE: 'api_available_cache',
};

function getCachedBlogs() {
    const cached = localStorage.getItem(CACHE_KEYS.BLOGS);
    const timestamp = localStorage.getItem(CACHE_KEYS.BLOGS_TIMESTAMP);

    if (!cached || !timestamp) {
        return null;
    }

    const age = Date.now() - parseInt(timestamp);
    if (age > API_CONFIG.cacheTimeout) {
        return null;
    }

    try {
        const blogs = JSON.parse(cached);
        return blogs.map(blog => ({
            ...blog,
            id: String(blog.id)
        }));
    } catch (error) {
        console.error('Error parsing cached blogs:', error);
        return null;
    }
}

function setCachedBlogs(blogs) {
    try {
        localStorage.setItem(CACHE_KEYS.BLOGS, JSON.stringify(blogs));
        localStorage.setItem(CACHE_KEYS.BLOGS_TIMESTAMP, Date.now().toString());
    } catch (error) {
        console.error('Error caching blogs:', error);
    }
}

// API Service functions with hybrid mode (remote API + local fallback)
const blogApi = {
    async getAllBlogs() {
        try {
            console.log('Fetching blogs from remote API...');
            const blogs = await apiRequest('/blogs', { method: 'GET' });
            console.log('API returned', blogs.length, 'blogs');

            const blogsWithStringIds = blogs.map(blog => ({
                ...blog,
                id: String(blog.id)
            }));

            setCachedBlogs(blogsWithStringIds);
            localStorage.setItem('blogs', JSON.stringify(blogsWithStringIds));

            return blogsWithStringIds;
        } catch (apiError) {
            console.warn('Failed to fetch from API:', apiError.message);

            const cachedBlogs = getCachedBlogs();
            if (cachedBlogs) {
                console.log('Using cached blogs as API fallback');
                return cachedBlogs;
            }

            console.log('No blogs available - API failed and no cache');
            return [];
        }
    },

    async getBlogById(id) {
        console.log('getBlogById called with id:', id, 'type:', typeof id);
        if (!id) return null;

        const cachedBlogs = getCachedBlogs();
        if (cachedBlogs) {
            console.log('Checking cached blogs, count:', cachedBlogs.length);
            const blog = cachedBlogs.find(b => b.id == id);
            if (blog) {
                console.log('Found blog in cache:', blog.id, blog.title);
                return blog;
            }
            console.log('Blog not found in cache');
        }

        try {
            console.log('Trying to fetch blog from API with ID:', id);
            const blog = await apiRequest(`/blogs/${id}`, { method: 'GET' });
            console.log('Successfully fetched blog from API:', blog ? blog.id : 'null');
            return blog;
        } catch (apiError) {
            console.warn(`Failed to fetch blog ${id} from API:`, apiError.message);

            try {
                console.log('Falling back to getAllBlogs for blog ID:', id);
                const blogs = await this.getAllBlogs();
                console.log('getAllBlogs returned', blogs.length, 'blogs');
                const foundBlog = blogs.find(blog => blog.id == id) || null;
                console.log('Found blog in getAllBlogs fallback:', foundBlog ? foundBlog.id : 'null');
                return foundBlog;
            } catch (error) {
                console.warn(`Error getting blog ${id}:`, error);
                console.log('Falling back to localStorage');
                const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
                const foundBlog = blogs.find(blog => blog.id == id) || null;
                console.log('Found blog in localStorage fallback:', foundBlog ? foundBlog.id : 'null');
                return foundBlog;
            }
        }
    },

    async createBlog(blogData) {
        if (!blogData.title || !blogData.content) {
            throw new Error('Title and content are required');
        }

        const blogPayload = {
            title: blogData.title.trim(),
            content: blogData.content.trim(),
            plainText: blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
            date: blogData.date || new Date().toISOString().split('T')[0],
        };

        try {
            const newBlog = await apiRequest('/blogs', {
                method: 'POST',
                body: JSON.stringify(blogPayload)
            });

            const cachedBlogs = getCachedBlogs() || [];
            cachedBlogs.unshift(newBlog);
            setCachedBlogs(cachedBlogs);

            const legacyBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
            legacyBlogs.unshift(newBlog);
            localStorage.setItem('blogs', JSON.stringify(legacyBlogs));

            console.log('Blog created successfully via API:', newBlog.id);
            return newBlog;
        } catch (apiError) {
            console.warn('Failed to create blog via API, using local storage:', apiError.message);

            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const newBlog = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ...blogPayload,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            blogs.unshift(newBlog);
            localStorage.setItem('blogs', JSON.stringify(blogs));
            setCachedBlogs(blogs);

            console.warn('Blog created locally (will not sync to other devices)');
            return newBlog;
        }
    },

    async updateBlog(id, blogData) {
        if (!id) {
            throw new Error('Blog ID is required');
        }

        const updatePayload = { ...blogData };
        if (blogData.content !== undefined) {
            updatePayload.plainText = blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        try {
            const updatedBlog = await apiRequest(`/blogs/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updatePayload)
            });

            const cachedBlogs = getCachedBlogs() || [];
            const cachedIndex = cachedBlogs.findIndex(blog => blog.id == id);
            if (cachedIndex !== -1) {
                cachedBlogs[cachedIndex] = updatedBlog;
                setCachedBlogs(cachedBlogs);
            }

            const legacyBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const legacyIndex = legacyBlogs.findIndex(blog => blog.id == id);
            if (legacyIndex !== -1) {
                legacyBlogs[legacyIndex] = updatedBlog;
                localStorage.setItem('blogs', JSON.stringify(legacyBlogs));
            }

            console.log('Blog updated successfully via API:', id);
            return updatedBlog;
        } catch (apiError) {
            console.warn('Failed to update blog via API, using local storage:', apiError.message);

            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const index = blogs.findIndex(blog => blog.id == id);

            if (index === -1) {
                throw new Error('Blog not found');
            }

            const updatedBlog = {
                ...blogs[index],
                ...blogData,
                id: id,
                updatedAt: new Date().toISOString()
            };

            if (blogData.content !== undefined) {
                updatedBlog.plainText = blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }

            blogs[index] = updatedBlog;
            localStorage.setItem('blogs', JSON.stringify(blogs));
            setCachedBlogs(blogs);

            console.warn('Blog updated locally (will not sync to other devices)');
            return updatedBlog;
        }
    },

    async deleteBlog(id) {
        if (!id) {
            throw new Error('Blog ID is required');
        }

        try {
            await apiRequest(`/blogs/${id}`, { method: 'DELETE' });

            const cachedBlogs = getCachedBlogs() || [];
            const cachedIndex = cachedBlogs.findIndex(blog => blog.id == id);
            if (cachedIndex !== -1) {
                cachedBlogs.splice(cachedIndex, 1);
                setCachedBlogs(cachedBlogs);
            }

            const legacyBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const legacyIndex = legacyBlogs.findIndex(blog => blog.id == id);
            if (legacyIndex !== -1) {
                legacyBlogs.splice(legacyIndex, 1);
                localStorage.setItem('blogs', JSON.stringify(legacyBlogs));
            }

            console.log('Blog deleted successfully via API:', id);
            return true;
        } catch (apiError) {
            console.warn('Failed to delete blog via API, using local storage:', apiError.message);

            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const index = blogs.findIndex(blog => blog.id == id);

            if (index === -1) {
                throw new Error('Blog not found');
            }

            blogs.splice(index, 1);
            localStorage.setItem('blogs', JSON.stringify(blogs));
            setCachedBlogs(blogs);

            console.warn('Blog deleted locally (will not sync to other devices)');
            return true;
        }
    },

    async exportBlogs() {
        const blogs = await this.getAllBlogs();
        const jsonStr = JSON.stringify(blogs, null, 2);

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blogs.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`Exported ${blogs.length} blogs`);
        return blogs;
    },

    async importBlogs(jsonFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedBlogs = JSON.parse(e.target.result);
                    if (!Array.isArray(importedBlogs)) {
                        throw new Error('JSON file must contain an array of blogs');
                    }

                    console.log(`Importing ${importedBlogs.length} blogs...`);

                    const existingBlogs = await this.getAllBlogs();
                    const existingIds = new Set(existingBlogs.map(blog => blog.id));

                    const mergedBlogs = [...existingBlogs];
                    let addedCount = 0;
                    let skippedCount = 0;

                    for (const blog of importedBlogs) {
                        if (!existingIds.has(blog.id)) {
                            mergedBlogs.push(blog);
                            existingIds.add(blog.id);
                            addedCount++;

                            try {
                                await apiRequest('/blogs', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        title: blog.title,
                                        content: blog.content,
                                        plainText: blog.plainText,
                                        date: blog.date
                                    })
                                });
                            } catch (apiError) {
                                console.warn(`Failed to upload blog ${blog.id} to API:`, apiError.message);
                            }
                        } else {
                            skippedCount++;
                        }
                    }

                    localStorage.setItem('blogs', JSON.stringify(mergedBlogs));
                    setCachedBlogs(mergedBlogs);

                    console.log(`Import complete: ${addedCount} added, ${skippedCount} skipped`);
                    resolve(mergedBlogs);
                } catch (error) {
                    reject(new Error(`Invalid JSON file: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(jsonFile);
        });
    },

    async syncWithRemote() {
        console.log('Starting sync with remote API...');
        const localBlogs = JSON.parse(localStorage.getItem('blogs')) || [];

        try {
            const remoteBlogs = await apiRequest('/blogs', { method: 'GET' });
            const remoteIds = new Set(remoteBlogs.map(blog => blog.id));

            let uploadedCount = 0;
            for (const blog of localBlogs) {
                if (!remoteIds.has(blog.id)) {
                    try {
                        await apiRequest('/blogs', {
                            method: 'POST',
                            body: JSON.stringify({
                                title: blog.title,
                                content: blog.content,
                                plainText: blog.plainText,
                                date: blog.date
                            })
                        });
                        uploadedCount++;
                        console.log(`Uploaded blog: ${blog.id} - ${blog.title}`);
                    } catch (error) {
                        console.warn(`Failed to upload blog ${blog.id}:`, error.message);
                    }
                }
            }

            const allBlogs = [...remoteBlogs];
            const remoteIdSet = new Set(remoteBlogs.map(b => b.id));

            for (const blog of localBlogs) {
                if (!remoteIdSet.has(blog.id)) {
                    allBlogs.push(blog);
                }
            }

            setCachedBlogs(allBlogs);
            localStorage.setItem('blogs', JSON.stringify(allBlogs));

            console.log(`Sync complete: Uploaded ${uploadedCount} blogs, total ${allBlogs.length} blogs`);
            return allBlogs;
        } catch (error) {
            console.error('Sync failed:', error);
            throw error;
        }
    },

    async checkApiStatus() {
        try {
            const status = await fetch(`${API_CONFIG.baseUrl}/health`);
            return status.ok;
        } catch (error) {
            return false;
        }
    },

    setApiKey(apiKey) {
        API_CONFIG.apiKey = apiKey;
        localStorage.setItem('adminApiKey', apiKey);
        console.log('API key updated');
    },

    setJwtToken(token) {
        _setAdminJwtToken(token);
    }
};
