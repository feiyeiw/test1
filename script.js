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
    apiKey: localStorage.getItem('adminApiKey') || '', // Admin API key
    cacheTimeout: 5 * 60 * 1000, // 5 minutes cache timeout
    retryAttempts: 2, // Number of retry attempts
    retryDelay: 1000, // Delay between retries in ms
};

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

            // Add API key if available and not already set
            if (API_CONFIG.apiKey && !headers['X-API-Key']) {
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
        return JSON.parse(cached);
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
    // Get all blogs - try from remote API first, then cache, then local JSON
    async getAllBlogs() {
        // First try cached data
        const cachedBlogs = getCachedBlogs();
        if (cachedBlogs) {
            console.log('Using cached blogs');
            return cachedBlogs;
        }

        // Try remote API
        try {
            console.log('Fetching blogs from remote API...');
            const blogs = await apiRequest('/blogs', { method: 'GET' });

            // Cache the result
            setCachedBlogs(blogs);

            // Also update legacy localStorage for backward compatibility
            localStorage.setItem('blogs', JSON.stringify(blogs));

            return blogs;
        } catch (apiError) {
            console.warn('Failed to fetch from API, trying local JSON:', apiError.message);

            // Fallback to local JSON file
            try {
                const response = await fetch('blogs.json');
                if (response.ok) {
                    const blogs = await response.json();

                    // Cache the result
                    setCachedBlogs(blogs);
                    localStorage.setItem('blogs', JSON.stringify(blogs));

                    return blogs;
                }
            } catch (jsonError) {
                console.warn('Failed to fetch blogs.json:', jsonError.message);
            }

            // Final fallback to localStorage (legacy)
            const legacyBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
            console.log('Using legacy localStorage blogs');
            return legacyBlogs;
        }
    },

    // Get single blog by ID - try from remote API first, then cache
    async getBlogById(id) {
        if (!id) return null;

        // First try to find in cached blogs
        const cachedBlogs = getCachedBlogs();
        if (cachedBlogs) {
            const blog = cachedBlogs.find(b => b.id == id);
            if (blog) return blog;
        }

        // Try remote API
        try {
            const blog = await apiRequest(`/blogs/${id}`, { method: 'GET' });
            return blog;
        } catch (apiError) {
            console.warn(`Failed to fetch blog ${id} from API:`, apiError.message);

            // Fallback to getAllBlogs
            try {
                const blogs = await this.getAllBlogs();
                return blogs.find(blog => blog.id == id) || null;
            } catch (error) {
                console.warn(`Error getting blog ${id}:`, error);
                const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
                return blogs.find(blog => blog.id == id) || null;
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

    // Set API key for admin operations
    setApiKey(apiKey) {
        API_CONFIG.apiKey = apiKey;
        localStorage.setItem('adminApiKey', apiKey);
        console.log('API key updated');
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
        if (window.location.pathname.includes('admin.html')) {
            alert('⚠️ Default admin credentials created.\nUsername: admin\nPassword: admin123\n\nPlease change the password in the admin panel.');
        }
    }
}

// Initialize default blog data - try to load from blogs.json, fallback to default
async function initializeDefaultBlogs() {
    const savedBlogs = localStorage.getItem('blogs');
    if (!savedBlogs) {
        try {
            // Try to load from blogs.json
            const response = await fetch('blogs.json');
            if (response.ok) {
                const blogs = await response.json();
                localStorage.setItem('blogs', JSON.stringify(blogs));
                console.log('Blog data loaded from blogs.json');
                return;
            }
        } catch (error) {
            console.warn('Failed to load blogs.json, using default data:', error);
        }

        // Fallback to default blogs
        const defaultBlogs = [
            {
                id: 1,
                title: 'Welcome to 1³ Machine Blog',
                content: '<h3>Welcome to Our New Blog Section</h3><p>We are excited to launch our new blog section where we will share insights about automated production, smart warehouse solutions, and industry trends.</p><p>Stay tuned for more updates!</p>',
                plainText: 'We are excited to launch our new blog section where we will share insights about automated production, smart warehouse solutions, and industry trends. Stay tuned for more updates!',
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: 'Benefits of Automated Production Lines',
                content: '<h3>Increasing Efficiency with Automation</h3><p>Automated production lines can significantly increase manufacturing efficiency by reducing manual labor, minimizing errors, and enabling 24/7 operation.</p><p>Key benefits include:</p><ul><li>Higher production output</li><li>Consistent product quality</li><li>Reduced labor costs</li><li>Improved workplace safety</li></ul>',
                plainText: 'Automated production lines can significantly increase manufacturing efficiency by reducing manual labor, minimizing errors, and enabling 24/7 operation. Key benefits include higher production output, consistent product quality, reduced labor costs, and improved workplace safety.',
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 3,
                title: 'Smart Warehouse Systems Overview',
                content: '<h3>Modern Warehouse Automation</h3><p>Smart warehouse systems utilize technologies like stacker cranes, shuttle systems, and AGVs to optimize storage and retrieval processes.</p><p>These systems help businesses:</p><ul><li>Maximize storage density</li><li>Reduce order fulfillment time</li><li>Improve inventory accuracy</li><li>Lower operational costs</li></ul>',
                plainText: 'Smart warehouse systems utilize technologies like stacker cranes, shuttle systems, and AGVs to optimize storage and retrieval processes. These systems help businesses maximize storage density, reduce order fulfillment time, improve inventory accuracy, and lower operational costs.',
                date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days ago
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem('blogs', JSON.stringify(defaultBlogs));
        console.log('Default blog data created with 3 sample blogs.');
    }
}

// Initialize default site content
function initializeDefaultSiteContent() {
    const savedContent = localStorage.getItem('siteContent');
    if (!savedContent) {
        const defaultSiteContent = {
            hero: {
                title: 'Automated Production & Smart Warehouse Solutions',
                description: 'We help manufacturers plan and implement automated production lines, packaging systems, and smart warehouse solutions using China-made equipment.'
            },
            services: [
                {
                    title: 'Production Line Planning',
                    description: 'Packaging, food, pharma, and chemical production lines'
                },
                {
                    title: 'Automated Warehouse Systems',
                    description: 'Stacker cranes, shuttle systems, and AGV logistics'
                },
                {
                    title: 'Multi-machine Integration',
                    description: 'Process matching and system coordination'
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
        localStorage.setItem('siteContent', JSON.stringify(defaultSiteContent));
        console.log('Default site content created.');
    }
}

// Initialize all default data
async function initializeAllData() {
    await initializeAdminCredentials();
    await initializeDefaultBlogs();
    initializeDefaultSiteContent();
}

// Admin login functionality
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    // Initialize credentials on login page load
    (async function() {
        await initializeAllData();
    })();

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const savedCredentials = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY));

        if (!savedCredentials) {
            errorMessage.textContent = 'System error: Admin credentials not found';
            return;
        }

        // Hash the entered password
        const enteredPasswordHash = await sha256Hash(password);

        if (username === savedCredentials.username && enteredPasswordHash === savedCredentials.passwordHash) {
            // Create session
            const session = {
                loggedIn: true,
                username: username,
                loginTime: new Date().toISOString(),
                sessionId: 'session_' + Date.now()
            };

            sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
            localStorage.setItem('adminLoggedIn', 'true'); // Legacy support

            // Redirect to admin dashboard
            window.location.href = 'admin.html';
        } else {
            errorMessage.textContent = 'Invalid username or password';
        }
    });
}

// Check if user is logged in for admin pages
async function checkAdminLogin() {
    // Initialize credentials first
    await initializeAdminCredentials();

    // Check session storage first (more secure)
    const session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY));
    const legacyLogin = localStorage.getItem('adminLoggedIn') === 'true';

    if (!session && !legacyLogin) {
        window.location.href = 'login.html';
        return false;
    }

    // Validate session if exists
    if (session) {
        // Check if session is not too old (24 hours)
        const loginTime = new Date(session.loginTime);
        const now = new Date();
        const hoursDiff = Math.abs(now - loginTime) / 36e5; // hours

        if (hoursDiff > 24) {
            // Session expired
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
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

// Admin dashboard functionality
if (document.getElementById('adminDashboard')) {
    (async function() {
        const isLoggedIn = await checkAdminLogin();
        if (!isLoggedIn) return;

        // Initialize default data if not exists
        await initializeAllData();

    // Load data from localStorage
    let siteContent = JSON.parse(localStorage.getItem('siteContent')) || {
        hero: {
            title: 'Automated Production & Smart Warehouse Solutions',
            description: 'We help manufacturers plan and implement automated production lines, packaging systems, and smart warehouse solutions using China-made equipment.'
        },
        services: [
            {
                title: 'Production Line Planning',
                description: 'Packaging, food, pharma, and chemical production lines'
            },
            {
                title: 'Automated Warehouse Systems',
                description: 'Stacker cranes, shuttle systems, and AGV logistics'
            },
            {
                title: 'Multi-machine Integration',
                description: 'Process matching and system coordination'
            }
        ],
        // Other pages content
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
    
    // Load content into form
    function loadContent() {
        // Home page content
        document.getElementById('heroTitle').value = siteContent.hero.title;
        document.getElementById('heroDescription').value = siteContent.hero.description;

        for (let i = 0; i < siteContent.services.length; i++) {
            document.getElementById(`service${i+1}Title`).value = siteContent.services[i].title;
            document.getElementById(`service${i+1}Description`).value = siteContent.services[i].description;
        }

        // Other pages content
        if (siteContent.pages) {
            document.getElementById('servicesTitle').value = siteContent.pages.services.title;
            document.getElementById('servicesDescription').value = siteContent.pages.services.description;
            document.getElementById('solutionsTitle').value = siteContent.pages.solutions.title;
            document.getElementById('solutionsDescription').value = siteContent.pages.solutions.description;
            document.getElementById('aboutTitle').value = siteContent.pages.about.title;
            document.getElementById('aboutDescription').value = siteContent.pages.about.description;
        }

    }
    
    // Save content
    document.getElementById('saveContent').addEventListener('click', function() {
        siteContent.hero.title = document.getElementById('heroTitle').value;
        siteContent.hero.description = document.getElementById('heroDescription').value;

        for (let i = 0; i < siteContent.services.length; i++) {
            siteContent.services[i].title = document.getElementById(`service${i+1}Title`).value;
            siteContent.services[i].description = document.getElementById(`service${i+1}Description`).value;
        }

        // Save other pages content
        if (siteContent.pages) {
            siteContent.pages.services.title = document.getElementById('servicesTitle').value;
            siteContent.pages.services.description = document.getElementById('servicesDescription').value;
            siteContent.pages.solutions.title = document.getElementById('solutionsTitle').value;
            siteContent.pages.solutions.description = document.getElementById('solutionsDescription').value;
            siteContent.pages.about.title = document.getElementById('aboutTitle').value;
            siteContent.pages.about.description = document.getElementById('aboutDescription').value;
        }

        // In a real system, this would save to a database
        localStorage.setItem('siteContent', JSON.stringify(siteContent));
        alert('Home page content saved successfully!');
    });
    
    // Load content on page load
    loadContent();

    // Password change functionality
    document.getElementById('changePassword').addEventListener('click', async function() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Please fill in all password fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long');
            return;
        }

        const savedCredentials = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY));
        if (!savedCredentials) {
            alert('System error: Admin credentials not found');
            return;
        }

        // Verify current password
        const currentPasswordHash = await sha256Hash(currentPassword);
        if (currentPasswordHash !== savedCredentials.passwordHash) {
            alert('Current password is incorrect');
            return;
        }

        // Update password
        const newPasswordHash = await sha256Hash(newPassword);
        savedCredentials.passwordHash = newPasswordHash;
        savedCredentials.updatedAt = new Date().toISOString();

        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(savedCredentials));

        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        alert('Password changed successfully!');
    });


    // Save pages content
    document.getElementById('savePages').addEventListener('click', function() {
        if (!siteContent.pages) {
            siteContent.pages = {
                services: { title: '', description: '' },
                solutions: { title: '', description: '' },
                about: { title: '', description: '' }
            };
        }

        siteContent.pages.services.title = document.getElementById('servicesTitle').value;
        siteContent.pages.services.description = document.getElementById('servicesDescription').value;
        siteContent.pages.solutions.title = document.getElementById('solutionsTitle').value;
        siteContent.pages.solutions.description = document.getElementById('solutionsDescription').value;
        siteContent.pages.about.title = document.getElementById('aboutTitle').value;
        siteContent.pages.about.description = document.getElementById('aboutDescription').value;

        localStorage.setItem('siteContent', JSON.stringify(siteContent));
        alert('Pages content saved successfully!');
    });

    // Rich Text Editor Functions
    window.formatText = function(command) {
        const editor = document.getElementById('blogContent');
        if (!editor) return;

        document.execCommand(command, false, null);
        editor.focus();
    };

    // Handle link insertion
    window.insertLink = function() {
        const url = prompt('Enter URL:', 'https://');
        if (url) {
            document.execCommand('createLink', false, url);
        }
    };

    // Handle image insertion with file upload option
    window.insertImage = function() {
        // Create modal dialog for image insertion
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 20px; color: #333;">Insert Image</h3>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Option 1: Upload Image</label>
                    <input type="file" id="imageUpload" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <div style="margin-top: 10px; font-size: 12px; color: #666;">
                        Supported formats: JPG, PNG, GIF, WebP. Max size: 5MB. Images will be auto-compressed (max 1200x800) for optimal storage and faster loading.
                    </div>
                    <div id="imagePreview" style="margin-top: 15px; display: none;">
                        <img id="previewImage" style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;">
                        <div id="imageInfo" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
                    </div>
                    <button id="uploadAndInsert" style="margin-top: 15px; padding: 10px 20px; background-color: #0066cc; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; display: none;">
                        Compress & Insert
                    </button>
                </div>

            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">Option 2: Use Image URL</label>
                <input type="text" id="imageUrl" placeholder="https://example.com/image.jpg" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <button id="insertFromUrl" style="margin-top: 10px; padding: 10px 20px; background-color: #28a745; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    Insert from URL
                </button>
            </div>

            <div style="text-align: right; margin-top: 25px;">
                <button id="cancelInsert" style="padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        `;

        modal.appendChild(dialog);
        document.body.appendChild(modal);

        // Close modal when clicking outside or cancel
        modal.addEventListener('click', function(e) {
            if (e.target === modal || e.target.id === 'cancelInsert') {
                document.body.removeChild(modal);
            }
        });

        // Handle file upload preview
        const imageUpload = dialog.querySelector('#imageUpload');
        const imagePreview = dialog.querySelector('#imagePreview');
        const previewImage = dialog.querySelector('#previewImage');
        const uploadAndInsertBtn = dialog.querySelector('#uploadAndInsert');
        const imageInfo = dialog.querySelector('#imageInfo');

        imageUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert('Image size exceeds 5MB limit. Please choose a smaller image.');
                e.target.value = '';
                imagePreview.style.display = 'none';
                uploadAndInsertBtn.style.display = 'none';
                return;
            }

            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (JPG, PNG, GIF, or WebP).');
                e.target.value = '';
                imagePreview.style.display = 'none';
                uploadAndInsertBtn.style.display = 'none';
                return;
            }

            // Preview image and show file info
            const reader = new FileReader();
            reader.onload = function(event) {
                previewImage.src = event.target.result;
                imagePreview.style.display = 'block';
                uploadAndInsertBtn.style.display = 'block';

                // Show image info
                const sizeKB = (file.size / 1024).toFixed(1);
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                imageInfo.innerHTML = `<strong>Original:</strong> ${sizeKB >= 1024 ? sizeMB + ' MB' : sizeKB + ' KB'} | ${file.type} | Will be compressed to max 1200x800`;
            };
            reader.readAsDataURL(file);
        });

        // Handle upload and insert
        uploadAndInsertBtn.addEventListener('click', async function() {
            const file = imageUpload.files[0];
            if (!file) return;

            uploadAndInsertBtn.textContent = 'Processing...';
            uploadAndInsertBtn.disabled = true;

            try {
                // Compress and convert image to base64
                const compressedDataUrl = await compressAndConvertImage(file);

                // Insert into editor
                const editor = document.getElementById('blogContent');
                if (editor) {
                    document.execCommand('insertImage', false, compressedDataUrl);
                    editor.focus();
                }

                // Close modal
                document.body.removeChild(modal);
            } catch (error) {
                alert('Error processing image: ' + error.message);
                uploadAndInsertBtn.textContent = 'Upload & Insert';
                uploadAndInsertBtn.disabled = false;
            }
        });

        // Handle URL insertion
        const insertFromUrlBtn = dialog.querySelector('#insertFromUrl');
        const imageUrlInput = dialog.querySelector('#imageUrl');

        insertFromUrlBtn.addEventListener('click', function() {
            const url = imageUrlInput.value.trim();
            if (!url) {
                alert('Please enter an image URL');
                return;
            }

            // Basic URL validation
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                alert('Please enter a valid URL starting with http:// or https://');
                return;
            }

            // Insert into editor
            const editor = document.getElementById('blogContent');
            if (editor) {
                document.execCommand('insertImage', false, url);
                editor.focus();
            }

            // Close modal
            document.body.removeChild(modal);
        });

        // Helper function to convert file to base64
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }

        // Helper function to compress and convert image to base64
        async function compressAndConvertImage(file, maxWidth = 1200, maxHeight = 800, quality = 0.8) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        // Calculate new dimensions while maintaining aspect ratio
                        let width = img.width;
                        let height = img.height;

                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = width * ratio;
                            height = height * ratio;
                        }

                        // Create canvas and resize
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Convert to compressed data URL
                        const compressedDataUrl = canvas.toDataURL(file.type || 'image/jpeg', quality);
                        resolve(compressedDataUrl);
                    };
                    img.onerror = (error) => reject(error);
                };
                reader.onerror = (error) => reject(error);
            });
        }
    };

    // Update formatText to handle custom commands
    const originalFormatText = window.formatText;
    window.formatText = function(command) {
        if (command === 'link') {
            insertLink();
        } else if (command === 'image') {
            insertImage();
        } else if (command === 'heading') {
            document.execCommand('formatBlock', false, '<h3>');
        } else {
            originalFormatText(command);
        }
    };

    // API Management Functions
    async function initializeApiManagement() {
        // Load saved API key
        const savedApiKey = localStorage.getItem('adminApiKey');
        if (savedApiKey) {
            document.getElementById('apiKey').value = savedApiKey;
            blogApi.setApiKey(savedApiKey);
        }

        // Check API status
        await checkApiStatus();

        // Set up event listeners
        document.getElementById('testApi').addEventListener('click', testApiConnection);
        document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
        document.getElementById('syncBlogs').addEventListener('click', syncBlogsToRemote);
        document.getElementById('refreshBlogs').addEventListener('click', refreshBlogsFromRemote);
    }

    async function checkApiStatus() {
        try {
            const apiStatusText = document.getElementById('apiStatusText');
            const apiStatusDiv = document.getElementById('apiStatus');

            apiStatusText.textContent = '检查中...';
            apiStatusDiv.style.backgroundColor = '#fff3cd';
            apiStatusDiv.style.borderColor = '#ffeaa7';

            const isAvailable = await blogApi.checkApiStatus();

            if (isAvailable) {
                apiStatusText.textContent = '✅ 在线 - API连接正常';
                apiStatusDiv.style.backgroundColor = '#d4edda';
                apiStatusDiv.style.borderColor = '#c3e6cb';
            } else {
                apiStatusText.textContent = '❌ 离线 - 无法连接到API';
                apiStatusDiv.style.backgroundColor = '#f8d7da';
                apiStatusDiv.style.borderColor = '#f5c6cb';
            }
        } catch (error) {
            console.error('Error checking API status:', error);
            document.getElementById('apiStatusText').textContent = '❌ 错误 - ' + error.message;
        }
    }

    async function testApiConnection() {
        const resultDiv = document.getElementById('apiResult');
        resultDiv.style.display = 'block';
        resultDiv.style.backgroundColor = '#fff3cd';
        resultDiv.style.borderColor = '#ffeaa7';
        resultDiv.style.color = '#856404';
        resultDiv.innerHTML = '<strong>测试中...</strong> 正在检查API连接...';

        try {
            const isAvailable = await blogApi.checkApiStatus();
            if (isAvailable) {
                resultDiv.style.backgroundColor = '#d4edda';
                resultDiv.style.borderColor = '#c3e6cb';
                resultDiv.style.color = '#155724';
                resultDiv.innerHTML = '<strong>✅ 连接成功!</strong> API服务正常运行。';
            } else {
                resultDiv.style.backgroundColor = '#f8d7da';
                resultDiv.style.borderColor = '#f5c6cb';
                resultDiv.style.color = '#721c24';
                resultDiv.innerHTML = '<strong>❌ 连接失败!</strong> 无法连接到API服务。请检查网络连接和API配置。';
            }
        } catch (error) {
            resultDiv.style.backgroundColor = '#f8d7da';
            resultDiv.style.borderColor = '#f5c6cb';
            resultDiv.style.color = '#721c24';
            resultDiv.innerHTML = `<strong>❌ 错误!</strong> ${error.message}`;
        }
    }

    function saveApiKey() {
        const apiKey = document.getElementById('apiKey').value.trim();

        if (!apiKey) {
            alert('请输入API密钥');
            return;
        }

        blogApi.setApiKey(apiKey);

        const resultDiv = document.getElementById('apiResult');
        resultDiv.style.display = 'block';
        resultDiv.style.backgroundColor = '#d4edda';
        resultDiv.style.borderColor = '#c3e6cb';
        resultDiv.style.color = '#155724';
        resultDiv.innerHTML = '<strong>✅ API密钥已保存!</strong> 管理操作现在将使用此密钥进行远程同步。';

        // Recheck API status
        setTimeout(() => checkApiStatus(), 1000);
    }

    async function syncBlogsToRemote() {
        const resultDiv = document.getElementById('apiResult');
        resultDiv.style.display = 'block';
        resultDiv.style.backgroundColor = '#fff3cd';
        resultDiv.style.borderColor = '#ffeaa7';
        resultDiv.style.color = '#856404';
        resultDiv.innerHTML = '<strong>同步中...</strong> 正在将本地博客同步到远程服务器...';

        try {
            const syncedBlogs = await blogApi.syncWithRemote();

            resultDiv.style.backgroundColor = '#d4edda';
            resultDiv.style.borderColor = '#c3e6cb';
            resultDiv.style.color = '#155724';
            resultDiv.innerHTML = `<strong>✅ 同步完成!</strong> 成功同步 ${syncedBlogs.length} 篇博客到远程服务器。`;

            // Refresh blog list
            await loadBlogs();
        } catch (error) {
            resultDiv.style.backgroundColor = '#f8d7da';
            resultDiv.style.borderColor = '#f5c6cb';
            resultDiv.style.color = '#721c24';
            resultDiv.innerHTML = `<strong>❌ 同步失败!</strong> ${error.message}`;
        }
    }

    async function refreshBlogsFromRemote() {
        const resultDiv = document.getElementById('apiResult');
        resultDiv.style.display = 'block';
        resultDiv.style.backgroundColor = '#fff3cd';
        resultDiv.style.borderColor = '#ffeaa7';
        resultDiv.style.color = '#856404';
        resultDiv.innerHTML = '<strong>刷新中...</strong> 正在从远程服务器获取最新博客...';

        try {
            // Clear cache to force fresh fetch
            localStorage.removeItem(CACHE_KEYS.BLOGS);
            localStorage.removeItem(CACHE_KEYS.BLOGS_TIMESTAMP);

            const blogs = await blogApi.getAllBlogs();

            resultDiv.style.backgroundColor = '#d4edda';
            resultDiv.style.borderColor = '#c3e6cb';
            resultDiv.style.color = '#155724';
            resultDiv.innerHTML = `<strong>✅ 刷新完成!</strong> 成功加载 ${blogs.length} 篇博客。`;

            // Refresh blog list
            await loadBlogs();
        } catch (error) {
            resultDiv.style.backgroundColor = '#f8d7da';
            resultDiv.style.borderColor = '#f5c6cb';
            resultDiv.style.color = '#721c24';
            resultDiv.innerHTML = `<strong>❌ 刷新失败!</strong> ${error.message}`;
        }
    }

    // Initialize API management
    initializeApiManagement();

    // Blog management

    // Load blogs from API/localStorage
    async function loadBlogs() {
        const blogsContainer = document.getElementById('blogsContainer');
        blogsContainer.innerHTML = '<p style="color: #666; text-align: center;">Loading blogs...</p>';

        try {
            const blogs = await blogApi.getAllBlogs();

            blogsContainer.innerHTML = '';

            if (blogs.length === 0) {
                blogsContainer.innerHTML = '<p>No blogs yet. Add your first blog!</p>';
                return;
            }

            blogs.forEach((blog) => {
                const blogItem = document.createElement('div');
                blogItem.style.padding = '15px';
                blogItem.style.border = '1px solid #e0e0e0';
                blogItem.style.borderRadius = '4px';
                blogItem.style.marginBottom = '10px';
                blogItem.style.backgroundColor = '#f8f8f8';

                // Create plain text preview by stripping HTML tags
                const previewText = blog.plainText ||
                    blog.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

                blogItem.innerHTML = `
                    <h4>${blog.title}</h4>
                    <p style="font-size: 14px; color: #666;">${blog.date}</p>
                    <div style="margin: 10px 0; color: #666; line-height: 1.4;">
                        ${previewText.substring(0, 100)}${previewText.length > 100 ? '...' : ''}
                    </div>
                    <button onclick="editBlog('${blog.id}')" style="margin-right: 10px; padding: 5px 10px; background-color: #e60000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                    <button onclick="deleteBlog('${blog.id}')" style="padding: 5px 10px; background-color: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                `;

                blogsContainer.appendChild(blogItem);
            });
        } catch (error) {
            console.error('Error loading blogs:', error);
            blogsContainer.innerHTML = '<p style="color: #e60000;">Error loading blogs. Please try again.</p>';
        }
    }

    // Add blog
    document.getElementById('addBlog').addEventListener('click', async function() {
        const title = document.getElementById('blogTitle').value;
        const editorContent = document.getElementById('blogContent');
        const content = editorContent ? editorContent.innerHTML : '';
        const date = document.getElementById('blogDate').value || new Date().toISOString().split('T')[0];

        if (!title || !content.trim()) {
            alert('Please fill in all fields');
            return;
        }

        const newBlog = {
            title: title,
            content: content,
            plainText: editorContent ? editorContent.textContent : '',
            date: date
        };

        try {
            await blogApi.createBlog(newBlog);

            // Clear form
            document.getElementById('blogTitle').value = '';
            if (editorContent) editorContent.innerHTML = '';
            document.getElementById('blogDate').value = '';

            await loadBlogs();
            alert('Blog added successfully!');
        } catch (error) {
            console.error('Error adding blog:', error);
            alert(`Error adding blog: ${error.message}`);
        }
    });

    // Edit blog
    window.editBlog = async function(id) {
        try {
            const blog = await blogApi.getBlogById(id);
            if (!blog) {
                alert('Blog not found');
                return;
            }

            document.getElementById('blogTitle').value = blog.title;
            const editorContent = document.getElementById('blogContent');
            if (editorContent) editorContent.innerHTML = blog.content;
            document.getElementById('blogDate').value = blog.date;

            // Delete the blog after loading into form
            try {
                await blogApi.deleteBlog(id);
                await loadBlogs();
            } catch (error) {
                console.error('Error deleting blog for edit:', error);
                alert('Error loading blog for editing');
            }
        } catch (error) {
            console.error('Error fetching blog for edit:', error);
            alert('Error loading blog for editing');
        }
    };

    // Delete blog
    window.deleteBlog = async function(id) {
        if (!confirm('Are you sure you want to delete this blog?')) {
            return;
        }

        try {
            await blogApi.deleteBlog(id);
            await loadBlogs();
            alert('Blog deleted successfully!');
        } catch (error) {
            console.error('Error deleting blog:', error);
            alert(`Error deleting blog: ${error.message}`);
        }
    };

    // Export blogs to JSON file
    const exportBlogsBtn = document.getElementById('exportBlogs');
    if (exportBlogsBtn) {
        exportBlogsBtn.addEventListener('click', async function() {
            try {
                await blogApi.exportBlogs();
                alert('Blogs exported successfully! Download the blogs.json file and replace the existing one in your project directory.');
            } catch (error) {
                console.error('Error exporting blogs:', error);
                alert(`Error exporting blogs: ${error.message}`);
            }
        });
    }

    // Import blogs from JSON file
    const importBlogsBtn = document.getElementById('importBlogs');
    const importFileInput = document.getElementById('importFile');
    if (importBlogsBtn && importFileInput) {
        importBlogsBtn.addEventListener('click', function() {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.endsWith('.json')) {
                alert('Please select a JSON file');
                return;
            }

            try {
                await blogApi.importBlogs(file);
                await loadBlogs();
                alert('Blogs imported successfully!');
                // Clear file input
                e.target.value = '';
            } catch (error) {
                console.error('Error importing blogs:', error);
                alert(`Error importing blogs: ${error.message}`);
            }
        });
    }

    // Load blogs on page load
    loadBlogs();
    })(); // End of async IIFE
}

// Update main page with admin content
async function updateMainPage() {
    // Initialize default data if not exists
    await initializeAllData();

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
    
    // Load blogs on home page
    loadBlogsOnHome();
}

// Load blogs on home page
async function loadBlogsOnHome() {
    const blogsSection = document.getElementById('blogsSection');
    if (!blogsSection) return;

    try {
        const blogs = await blogApi.getAllBlogs();

        if (blogs.length === 0) {
            blogsSection.innerHTML = '<div class="service-item"><h3>No blogs yet</h3><p>Check back soon for our latest insights and updates.</p></div>';
            return;
        }

        // Sort blogs by date (newest first)
        const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Show only the latest 3 blogs
        const latestBlogs = sortedBlogs.slice(0, 3);

        blogsSection.innerHTML = '';

        latestBlogs.forEach(blog => {
            const blogLink = document.createElement('a');
            blogLink.href = `blog-detail.html?id=${blog.id}`;
            blogLink.className = 'service-item blog-link';

            // Create plain text preview by stripping HTML tags
            const previewText = blog.plainText ||
                blog.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

            blogLink.innerHTML = `
                <h3>${blog.title}</h3>
                <p style="font-size: 14px; color: #666; margin-bottom: 10px;">${blog.date}</p>
                <p style="line-height: 1.6;">${previewText.substring(0, 150)}${previewText.length > 150 ? '...' : ''}</p>
                <div style="margin-top: 15px; color: #e60000; font-weight: bold; font-size: 14px;">Read More &rarr;</div>
            `;

            blogsSection.appendChild(blogLink);
        });
    } catch (error) {
        console.error('Error loading blogs for home page:', error);
        blogsSection.innerHTML = '<div class="service-item"><h3>Error loading blogs</h3><p>Please try again later.</p></div>';
    }
}

// Update page content for all pages
async function updatePageContent() {
    // Initialize default data if not exists
    await initializeAllData();

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
        if (pageName === 'services.html' && content.pages.services) {
            heroTitle.textContent = content.pages.services.title;
            heroDesc.textContent = content.pages.services.description;
        } else if (pageName === 'solutions.html' && content.pages.solutions) {
            heroTitle.textContent = content.pages.solutions.title;
            heroDesc.textContent = content.pages.solutions.description;
        } else if (pageName === 'about.html' && content.pages.about) {
            heroTitle.textContent = content.pages.about.title;
            heroDesc.textContent = content.pages.about.description;
        }
    }
}

// Update main page if on index.html
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    (async function() {
        await updateMainPage();
    })();
}

// Update other pages content
if (window.location.pathname.includes('services.html') ||
    window.location.pathname.includes('solutions.html') ||
    window.location.pathname.includes('about.html')) {
    (async function() {
        await updatePageContent();
    })();
}

// Contact form functionality
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // In a real system, this would send the form data to a server
        alert('Thank you for your message! We will get back to you soon.');
        contactForm.reset();
    });
}

// Utility function to get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Load blog detail page
async function loadBlogDetail() {
    const blogId = getUrlParameter('id');
    if (!blogId) {
        // No blog ID specified, show error or redirect
        document.getElementById('blogTitle').textContent = 'Blog Not Found';
        document.getElementById('blogContent').innerHTML = '<p>The blog you are looking for does not exist or has been removed.</p>';
        return;
    }

    try {
        const blog = await blogApi.getBlogById(blogId);

        if (!blog) {
            document.getElementById('blogTitle').textContent = 'Blog Not Found';
            document.getElementById('blogContent').innerHTML = '<p>The blog you are looking for does not exist or has been removed.</p>';
            return;
        }

        // Set blog data
        document.getElementById('blogTitle').textContent = blog.title;
        document.getElementById('blogDate').textContent = blog.date;
        document.getElementById('blogContent').innerHTML = blog.content;

        // Setup blog navigation (previous/next)
        await setupBlogNavigation(blog);

        // Load related blogs
        await loadRelatedBlogs(blog);
    } catch (error) {
        console.error('Error loading blog detail:', error);
        document.getElementById('blogTitle').textContent = 'Error Loading Blog';
        document.getElementById('blogContent').innerHTML = '<p>An error occurred while loading the blog. Please try again later.</p>';
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

        // Previous blog (newer blog if sorted newest first)
        if (currentIndex > 0) {
            const prevBlog = sortedBlogs[currentIndex - 1];
            prevBlogLink.href = `blog-detail.html?id=${prevBlog.id}`;
            prevBlogLink.textContent = `<- Newer: ${prevBlog.title.substring(0, 30)}${prevBlog.title.length > 30 ? '...' : ''}`;
            prevBlogLink.classList.remove('disabled');
        } else {
            prevBlogLink.href = '#';
            prevBlogLink.textContent = '<- No newer posts';
            prevBlogLink.classList.add('disabled');
        }

        // Next blog (older blog if sorted newest first)
        if (currentIndex < sortedBlogs.length - 1) {
            const nextBlog = sortedBlogs[currentIndex + 1];
            nextBlogLink.href = `blog-detail.html?id=${nextBlog.id}`;
            nextBlogLink.textContent = `Older: ${nextBlog.title.substring(0, 30)}${nextBlog.title.length > 30 ? '...' : ''} ->`;
            nextBlogLink.classList.remove('disabled');
        } else {
            nextBlogLink.href = '#';
            nextBlogLink.textContent = 'No older posts ->';
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

        if (relatedBlogs.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">No other blogs available.</p>';
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
                <a href="blog-detail.html?id=${blog.id}" class="related-blog-link">Read More &rarr;</a>
            `;

            container.appendChild(blogItem);
        });
    } catch (error) {
        console.error('Error loading related blogs:', error);
        container.innerHTML = '<p style="color: #666; text-align: center;">Error loading related blogs.</p>';
    }
}

// Check if we're on the blog detail page
if (window.location.pathname.includes('blog-detail.html')) {
    (async function() {
        await loadBlogDetail();
    })();
}

// Language switching functionality for admin page
const TRANSLATIONS = {
    en: {
        // Header
        'home': 'Home',
        'english': 'English',
        'logout': 'Logout',

        // Admin Dashboard
        'adminDashboard': 'Admin Dashboard',
        'accountSettings': 'Account Settings',
        'currentPassword': 'Current Password',
        'newPassword': 'New Password',
        'confirmPassword': 'Confirm New Password',
        'changePassword': 'Change Password',
        'heroSection': 'Hero Section',
        'title': 'Title',
        'description': 'Description',
        'servicesSection': 'Services Section',
        'service1Title': 'Service 1 Title',
        'service1Description': 'Service 1 Description',
        'service2Title': 'Service 2 Title',
        'service2Description': 'Service 2 Description',
        'service3Title': 'Service 3 Title',
        'service3Description': 'Service 3 Description',
        'saveContent': 'Save Content',
        'otherPagesManagement': 'Other Pages Management',
        'servicesPage': 'Services Page',
        'pageTitle': 'Page Title',
        'pageDescription': 'Page Description',
        'solutionsPage': 'Solutions Page',
        'aboutPage': 'About Page',
        'savePagesContent': 'Save Pages Content',
        'blogManagement': 'Blog Management',
        'blogTitle': 'Blog Title',
        'date': 'Date',
        'blogContent': 'Blog Content (Rich Text Editor)',
        'addBlog': 'Add Blog',
        'blogList': 'Blog List',
        'exportBlogs': 'Export Blogs JSON',
        'importBlogs': 'Import Blogs JSON',

        // Editor buttons titles
        'bold': 'Bold',
        'italic': 'Italic',
        'underline': 'Underline',
        'heading': 'Heading',
        'bulletList': 'Bullet List',
        'numberedList': 'Numbered List',
        'insertLink': 'Insert Link',
        'insertImage': 'Insert Image'
    },
    zh: {
        // Header
        'home': '首页',
        'english': 'English',
        'logout': '退出登录',

        // Admin Dashboard
        'adminDashboard': '管理仪表板',
        'accountSettings': '账户设置',
        'currentPassword': '当前密码',
        'newPassword': '新密码',
        'confirmPassword': '确认新密码',
        'changePassword': '修改密码',
        'heroSection': '首页横幅区域',
        'title': '标题',
        'description': '描述',
        'servicesSection': '服务项目区域',
        'service1Title': '服务1标题',
        'service1Description': '服务1描述',
        'service2Title': '服务2标题',
        'service2Description': '服务2描述',
        'service3Title': '服务3标题',
        'service3Description': '服务3描述',
        'saveContent': '保存内容',
        'otherPagesManagement': '其他页面管理',
        'servicesPage': '服务页面',
        'pageTitle': '页面标题',
        'pageDescription': '页面描述',
        'solutionsPage': '解决方案页面',
        'aboutPage': '关于页面',
        'savePagesContent': '保存页面内容',
        'blogManagement': '博客管理',
        'blogTitle': '博客标题',
        'date': '日期',
        'blogContent': '博客内容 (富文本编辑器)',
        'addBlog': '添加博客',
        'blogList': '博客列表',
        'exportBlogs': '导出博客JSON',
        'importBlogs': '导入博客JSON',

        // Editor buttons titles
        'bold': '粗体',
        'italic': '斜体',
        'underline': '下划线',
        'heading': '标题',
        'bulletList': '项目符号列表',
        'numberedList': '编号列表',
        'insertLink': '插入链接',
        'insertImage': '插入图片'
    }
};

// Language management
const LANGUAGE_KEY = 'siteLanguage';
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || 'en';

// Function to update language text display
function updateLanguageDisplay() {
    const languageText = document.getElementById('languageText');
    if (languageText) {
        languageText.textContent = currentLanguage === 'en' ? 'English' : '中文';
    }
}

// Function to toggle language
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
    updateLanguageDisplay();
    translatePage();
}

// Function to translate the page
function translatePage() {
    // Only translate if we're on admin page
    if (!document.getElementById('adminDashboard')) {
        return;
    }

    const lang = TRANSLATIONS[currentLanguage];

    // Update all elements with data-i18n attribute (for text content)
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (lang[key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                // For input/textarea, update placeholder if exists, otherwise value
                if (element.hasAttribute('placeholder')) {
                    element.setAttribute('placeholder', lang[key]);
                } else {
                    element.value = lang[key];
                }
            } else {
                // For regular text elements
                element.textContent = lang[key];
            }
        }
    });

    // Update all elements with data-i18n-title attribute (for title attribute)
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (lang[key]) {
            element.setAttribute('title', lang[key]);
        }
    });

    // Update page title
    document.title = currentLanguage === 'en'
        ? 'Admin Dashboard - 1³ Machine'
        : '管理仪表板 - 1³ Machine';
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    updateLanguageDisplay();
    translatePage();
});