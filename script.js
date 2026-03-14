// SHA-256 Hash function using Web Crypto API
async function sha256Hash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

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

// Admin login functionality
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    // Initialize credentials on login page load
    initializeAdminCredentials();

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
    
    // Sample data for management
    let siteContent = {
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
    let blogs = JSON.parse(localStorage.getItem('blogs')) || [];
    
    // Load blogs
    function loadBlogs() {
        const blogsContainer = document.getElementById('blogsContainer');
        blogsContainer.innerHTML = '';
        
        if (blogs.length === 0) {
            blogsContainer.innerHTML = '<p>No blogs yet. Add your first blog!</p>';
            return;
        }
        
        blogs.forEach((blog, index) => {
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
                <button onclick="editBlog(${index})" style="margin-right: 10px; padding: 5px 10px; background-color: #e60000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                <button onclick="deleteBlog(${index})" style="padding: 5px 10px; background-color: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
            `;

            blogsContainer.appendChild(blogItem);
        });
    }
    
    // Add blog
    document.getElementById('addBlog').addEventListener('click', function() {
        const title = document.getElementById('blogTitle').value;
        const editorContent = document.getElementById('blogContent');
        const content = editorContent ? editorContent.innerHTML : '';
        const date = document.getElementById('blogDate').value || new Date().toISOString().split('T')[0];

        if (!title || !content.trim()) {
            alert('Please fill in all fields');
            return;
        }

        const newBlog = {
            id: Date.now(),
            title: title,
            content: content, // Store HTML content
            plainText: editorContent ? editorContent.textContent : '', // Also store plain text for preview
            date: date
        };

        blogs.push(newBlog);
        localStorage.setItem('blogs', JSON.stringify(blogs));

        // Clear form
        document.getElementById('blogTitle').value = '';
        if (editorContent) editorContent.innerHTML = '';
        document.getElementById('blogDate').value = '';

        loadBlogs();
        alert('Blog added successfully!');
    });
    
    // Edit blog
    window.editBlog = function(index) {
        const blog = blogs[index];
        document.getElementById('blogTitle').value = blog.title;
        const editorContent = document.getElementById('blogContent');
        if (editorContent) editorContent.innerHTML = blog.content;
        document.getElementById('blogDate').value = blog.date;

        // Remove the blog and load the form
        blogs.splice(index, 1);
        localStorage.setItem('blogs', JSON.stringify(blogs));
        loadBlogs();
    };
    
    // Delete blog
    window.deleteBlog = function(index) {
        if (confirm('Are you sure you want to delete this blog?')) {
            blogs.splice(index, 1);
            localStorage.setItem('blogs', JSON.stringify(blogs));
            loadBlogs();
        }
    };
    
    // Load blogs on page load
    loadBlogs();
    })(); // End of async IIFE
}

// Update main page with admin content
function updateMainPage() {
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
function loadBlogsOnHome() {
    const blogsSection = document.getElementById('blogsSection');
    if (!blogsSection) return;

    const blogs = JSON.parse(localStorage.getItem('blogs')) || [];

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
}

// Update page content for all pages
function updatePageContent() {
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
    updateMainPage();
}

// Update other pages content
if (window.location.pathname.includes('services.html') ||
    window.location.pathname.includes('solutions.html') ||
    window.location.pathname.includes('about.html')) {
    updatePageContent();
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
function loadBlogDetail() {
    const blogId = getUrlParameter('id');
    if (!blogId) {
        // No blog ID specified, show error or redirect
        document.getElementById('blogTitle').textContent = 'Blog Not Found';
        document.getElementById('blogContent').innerHTML = '<p>The blog you are looking for does not exist or has been removed.</p>';
        return;
    }

    const blogs = JSON.parse(localStorage.getItem('blogs')) || [];
    const blog = blogs.find(b => b.id == blogId); // Use == to match string or number

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
    setupBlogNavigation(blogs, blog);

    // Load related blogs
    loadRelatedBlogs(blogs, blog);
}

// Setup blog navigation links
function setupBlogNavigation(blogs, currentBlog) {
    // Sort blogs by date (newest first)
    const sortedBlogs = [...blogs].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Find current blog index in sorted list
    const currentIndex = sortedBlogs.findIndex(b => b.id == currentBlog.id);

    const prevBlogLink = document.getElementById('prevBlog');
    const nextBlogLink = document.getElementById('nextBlog');

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
}

// Load related blogs (exclude current blog)
function loadRelatedBlogs(blogs, currentBlog) {
    const container = document.getElementById('relatedBlogsContainer');
    if (!container) return;

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
}

// Check if we're on the blog detail page
if (window.location.pathname.includes('blog-detail.html')) {
    loadBlogDetail();
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