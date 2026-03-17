// SHA-256 Hash function using Web Crypto API
async function sha256Hash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Cloudflare KV API Service
const BLOG_API_CONFIG_KEY = 'blogApiConfig';

// Default API configuration (can be overridden via localStorage)
let blogApiConfig = {
    enabled: false,
    endpoint: '/api/blogs', // Relative to current domain
    apiKey: '',
    useLocalStorageFallback: true
};

// Load API configuration from localStorage
function loadBlogApiConfig() {
    const savedConfig = localStorage.getItem(BLOG_API_CONFIG_KEY);
    if (savedConfig) {
        blogApiConfig = { ...blogApiConfig, ...JSON.parse(savedConfig) };
    }
    return blogApiConfig;
}

// Save API configuration to localStorage
function saveBlogApiConfig(config) {
    blogApiConfig = { ...blogApiConfig, ...config };
    localStorage.setItem(BLOG_API_CONFIG_KEY, JSON.stringify(blogApiConfig));
}

// API Service functions
const blogApi = {
    // Get all blogs
    async getAllBlogs() {
        const config = loadBlogApiConfig();

        if (!config.enabled) {
            // Fallback to localStorage
            return JSON.parse(localStorage.getItem('blogs')) || [];
        }

        try {
            const response = await fetch(config.endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const blogs = await response.json();

            // Update localStorage cache for offline use
            if (config.useLocalStorageFallback) {
                localStorage.setItem('blogs', JSON.stringify(blogs));
            }

            return blogs;
        } catch (error) {
            console.warn('Failed to fetch blogs from API, falling back to localStorage:', error);

            if (config.useLocalStorageFallback) {
                return JSON.parse(localStorage.getItem('blogs')) || [];
            }

            return [];
        }
    },

    // Get single blog by ID
    async getBlogById(id) {
        const config = loadBlogApiConfig();

        if (!config.enabled) {
            // Fallback to localStorage
            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            return blogs.find(blog => blog.id == id) || null;
        }

        try {
            const response = await fetch(`${config.endpoint}/${id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.warn(`Failed to fetch blog ${id} from API:`, error);

            if (config.useLocalStorageFallback) {
                const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
                return blogs.find(blog => blog.id == id) || null;
            }

            return null;
        }
    },

    // Create new blog (requires authentication)
    async createBlog(blogData) {
        const config = loadBlogApiConfig();

        if (!config.enabled) {
            // Fallback to localStorage
            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const newBlog = {
                id: Date.now(),
                title: blogData.title,
                content: blogData.content,
                plainText: blogData.plainText || blogData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
                date: blogData.date || new Date().toISOString().split('T')[0]
            };

            blogs.push(newBlog);
            localStorage.setItem('blogs', JSON.stringify(blogs));
            return newBlog;
        }

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Add API key if configured
            if (config.apiKey) {
                headers['X-API-Key'] = config.apiKey;
            }

            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(blogData)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized: Invalid API key');
                }
                throw new Error(`API error: ${response.status}`);
            }

            const newBlog = await response.json();

            // Update localStorage cache
            if (config.useLocalStorageFallback) {
                const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
                blogs.push(newBlog);
                localStorage.setItem('blogs', JSON.stringify(blogs));
            }

            return newBlog;
        } catch (error) {
            console.warn('Failed to create blog via API, falling back to localStorage:', error);

            if (config.useLocalStorageFallback) {
                return this.createBlog(blogData); // This will use localStorage fallback
            }

            throw error;
        }
    },

    // Update existing blog (requires authentication)
    async updateBlog(id, blogData) {
        const config = loadBlogApiConfig();

        if (!config.enabled) {
            // Fallback to localStorage
            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const index = blogs.findIndex(blog => blog.id == id);

            if (index === -1) {
                throw new Error('Blog not found');
            }

            blogs[index] = {
                ...blogs[index],
                ...blogData,
                id: id // Ensure ID doesn't change
            };

            localStorage.setItem('blogs', JSON.stringify(blogs));
            return blogs[index];
        }

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Add API key if configured
            if (config.apiKey) {
                headers['X-API-Key'] = config.apiKey;
            }

            const response = await fetch(`${config.endpoint}/${id}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(blogData)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized: Invalid API key');
                }
                if (response.status === 404) {
                    throw new Error('Blog not found');
                }
                throw new Error(`API error: ${response.status}`);
            }

            const updatedBlog = await response.json();

            // Update localStorage cache
            if (config.useLocalStorageFallback) {
                const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
                const index = blogs.findIndex(blog => blog.id == id);
                if (index !== -1) {
                    blogs[index] = updatedBlog;
                    localStorage.setItem('blogs', JSON.stringify(blogs));
                }
            }

            return updatedBlog;
        } catch (error) {
            console.warn(`Failed to update blog ${id} via API, falling back to localStorage:`, error);

            if (config.useLocalStorageFallback) {
                return this.updateBlog(id, blogData); // This will use localStorage fallback
            }

            throw error;
        }
    },

    // Delete blog (requires authentication)
    async deleteBlog(id) {
        const config = loadBlogApiConfig();

        if (!config.enabled) {
            // Fallback to localStorage
            const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
            const index = blogs.findIndex(blog => blog.id == id);

            if (index === -1) {
                throw new Error('Blog not found');
            }

            blogs.splice(index, 1);
            localStorage.setItem('blogs', JSON.stringify(blogs));
            return true;
        }

        try {
            const headers = {
                'Accept': 'application/json'
            };

            // Add API key if configured
            if (config.apiKey) {
                headers['X-API-Key'] = config.apiKey;
            }

            const response = await fetch(`${config.endpoint}/${id}`, {
                method: 'DELETE',
                headers: headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized: Invalid API key');
                }
                if (response.status === 404) {
                    throw new Error('Blog not found');
                }
                throw new Error(`API error: ${response.status}`);
            }

            // Update localStorage cache
            if (config.useLocalStorageFallback) {
                const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
                const index = blogs.findIndex(blog => blog.id == id);
                if (index !== -1) {
                    blogs.splice(index, 1);
                    localStorage.setItem('blogs', JSON.stringify(blogs));
                }
            }

            return true;
        } catch (error) {
            console.warn(`Failed to delete blog ${id} via API, falling back to localStorage:`, error);

            if (config.useLocalStorageFallback) {
                return this.deleteBlog(id); // This will use localStorage fallback
            }

            throw error;
        }
    },

    // Test API connection
    async testConnection() {
        const config = loadBlogApiConfig();

        if (!config.enabled) {
            return { success: true, message: 'API disabled, using localStorage' };
        }

        try {
            const response = await fetch(config.endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                return {
                    success: false,
                    message: `API returned ${response.status}`
                };
            }

            return {
                success: true,
                message: 'API connection successful'
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`
            };
        }
    }
};

// Initialize API config on load
loadBlogApiConfig();

// Admin credentials management
const ADMIN_STORAGE_KEY = 'adminCredentials';
const ADMIN_SESSION_KEY = 'adminSession';

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

// Initialize default blog data
function initializeDefaultBlogs() {
    const savedBlogs = localStorage.getItem('blogs');
    if (!savedBlogs) {
        const defaultBlogs = [
            {
                id: 1,
                title: 'Welcome to 1³ Machine Blog',
                content: '<h3>Welcome to Our New Blog Section</h3><p>We are excited to launch our new blog section where we will share insights about automated production, smart warehouse solutions, and industry trends.</p><p>Stay tuned for more updates!</p>',
                plainText: 'We are excited to launch our new blog section where we will share insights about automated production, smart warehouse solutions, and industry trends. Stay tuned for more updates!',
                date: new Date().toISOString().split('T')[0]
            },
            {
                id: 2,
                title: 'Benefits of Automated Production Lines',
                content: '<h3>Increasing Efficiency with Automation</h3><p>Automated production lines can significantly increase manufacturing efficiency by reducing manual labor, minimizing errors, and enabling 24/7 operation.</p><p>Key benefits include:</p><ul><li>Higher production output</li><li>Consistent product quality</li><li>Reduced labor costs</li><li>Improved workplace safety</li></ul>',
                plainText: 'Automated production lines can significantly increase manufacturing efficiency by reducing manual labor, minimizing errors, and enabling 24/7 operation. Key benefits include higher production output, consistent product quality, reduced labor costs, and improved workplace safety.',
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days ago
            },
            {
                id: 3,
                title: 'Smart Warehouse Systems Overview',
                content: '<h3>Modern Warehouse Automation</h3><p>Smart warehouse systems utilize technologies like stacker cranes, shuttle systems, and AGVs to optimize storage and retrieval processes.</p><p>These systems help businesses:</p><ul><li>Maximize storage density</li><li>Reduce order fulfillment time</li><li>Improve inventory accuracy</li><li>Lower operational costs</li></ul>',
                plainText: 'Smart warehouse systems utilize technologies like stacker cranes, shuttle systems, and AGVs to optimize storage and retrieval processes. These systems help businesses maximize storage density, reduce order fulfillment time, improve inventory accuracy, and lower operational costs.',
                date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 14 days ago
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
    initializeDefaultBlogs();
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

    // Handle image insertion (simplified)
    window.insertImage = function() {
        const url = prompt('Enter image URL:', 'https://');
        if (url) {
            document.execCommand('insertImage', false, url);
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
                <div style="margin-top: 15px; color: #e60000; font-weight: bold; font-size: 14px;">Read More →</div>
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
            prevBlogLink.textContent = `← Newer: ${prevBlog.title.substring(0, 30)}${prevBlog.title.length > 30 ? '...' : ''}`;
            prevBlogLink.classList.remove('disabled');
        } else {
            prevBlogLink.href = '#';
            prevBlogLink.textContent = '← No newer posts';
            prevBlogLink.classList.add('disabled');
        }

        // Next blog (older blog if sorted newest first)
        if (currentIndex < sortedBlogs.length - 1) {
            const nextBlog = sortedBlogs[currentIndex + 1];
            nextBlogLink.href = `blog-detail.html?id=${nextBlog.id}`;
            nextBlogLink.textContent = `Older: ${nextBlog.title.substring(0, 30)}${nextBlog.title.length > 30 ? '...' : ''} →`;
            nextBlogLink.classList.remove('disabled');
        } else {
            nextBlogLink.href = '#';
            nextBlogLink.textContent = 'No older posts →';
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
                <a href="blog-detail.html?id=${blog.id}" class="related-blog-link">Read More →</a>
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

        // Editor buttons titles
        'bold': 'Bold',
        'italic': 'Italic',
        'underline': 'Underline',
        'heading': 'Heading',
        'bulletList': 'Bullet List',
        'numberedList': 'Numbered List',
        'insertLink': 'Insert Link',
        'insertImage': 'Insert Image',

        // API Configuration
        'apiConfig': 'API Configuration',
        'enableCloudflareAPI': 'Enable Cloudflare KV API',
        'apiConfigDescription': 'Enable to store blogs in Cloudflare KV for cross-device access. Disable to use browser localStorage only.',
        'apiEndpoint': 'API Endpoint',
        'apiEndpointDescription': 'Relative path to your API endpoint. Usually "/api/blogs" if deployed on same domain.',
        'apiKey': 'API Key',
        'apiKeyDescription': 'Secure API key from Cloudflare Pages environment variables.',
        'useLocalStorageFallback': 'Use localStorage fallback',
        'fallbackDescription': 'When enabled, blogs will be cached in localStorage for offline access and faster loading.',
        'apiStatus': 'API Status',
        'loadingStatus': 'Loading status...',
        'testConnection': 'Test Connection',
        'saveApiConfig': 'Save API Configuration',
        'dataMigration': 'Data Migration',
        'migrationDescription': 'You have blogs stored in localStorage. Would you like to migrate them to Cloudflare KV?',
        'migrateToKV': 'Migrate to Cloudflare KV'
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

        // Editor buttons titles
        'bold': '粗体',
        'italic': '斜体',
        'underline': '下划线',
        'heading': '标题',
        'bulletList': '项目符号列表',
        'numberedList': '编号列表',
        'insertLink': '插入链接',
        'insertImage': '插入图片',

        // API Configuration
        'apiConfig': 'API 配置',
        'enableCloudflareAPI': '启用 Cloudflare KV API',
        'apiConfigDescription': '启用后将博客存储在 Cloudflare KV 中实现跨设备访问。禁用则仅使用浏览器本地存储。',
        'apiEndpoint': 'API 端点',
        'apiEndpointDescription': 'API 端点的相对路径。如果部署在同一域名下，通常为 "/api/blogs"。',
        'apiKey': 'API 密钥',
        'apiKeyDescription': '来自 Cloudflare Pages 环境变量的安全 API 密钥。',
        'useLocalStorageFallback': '使用 localStorage 回退',
        'fallbackDescription': '启用后，博客将缓存在 localStorage 中以供离线访问和更快加载。',
        'apiStatus': 'API 状态',
        'loadingStatus': '正在加载状态...',
        'testConnection': '测试连接',
        'saveApiConfig': '保存 API 配置',
        'dataMigration': '数据迁移',
        'migrationDescription': '您在 localStorage 中存储了博客。是否要迁移到 Cloudflare KV？',
        'migrateToKV': '迁移到 Cloudflare KV'
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

// ===========================================
// API Configuration Management
// ===========================================

// Load API configuration into UI
function loadApiConfigUI() {
    const config = loadBlogApiConfig();

    // Update checkbox
    const apiEnabledCheckbox = document.getElementById('apiEnabled');
    if (apiEnabledCheckbox) {
        apiEnabledCheckbox.checked = config.enabled;

        // Show/hide configuration details
        const apiConfigDetails = document.getElementById('apiConfigDetails');
        if (apiConfigDetails) {
            apiConfigDetails.style.display = config.enabled ? 'block' : 'none';
        }
    }

    // Update form fields
    const apiEndpointInput = document.getElementById('apiEndpoint');
    if (apiEndpointInput) {
        apiEndpointInput.value = config.endpoint || '/api/blogs';
    }

    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
        apiKeyInput.value = config.apiKey || '';
    }

    const fallbackCheckbox = document.getElementById('useLocalStorageFallback');
    if (fallbackCheckbox) {
        fallbackCheckbox.checked = config.useLocalStorageFallback !== false; // Default to true
    }

    // Update API status
    updateApiStatus();

    // Show/hide migration section if there are local blogs and API is disabled
    const localBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
    const migrationSection = document.getElementById('migrationSection');
    if (migrationSection && localBlogs.length > 0 && !config.enabled) {
        migrationSection.style.display = 'block';
    } else if (migrationSection) {
        migrationSection.style.display = 'none';
    }
}

// Update API connection status
async function updateApiStatus() {
    const statusElement = document.getElementById('apiStatus');
    if (!statusElement) return;

    const config = loadBlogApiConfig();

    if (!config.enabled) {
        statusElement.innerHTML = '<span style="color: #666;">' + (currentLanguage === 'en' ? 'API is disabled' : 'API 已禁用') + '</span>';
        return;
    }

    statusElement.innerHTML = '<span style="color: #0088cc;">' + (currentLanguage === 'en' ? 'Testing connection...' : '正在测试连接...') + '</span>';

    try {
        const response = await fetch(config.endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            statusElement.innerHTML = '<span style="color: #28a745;">' + (currentLanguage === 'en' ? '✓ API connected successfully' : '✓ API 连接成功') + '</span>';
        } else {
            statusElement.innerHTML = '<span style="color: #e60000;">' + (currentLanguage === 'en' ? '✗ API error: ' + response.status : '✗ API 错误: ' + response.status) + '</span>';
        }
    } catch (error) {
        statusElement.innerHTML = '<span style="color: #e60000;">' + (currentLanguage === 'en' ? '✗ Connection failed: ' + error.message : '✗ 连接失败: ' + error.message) + '</span>';
    }
}

// Save API configuration
function saveApiConfig() {
    const config = {
        enabled: document.getElementById('apiEnabled').checked,
        endpoint: document.getElementById('apiEndpoint').value.trim() || '/api/blogs',
        apiKey: document.getElementById('apiKey').value.trim(),
        useLocalStorageFallback: document.getElementById('useLocalStorageFallback').checked
    };

    // Validate endpoint
    if (!config.endpoint.startsWith('/')) {
        config.endpoint = '/' + config.endpoint;
    }

    saveBlogApiConfig(config);

    // Update UI
    loadApiConfigUI();

    alert(currentLanguage === 'en'
        ? 'API configuration saved successfully!'
        : 'API 配置保存成功！');
}

// Test API connection
async function testApiConnection() {
    const config = loadBlogApiConfig();

    if (!config.enabled) {
        alert(currentLanguage === 'en'
            ? 'Please enable API first'
            : '请先启用 API');
        return;
    }

    if (!config.apiKey) {
        alert(currentLanguage === 'en'
            ? 'Please enter your API key first'
            : '请先输入您的 API 密钥');
        return;
    }

    const testBtn = document.getElementById('testApiConnection');
    const originalText = testBtn.textContent;
    testBtn.textContent = currentLanguage === 'en' ? 'Testing...' : '测试中...';
    testBtn.disabled = true;

    try {
        // Test with a simple GET request
        const response = await fetch(config.endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            alert(currentLanguage === 'en'
                ? '✓ API connection successful!'
                : '✓ API 连接成功！');
        } else {
            alert(currentLanguage === 'en'
                ? '✗ API error: ' + response.status + ' ' + response.statusText
                : '✗ API 错误: ' + response.status + ' ' + response.statusText);
        }
    } catch (error) {
        alert(currentLanguage === 'en'
            ? '✗ Connection failed: ' + error.message
            : '✗ 连接失败: ' + error.message);
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
        updateApiStatus();
    }
}

// Migrate local blogs to Cloudflare KV
async function migrateToKV() {
    const config = loadBlogApiConfig();

    if (!config.enabled) {
        alert(currentLanguage === 'en'
            ? 'Please enable API first before migrating'
            : '迁移前请先启用 API');
        return;
    }

    if (!config.apiKey) {
        alert(currentLanguage === 'en'
            ? 'Please enter your API key first'
            : '请先输入您的 API 密钥');
        return;
    }

    const localBlogs = JSON.parse(localStorage.getItem('blogs')) || [];

    if (localBlogs.length === 0) {
        alert(currentLanguage === 'en'
            ? 'No blogs found in localStorage to migrate'
            : 'localStorage 中没有找到要迁移的博客');
        return;
    }

    const migrateBtn = document.getElementById('migrateToKV');
    const originalText = migrateBtn.textContent;
    migrateBtn.textContent = currentLanguage === 'en' ? 'Migrating...' : '迁移中...';
    migrateBtn.disabled = true;

    const statusElement = document.getElementById('migrationStatus');
    statusElement.style.display = 'block';
    statusElement.innerHTML = '<div style="color: #0088cc;">' +
        (currentLanguage === 'en' ? 'Starting migration...' : '开始迁移...') + '</div>';

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < localBlogs.length; i++) {
        const blog = localBlogs[i];

        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': config.apiKey,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(blog)
            });

            if (response.ok) {
                successCount++;
                statusElement.innerHTML += '<div style="color: #28a745; margin-top: 5px;">' +
                    (currentLanguage === 'en'
                        ? `✓ "${blog.title}" migrated successfully`
                        : `✓ "${blog.title}" 迁移成功`) +
                    '</div>';
            } else {
                errorCount++;
                const errorText = await response.text();
                statusElement.innerHTML += '<div style="color: #e60000; margin-top: 5px;">' +
                    (currentLanguage === 'en'
                        ? `✗ "${blog.title}" failed: ${errorText}`
                        : `✗ "${blog.title}" 失败: ${errorText}`) +
                    '</div>';
            }
        } catch (error) {
            errorCount++;
            statusElement.innerHTML += '<div style="color: #e60000; margin-top: 5px;">' +
                (currentLanguage === 'en'
                    ? `✗ "${blog.title}" error: ${error.message}`
                    : `✗ "${blog.title}" 错误: ${error.message}`) +
                '</div>';
        }

        // Scroll to bottom
        statusElement.scrollTop = statusElement.scrollHeight;
    }

    statusElement.innerHTML += '<div style="margin-top: 10px; font-weight: bold; color: #333;">' +
        (currentLanguage === 'en'
            ? `Migration completed: ${successCount} successful, ${errorCount} failed`
            : `迁移完成: ${successCount} 个成功, ${errorCount} 个失败`) +
        '</div>';

    if (errorCount === 0) {
        // Clear local blogs after successful migration
        localStorage.removeItem('blogs');
        statusElement.innerHTML += '<div style="color: #28a745; margin-top: 5px;">' +
            (currentLanguage === 'en'
                ? '✓ localStorage data cleared'
                : '✓ localStorage 数据已清除') +
            '</div>';
    }

    migrateBtn.textContent = originalText;
    migrateBtn.disabled = false;

    // Reload blog list
    if (typeof loadBlogs === 'function') {
        loadBlogs();
    }

    // Hide migration section
    const migrationSection = document.getElementById('migrationSection');
    if (migrationSection) {
        migrationSection.style.display = 'none';
    }
}

// Initialize API configuration UI
function initApiConfig() {
    const apiEnabledCheckbox = document.getElementById('apiEnabled');
    if (!apiEnabledCheckbox) return; // Not on admin page

    // Load current config
    loadApiConfigUI();

    // Toggle config details when checkbox changes
    apiEnabledCheckbox.addEventListener('change', function() {
        const apiConfigDetails = document.getElementById('apiConfigDetails');
        if (apiConfigDetails) {
            apiConfigDetails.style.display = this.checked ? 'block' : 'none';
        }

        // Update migration section visibility
        const localBlogs = JSON.parse(localStorage.getItem('blogs')) || [];
        const migrationSection = document.getElementById('migrationSection');
        if (migrationSection && localBlogs.length > 0 && !this.checked) {
            migrationSection.style.display = 'block';
        } else if (migrationSection) {
            migrationSection.style.display = 'none';
        }
    });

    // Save button
    const saveBtn = document.getElementById('saveApiConfig');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveApiConfig);
    }

    // Test connection button
    const testBtn = document.getElementById('testApiConnection');
    if (testBtn) {
        testBtn.addEventListener('click', testApiConnection);
    }

    // Migrate button
    const migrateBtn = document.getElementById('migrateToKV');
    if (migrateBtn) {
        migrateBtn.addEventListener('click', migrateToKV);
    }
}

// ===========================================
// Page Initialization
// ===========================================

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    updateLanguageDisplay();
    translatePage();

    // Initialize API configuration if on admin page
    if (document.getElementById('adminDashboard')) {
        initApiConfig();
    }
});