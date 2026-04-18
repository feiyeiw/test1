// SHA-256 Hash function using Web Crypto API
async function sha256Hash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Cloudflare KV Blog Storage Service
// Supports cross-device access with fallback to local storage

// API Configuration
const API_CONFIG = {
    baseUrl: '/api', // Relative URL for Cloudflare Workers
    apiKey: localStorage.getItem('adminApiKey') || '', // Admin API key (legacy fallback)
    cacheTimeout: 5 * 60 * 1000, // 5 minutes cache timeout
    retryAttempts: 2, // Number of retry attempts
    retryDelay: 1000, // Delay between retries in ms
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

// i18n Configuration
const LANGUAGE_KEY = 'siteLanguage';

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

            // Add JWT Bearer token if available (preferred auth method)
            const jwtToken = getJwtToken();
            if (jwtToken && !headers['Authorization']) {
                headers['Authorization'] = `Bearer ${jwtToken}`;
            }

            // Fallback: add legacy API key if available and not already set
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

            // Don't wait on last attempt
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
        return null; // Cache expired
    }

    try {
        const blogs = JSON.parse(cached);
        // Ensure all IDs are strings for consistent comparison
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
    // Get all blogs - try from remote API first, then fallbacks
    async getAllBlogs() {
        // First try remote API for latest KV data
        try {
            console.log('Fetching blogs from remote API...');
            const blogs = await apiRequest('/blogs', { method: 'GET' });
            console.log('API returned', blogs.length, 'blogs');

            // Ensure all IDs are strings for consistent comparison (API should already return strings)
            const blogsWithStringIds = blogs.map(blog => ({
                ...blog,
                id: String(blog.id)
            }));

            // Cache the result
            setCachedBlogs(blogsWithStringIds);

            // Also update legacy localStorage for backward compatibility
            localStorage.setItem('blogs', JSON.stringify(blogsWithStringIds));

            return blogsWithStringIds;
        } catch (apiError) {
            console.warn('Failed to fetch from API:', apiError.message);

            // API failed, try cached data
            const cachedBlogs = getCachedBlogs();
            if (cachedBlogs) {
                console.log('Using cached blogs as API fallback');
                return cachedBlogs;
            }

            // No local JSON fallback, only return cached data or empty array
            console.log('No blogs available - API failed and no cache');
            return [];
        }
    },

    // Get single blog by ID - try from remote API first, then cache
    async getBlogById(id) {
        console.log('getBlogById called with id:', id, 'type:', typeof id);
        if (!id) return null;

        // First try to find in cached blogs
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

        // Try remote API
        try {
            console.log('Trying to fetch blog from API with ID:', id);
            const blog = await apiRequest(`/blogs/${id}`, { method: 'GET' });
            console.log('Successfully fetched blog from API:', blog ? blog.id : 'null');
            return blog;
        } catch (apiError) {
            console.warn(`Failed to fetch blog ${id} from API:`, apiError.message);

            // Fallback to getAllBlogs
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

    // Create new blog - try remote API first, then update local cache
    async createBlog(blogData) {
        // Validate required fields
        if (!blogData.title || !blogData.content) {
            throw new Error('Title and content are required');
        }

        // Prepare blog data
        const blogPayload = {
            title: blogData.title.trim(),
            content: blogData.content.trim(),
            plainText: blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
            date: blogData.date || new Date().toISOString().split('T')[0],
        };

        try {
            // Try remote API first
            const newBlog = await apiRequest('/blogs', {
                method: 'POST',
                body: JSON.stringify(blogPayload)
            });

            // Update local cache
            const cachedBlogs = getCachedBlogs() || [];
            cachedBlogs.unshift(newBlog); // Add to beginning (newest first)
            setCachedBlogs(cachedBlogs);

            // Update legacy localStorage for backward compatibility
            const legacyBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
            legacyBlogs.unshift(newBlog);
            localStorage.setItem('blogs', JSON.stringify(legacyBlogs));

            console.log('Blog created successfully via API:', newBlog.id);
            return newBlog;
        } catch (apiError) {
            console.warn('Failed to create blog via API, using local storage:', apiError.message);

            // Fallback to local storage
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

    // Update existing blog - try remote API first, then update local cache
    async updateBlog(id, blogData) {
        if (!id) {
            throw new Error('Blog ID is required');
        }

        // Prepare update data
        const updatePayload = { ...blogData };
        if (blogData.content !== undefined) {
            updatePayload.plainText = blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        try {
            // Try remote API first
            const updatedBlog = await apiRequest(`/blogs/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updatePayload)
            });

            // Update local cache
            const cachedBlogs = getCachedBlogs() || [];
            const cachedIndex = cachedBlogs.findIndex(blog => blog.id == id);
            if (cachedIndex !== -1) {
                cachedBlogs[cachedIndex] = updatedBlog;
                setCachedBlogs(cachedBlogs);
            }

            // Update legacy localStorage
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

            // Fallback to local storage
            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const index = blogs.findIndex(blog => blog.id == id);

            if (index === -1) {
                throw new Error('Blog not found');
            }

            const updatedBlog = {
                ...blogs[index],
                ...blogData,
                id: id, // Ensure ID doesn't change
                updatedAt: new Date().toISOString()
            };

            // Regenerate plainText if content changed
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

    // Delete blog - try remote API first, then update local cache
    async deleteBlog(id) {
        if (!id) {
            throw new Error('Blog ID is required');
        }

        try {
            // Try remote API first
            await apiRequest(`/blogs/${id}`, { method: 'DELETE' });

            // Update local cache
            const cachedBlogs = getCachedBlogs() || [];
            const cachedIndex = cachedBlogs.findIndex(blog => blog.id == id);
            if (cachedIndex !== -1) {
                cachedBlogs.splice(cachedIndex, 1);
                setCachedBlogs(cachedBlogs);
            }

            // Update legacy localStorage
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

            // Fallback to local storage
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

    // Export blogs to JSON file (admin only)
    async exportBlogs() {
        const blogs = await this.getAllBlogs(); // Get latest data
        const jsonStr = JSON.stringify(blogs, null, 2);

        // Create a blob and download link
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

    // Import blogs from JSON file (admin only) - adds to existing blogs
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

                    // Get existing blogs
                    const existingBlogs = await this.getAllBlogs();
                    const existingIds = new Set(existingBlogs.map(blog => blog.id));

                    // Merge blogs (skip duplicates by ID)
                    const mergedBlogs = [...existingBlogs];
                    let addedCount = 0;
                    let skippedCount = 0;

                    for (const blog of importedBlogs) {
                        if (!existingIds.has(blog.id)) {
                            mergedBlogs.push(blog);
                            existingIds.add(blog.id);
                            addedCount++;

                            // Try to upload to API
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

                    // Update local storage
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

    // Sync local blogs with remote API
    async syncWithRemote() {
        console.log('Starting sync with remote API...');
        const localBlogs = JSON.parse(localStorage.getItem('blogs')) || [];

        try {
            // Get remote blogs
            const remoteBlogs = await apiRequest('/blogs', { method: 'GET' });
            const remoteIds = new Set(remoteBlogs.map(blog => blog.id));

            // Upload local blogs that don't exist remotely
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

            // Update cache with merged data
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

    // Check API status
    async checkApiStatus() {
        try {
            const status = await fetch(`${API_CONFIG.baseUrl}/health`);
            return status.ok;
        } catch (error) {
            return false;
        }
    },

    // Set API key for admin operations (legacy fallback)
    setApiKey(apiKey) {
        API_CONFIG.apiKey = apiKey;
        localStorage.setItem('adminApiKey', apiKey);
        console.log('API key updated');
    },

    // Set JWT token for admin operations (preferred auth method)
    setJwtToken(token) {
        _setAdminJwtToken(token);
    }
};


// Admin credentials management
const ADMIN_STORAGE_KEY = 'adminCredentials';
const ADMIN_SESSION_KEY = 'adminSession';

// Reset admin credentials (for debugging/deployment issues)
window.resetAdminCredentials = async function() {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    console.log('Admin credentials reset. Reinitializing...');
    await initializeAdminCredentials();
    alert('Admin credentials have been reset to default:\nUsername: admin\nPassword: admin123');
};
// Initialize admin credentials if not exists
async function initializeAdminCredentials() {
    const savedCredentials = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!savedCredentials) {
        // Default credentials (admin / admin123)
        const defaultUsername = 'admin';
        const defaultPassword = 'admin123';
        const passwordHash = await sha256Hash(defaultPassword);

        const credentials = {
            username: defaultUsername,
            passwordHash: passwordHash,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(credentials));
        console.log('Default admin credentials created. Username: admin, Password: admin123');

        // Show a warning to change default password
        if (window.location.pathname.includes('admin')) {
            alert('⚠️ Default admin credentials created.\nUsername: admin\nPassword: admin123\n\nPlease change the password in the admin panel.');
        }
    }
}


// Initialize default site content
function initializeDefaultSiteContent() {
    const savedContent = localStorage.getItem('siteContent');
    const newDefaultSiteContent = {
        hero: {
            title: 'How Much Does an ASRS Warehouse Cost?',
            description: 'We help you design your system, estimate your investment, and deliver complete ASRS solutions.'
        },
        services: [
            {
                title: 'System Design',
                description: 'Custom ASRS layout and workflow optimization tailored to your warehouse requirements'
            },
            {
                title: 'Cost Estimation',
                description: 'Detailed investment analysis with ROI calculations and budget planning'
            },
            {
                title: 'Equipment Integration',
                description: 'Seamless integration of all modules including shelves, stackers, four-way shuttle trucks, AGVs/AMRs, robots, conveyors, and WMS/WCS systems'
            },
            {
                title: 'Full Project Delivery',
                description: 'End-to-end project management from design to installation and commissioning'
            }
        ],
        pages: {
            services: {
                title: 'Our Services',
                description: 'Comprehensive solutions for automated production and smart warehouse systems'
            },
            solutions: {
                title: 'Our Solutions',
                description: 'Tailored automated solutions for your specific manufacturing needs'
            },
            about: {
                title: 'About 1³ Machine',
                description: 'Your trusted partner for automated production and smart warehouse solutions'
            }
        }
    };

    if (!savedContent) {
        localStorage.setItem('siteContent', JSON.stringify(newDefaultSiteContent));
        console.log('Default site content created.');
    } else {
        // Migrate old default content to new defaults without overwriting custom edits
        const content = JSON.parse(savedContent);
        const oldTitle = 'Automated Production & Smart Warehouse Solutions';
        const oldDesc = 'We help manufacturers plan and implement automated production lines, packaging systems, and smart warehouse solutions using China-made equipment.';
        let migrated = false;

        if (content.hero && content.hero.title === oldTitle) {
            content.hero.title = newDefaultSiteContent.hero.title;
            migrated = true;
        }
        if (content.hero && content.hero.description === oldDesc) {
            content.hero.description = newDefaultSiteContent.hero.description;
            migrated = true;
        }

        if (migrated) {
            localStorage.setItem('siteContent', JSON.stringify(content));
            console.log('Site content migrated to new defaults.');
        }
    }
}

// Initialize all default data (admin credentials now managed server-side)
async function initializeAllData() {
    initializeDefaultSiteContent();
}

// Check if user is logged in for admin pages
async function checkAdminLogin() {
    // Check for JWT token first (new auth method)
    const jwtToken = getJwtToken();
    const legacyLogin = localStorage.getItem('adminLoggedIn') === 'true';

    if (!jwtToken && !legacyLogin) {
        window.location.href = 'login.html';
        return false;
    }

    // If we have a JWT token, optionally verify it server-side
    if (jwtToken) {
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: jwtToken })
            });

            if (!response.ok) {
                // Token invalid or expired - clear and redirect
                sessionStorage.removeItem(ADMIN_SESSION_KEY);
                localStorage.removeItem('adminLoggedIn');
                window.location.href = 'login.html';
                return false;
            }
        } catch (error) {
            // Network error - allow if token exists locally (graceful offline)
            console.warn('Could not verify token server-side:', error.message);
        }
    }

    // Legacy session check (backward compatibility)
    const session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || '{}');
    if (session.loginTime) {
        const loginTime = new Date(session.loginTime);
        const now = new Date();
        const hoursDiff = Math.abs(now - loginTime) / 36e5;
        if (hoursDiff > 24) {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            localStorage.removeItem('adminLoggedIn');
            window.location.href = 'login.html';
            return false;
        }
    }

    return true;
}

// Logout function
function logout() {
    localStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'login.html';
}

async function updateMainPage() {
    // Initialize default data if not exists
    await initializeAllData();

    // Only override with custom admin content in English mode.
    // In other languages let translatePage() handle the text so i18n works correctly.
    if (currentLanguage === 'en') {
        const savedContent = localStorage.getItem('siteContent');
        if (savedContent) {
            const content = JSON.parse(savedContent);

            // Update hero section
            const heroTitle = document.querySelector('.hero h1');
            const heroDesc = document.querySelector('.hero p');
            if (heroTitle && heroDesc) {
                heroTitle.textContent = content.hero.title;
                heroDesc.textContent = content.hero.description;
            }

            // Update services section
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

    // Load blogs on home page
    loadBlogsOnHome();
}

// Load blogs on home page
async function loadBlogsOnHome() {
    const blogsSection = document.getElementById('blogsSection');
    if (!blogsSection) {
        console.log('blogsSection not found in DOM');
        return;
    }

    const tLoading = getNestedValue(translations[currentLanguage], 'common.loading') || 'Loading...';
    // Show loading state
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

        // Sort blogs by date (newest first)
        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Sorted blogs count:', sortedBlogs.length);

        // Show only the latest 3 blogs
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

            // Create plain text preview by stripping HTML tags
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

// Update page content for all pages
async function updatePageContent() {
    // Initialize default data if not exists
    await initializeAllData();

    // Only override with custom admin content in English mode.
    // In other languages let translatePage() handle the text so i18n works correctly.
    if (currentLanguage !== 'en') return;

    const savedContent = localStorage.getItem('siteContent');
    if (!savedContent) return;

    const content = JSON.parse(savedContent);
    if (!content.pages) return;

    // Get current page path
    const path = window.location.pathname;
    const pageName = path.substring(path.lastIndexOf('/') + 1);

    // Update hero section based on page
    const heroTitle = document.querySelector('.hero h1');
    const heroDesc = document.querySelector('.hero p');

    if (heroTitle && heroDesc) {
        // Check both with and without .html extension
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

// Run page-specific initializations based on current path
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

// Utility function to get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Lightweight PJAX for smooth page transitions
function initPjax() {
    if (!window.history || !window.fetch || !window.DOMParser) return;

    let isNavigating = false;

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

    async function navigateTo(url, pushState = true) {
        if (isNavigating) return;
        isNavigating = true;

        const main = document.querySelector('main');
        if (main) {
            main.classList.add('pjax-fade-out');
        }

        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: { 'X-PJAX': 'true' }
            });
            if (!response.ok) throw new Error('Fetch failed');
            const html = await response.text();
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(html, 'text/html');

            // Wait for fade-out
            await new Promise(r => setTimeout(r, 120));

            // Update head meta
            document.title = newDoc.title;
            updateMeta(newDoc);

            // Replace main content
            const newMain = newDoc.querySelector('main');
            if (main && newMain) {
                main.innerHTML = newMain.innerHTML;
                main.classList.remove('pjax-fade-out');
                main.classList.add('pjax-fade-in');
                requestAnimationFrame(() => {
                    setTimeout(() => main.classList.remove('pjax-fade-in'), 250);
                });
            } else {
                window.location.href = url;
                return;
            }

            // Load new external scripts then execute inline scripts
            await loadNewScripts(newDoc);

            if (pushState) {
                window.history.pushState({ url }, '', url);
            }

            window.scrollTo(0, 0);

            // Re-initialize
            await runPageSpecificScripts();
            translatePage();
            initSmoothScroll();
            initPagePrefetch();
            window.dispatchEvent(new Event('pjax:complete'));

        } catch (err) {
            window.location.href = url;
        } finally {
            isNavigating = false;
        }
    }

    function updateMeta(newDoc) {
        const names = ['description', 'keywords'];
        names.forEach(name => {
            const oldMeta = document.querySelector(`meta[name="${name}"]`);
            const newMeta = newDoc.querySelector(`meta[name="${name}"]`);
            if (oldMeta && newMeta) {
                oldMeta.content = newMeta.content;
            } else if (newMeta && !oldMeta) {
                document.head.appendChild(newMeta.cloneNode(true));
            }
        });
    }

    async function loadNewScripts(newDoc) {
        const newScripts = Array.from(newDoc.body.querySelectorAll('script[src]'));
        const currentScripts = Array.from(document.body.querySelectorAll('script[src]'));
        const currentSrcs = new Set(currentScripts.map(s => s.getAttribute('src')));
        const scriptsToLoad = newScripts.filter(s => !currentSrcs.has(s.getAttribute('src')));

        for (const script of scriptsToLoad) {
            await loadScript(script.getAttribute('src'));
        }

        const main = document.querySelector('main');
        const newMain = newDoc.querySelector('main');
        if (main) {
            executeInlineScripts(main);
        }

        // Execute body-level inline scripts that are outside <main>
        const currentInlineContents = new Set(
            Array.from(document.body.querySelectorAll('script:not([src])')).map(s => s.textContent.trim())
        );
        const newInlineScripts = Array.from(newDoc.body.querySelectorAll('script:not([src])')).filter(s => {
            if (newMain && newMain.contains(s)) return false;
            return !currentInlineContents.has(s.textContent.trim());
        });
        for (const oldScript of newInlineScripts) {
            const newScript = document.createElement('script');
            if (oldScript.type) newScript.type = oldScript.type;
            newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
        }
    }

    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = resolve;
            s.onerror = resolve;
            document.body.appendChild(s);
        });
    }

    function executeInlineScripts(container) {
        const scripts = container.querySelectorAll('script:not([src])');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            if (oldScript.type) newScript.type = oldScript.type;
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    // Intercept clicks
    document.addEventListener('click', function(e) {
        const a = e.target.closest('a');
        if (!a) return;
        const url = a.getAttribute('href');
        if (!isInternalHtmlLink(url)) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) return;

        e.preventDefault();
        navigateTo(url);
    });

    // Handle back/forward
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.url) {
            navigateTo(e.state.url, false);
        }
    });
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

    // Prerender main navigation links immediately for near-instant switching
    document.querySelectorAll('header nav a[href]').forEach(a => {
        const url = a.getAttribute('href');
        if (isInternalHtmlLink(url)) {
            addPrerender(url);
        }
    });

    // Hover/touch prefetch for all internal links
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

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ============================================
// Global i18n System
// ============================================
let currentLanguage = localStorage.getItem('siteLanguage') || 'en';
let translations = {};
const TRANSLATION_CACHE = {};

function getCurrentPageKey() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    const pageName = filename.replace(/\.html$/, '') || 'index';

    const manifest = {
        'index': 'translations-index',
        'about': 'translations-about',
        'services': 'translations-services',
        'solutions': 'translations-solutions',
        'insights': 'translations-insights',
        'blog-detail': 'translations-blog-detail',
        'case-studies': 'translations-case-studies',
        'case-ecommerce': 'translations-case-ecommerce',
        'case-pharma': 'translations-case-pharma',
        'case-automotive': 'translations-case-automotive',
        'case-miniload': 'translations-case-miniload',
        'asrs-design': 'translations-asrs-design',
        'asrs-cost': 'translations-asrs-cost',
        'contact': 'translations-contact'
    };

    return manifest[pageName] || null;
}

async function loadTranslationFile(filename) {
    if (TRANSLATION_CACHE[filename]) {
        return TRANSLATION_CACHE[filename];
    }
    try {
        const res = await fetch(filename);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        TRANSLATION_CACHE[filename] = data;
        return data;
    } catch (e) {
        console.error('Failed to load ' + filename + ':', e);
        return null;
    }
}

async function loadTranslations() {
    try {
        const commonData = await loadTranslationFile('translations-common.json');
        if (!commonData) {
            console.error('Failed to load common translations');
            return;
        }

        translations = { ...commonData };

        const pageKey = getCurrentPageKey();
        if (pageKey) {
            const pageData = await loadTranslationFile(pageKey + '.json');
            if (pageData) {
                for (const lang of Object.keys(pageData)) {
                    if (translations[lang]) {
                        translations[lang] = { ...translations[lang], ...pageData[lang] };
                    } else {
                        translations[lang] = pageData[lang];
                    }
                }
            }
        }
    } catch (e) {
        console.error('Failed to load translations:', e);
        try {
            const res = await fetch('translations.json');
            translations = await res.json();
        } catch (fallbackErr) {
            console.error('Fallback also failed:', fallbackErr);
        }
    }
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => acc && acc[key], obj);
}

function translatePage() {
    const dict = translations[currentLanguage];
    if (!dict) return;

    // 1. 替换 data-i18n 的 textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const value = getNestedValue(dict, key);
        if (value !== undefined && el.textContent !== value) {
            el.textContent = value;
            el.classList.add('i18n-fade-in');
        }
    });

    // 2. 替换 data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const value = getNestedValue(dict, key);
        if (value !== undefined && el.placeholder !== value) {
            el.placeholder = value;
            el.classList.add('i18n-fade-in');
        }
    });

    // 3. 同步 html lang
    document.documentElement.lang = currentLanguage;

    // 4. admin 页面兼容：如果存在 translateAdminPage，调用它
    if (document.getElementById('adminDashboard') && typeof translateAdminPage === 'function') {
        translateAdminPage();
    }
}

// Global language switcher for header dropdown
function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('siteLanguage', lang);
    // Sync all selectors on the page
    document.querySelectorAll('#lang-select').forEach(function(el) {
        el.value = lang;
    });
    translatePage();
}

// Sync language selectors on page load
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
    // initPjax(); // disabled: causes layout issues on some pages

    await runPageSpecificScripts();
});
