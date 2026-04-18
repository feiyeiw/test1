// Admin login functionality
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorMessage.textContent = '';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Store JWT token
                _setAdminJwtToken(data.token);
                localStorage.setItem('adminLoggedIn', 'true'); // Legacy flag

                // Redirect to admin dashboard
                window.location.href = 'admin.html';
            } else {
                errorMessage.textContent = data.error || 'Invalid username or password';
            }
        } catch (error) {
            console.error('Login request failed:', error);
            errorMessage.textContent = 'Network error. Please try again.';
        }
    });
}

window.initAdminPage = async function() {
    const isLoggedIn = await checkAdminLogin();
    if (!isLoggedIn) return;

    updateLanguageDisplay();

    // Initialize default data if not exists
    await initializeAllData();

    // Load data from localStorage
    let siteContent = JSON.parse(localStorage.getItem('siteContent')) || {
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
};

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
    ko: {
        // Header
        'home': '홈',
        'english': 'English',
        'logout': '로그아웃',

        // Admin Dashboard
        'adminDashboard': '관리자 대시보드',
        'accountSettings': '계정 설정',
        'currentPassword': '현재 비밀번호',
        'newPassword': '새 비밀번호',
        'confirmPassword': '새 비밀번호 확인',
        'changePassword': '비밀번호 변경',
        'heroSection': '히어로 섹션',
        'title': '제목',
        'description': '설명',
        'servicesSection': '서비스 섹션',
        'service1Title': '서비스 1 제목',
        'service1Description': '서비스 1 설명',
        'service2Title': '서비스 2 제목',
        'service2Description': '서비스 2 설명',
        'service3Title': '서비스 3 제목',
        'service3Description': '서비스 3 설명',
        'saveContent': '콘텐츠 저장',
        'otherPagesManagement': '기타 페이지 관리',
        'servicesPage': '서비스 페이지',
        'pageTitle': '페이지 제목',
        'pageDescription': '페이지 설명',
        'solutionsPage': '솔루션 페이지',
        'aboutPage': '회사 소개 페이지',
        'savePagesContent': '페이지 콘텐츠 저장',
        'blogManagement': '블로그 관리',
        'blogTitle': '블로그 제목',
        'date': '날짜',
        'blogContent': '블로그 콘텐츠(리치 텍스트 에디터)',
        'addBlog': '블로그 추가',
        'blogList': '블로그 목록',
        'exportBlogs': '블로그 JSON 내보내기',
        'importBlogs': '블로그 JSON 가져오기',

        // Editor buttons titles
        'bold': '굵게',
        'italic': '기울임',
        'underline': '밑줄',
        'heading': '제목',
        'bulletList': '글머리 기호 목록',
        'numberedList': '번호 매기기 목록',
        'insertLink': '링크 삽입',
        'insertImage': '이미지 삽입'
    },
    es: {
        // Header
        'home': 'Inicio',
        'english': 'English',
        'logout': 'Cerrar sesión',

        // Admin Dashboard
        'adminDashboard': 'Panel de administración',
        'accountSettings': 'Configuración de la cuenta',
        'currentPassword': 'Contraseña actual',
        'newPassword': 'Nueva contraseña',
        'confirmPassword': 'Confirmar nueva contraseña',
        'changePassword': 'Cambiar contraseña',
        'heroSection': 'Sección Hero',
        'title': 'Título',
        'description': 'Descripción',
        'servicesSection': 'Sección de servicios',
        'service1Title': 'Título del servicio 1',
        'service1Description': 'Descripción del servicio 1',
        'service2Title': 'Título del servicio 2',
        'service2Description': 'Descripción del servicio 2',
        'service3Title': 'Título del servicio 3',
        'service3Description': 'Descripción del servicio 3',
        'saveContent': 'Guardar contenido',
        'otherPagesManagement': 'Gestión de otras páginas',
        'servicesPage': 'Página de servicios',
        'pageTitle': 'Título de la página',
        'pageDescription': 'Descripción de la página',
        'solutionsPage': 'Página de soluciones',
        'aboutPage': 'Página Acerca de',
        'savePagesContent': 'Guardar contenido de páginas',
        'blogManagement': 'Gestión del blog',
        'blogTitle': 'Título del blog',
        'date': 'Fecha',
        'blogContent': 'Contenido del blog (editor de texto enriquecido)',
        'addBlog': 'Agregar blog',
        'blogList': 'Lista de blogs',
        'exportBlogs': 'Exportar blogs a JSON',
        'importBlogs': 'Importar blogs desde JSON',

        // Editor buttons titles
        'bold': 'Negrita',
        'italic': 'Cursiva',
        'underline': 'Subrayado',
        'heading': 'Encabezado',
        'bulletList': 'Lista con viñetas',
        'numberedList': 'Lista numerada',
        'insertLink': 'Insertar enlace',
        'insertImage': 'Insertar imagen'
    },
    ja: {
        // Header
        'home': 'ホーム',
        'english': 'English',
        'logout': 'ログアウト',

        // Admin Dashboard
        'adminDashboard': '管理ダッシュボード',
        'accountSettings': 'アカウント設定',
        'currentPassword': '現在のパスワード',
        'newPassword': '新しいパスワード',
        'confirmPassword': '新しいパスワード（確認）',
        'changePassword': 'パスワードを変更',
        'heroSection': 'ヒーローセクション',
        'title': 'タイトル',
        'description': '説明',
        'servicesSection': 'サービスセクション',
        'service1Title': 'サービス1 タイトル',
        'service1Description': 'サービス1 説明',
        'service2Title': 'サービス2 タイトル',
        'service2Description': 'サービス2 説明',
        'service3Title': 'サービス3 タイトル',
        'service3Description': 'サービス3 説明',
        'saveContent': '内容を保存',
        'otherPagesManagement': 'その他のページ管理',
        'servicesPage': 'サービスページ',
        'pageTitle': 'ページタイトル',
        'pageDescription': 'ページ説明',
        'solutionsPage': 'ソリューションページ',
        'aboutPage': 'Aboutページ',
        'savePagesContent': 'ページ内容を保存',
        'blogManagement': 'ブログ管理',
        'blogTitle': 'ブログタイトル',
        'date': '日付',
        'blogContent': 'ブログ内容（リッチテキストエディタ）',
        'addBlog': 'ブログを追加',
        'blogList': 'ブログ一覧',
        'exportBlogs': 'ブログJSONをエクスポート',
        'importBlogs': 'ブログJSONをインポート',

        // Editor buttons titles
        'bold': '太字',
        'italic': '斜体',
        'underline': '下線',
        'heading': '見出し',
        'bulletList': '箇条書き',
        'numberedList': '番号付きリスト',
        'insertLink': 'リンクを挿入',
        'insertImage': '画像を挿入'
    },
    fr: {
        // Header
        'home': 'Accueil',
        'english': 'English',
        'logout': 'Déconnexion',

        // Admin Dashboard
        'adminDashboard': 'Tableau de bord admin',
        'accountSettings': 'Paramètres du compte',
        'currentPassword': 'Mot de passe actuel',
        'newPassword': 'Nouveau mot de passe',
        'confirmPassword': 'Confirmer le nouveau mot de passe',
        'changePassword': 'Changer le mot de passe',
        'heroSection': 'Section Hero',
        'title': 'Titre',
        'description': 'Description',
        'servicesSection': 'Section Services',
        'service1Title': 'Titre du service 1',
        'service1Description': 'Description du service 1',
        'service2Title': 'Titre du service 2',
        'service2Description': 'Description du service 2',
        'service3Title': 'Titre du service 3',
        'service3Description': 'Description du service 3',
        'saveContent': 'Enregistrer le contenu',
        'otherPagesManagement': 'Gestion des autres pages',
        'servicesPage': 'Page Services',
        'pageTitle': 'Titre de la page',
        'pageDescription': 'Description de la page',
        'solutionsPage': 'Page Solutions',
        'aboutPage': 'Page À propos',
        'savePagesContent': 'Enregistrer le contenu des pages',
        'blogManagement': 'Gestion du blog',
        'blogTitle': 'Titre du blog',
        'date': 'Date',
        'blogContent': 'Contenu du blog (éditeur de texte enrichi)',
        'addBlog': 'Ajouter un blog',
        'blogList': 'Liste des blogs',
        'exportBlogs': 'Exporter les blogs en JSON',
        'importBlogs': 'Importer les blogs en JSON',

        // Editor buttons titles
        'bold': 'Gras',
        'italic': 'Italique',
        'underline': 'Souligné',
        'heading': 'Titre',
        'bulletList': 'Liste à puces',
        'numberedList': 'Liste numérotée',
        'insertLink': 'Insérer un lien',
        'insertImage': 'Insérer une image'
    },
    ar: {
        // Header
        'home': 'الرئيسية',
        'english': 'English',
        'logout': 'تسجيل الخروج',

        // Admin Dashboard
        'adminDashboard': 'لوحة التحكم الإدارية',
        'accountSettings': 'إعدادات الحساب',
        'currentPassword': 'كلمة المرور الحالية',
        'newPassword': 'كلمة المرور الجديدة',
        'confirmPassword': 'تأكيد كلمة المرور الجديدة',
        'changePassword': 'تغيير كلمة المرور',
        'heroSection': 'قسم الصفحة الرئيسية',
        'title': 'العنوان',
        'description': 'الوصف',
        'servicesSection': 'قسم الخدمات',
        'service1Title': 'عنوان الخدمة 1',
        'service1Description': 'وصف الخدمة 1',
        'service2Title': 'عنوان الخدمة 2',
        'service2Description': 'وصف الخدمة 2',
        'service3Title': 'عنوان الخدمة 3',
        'service3Description': 'وصف الخدمة 3',
        'saveContent': 'حفظ المحتوى',
        'otherPagesManagement': 'إدارة الصفحات الأخرى',
        'servicesPage': 'صفحة الخدمات',
        'pageTitle': 'عنوان الصفحة',
        'pageDescription': 'وصف الصفحة',
        'solutionsPage': 'صفحة الحلول',
        'aboutPage': 'صفحة من نحن',
        'savePagesContent': 'حفظ محتوى الصفحات',
        'blogManagement': 'إدارة المدونة',
        'blogTitle': 'عنوان المدونة',
        'date': 'التاريخ',
        'blogContent': 'محتوى المدونة (محرر النصوص الغني)',
        'addBlog': 'إضافة مدونة',
        'blogList': 'قائمة المدونات',
        'exportBlogs': 'تصدير المدونات بصيغة JSON',
        'importBlogs': 'استيراد المدونات من JSON',

        // Editor buttons titles
        'bold': 'عريض',
        'italic': 'مائل',
        'underline': 'تسطير',
        'heading': 'عنوان',
        'bulletList': 'قائمة نقطية',
        'numberedList': 'قائمة مرقمة',
        'insertLink': 'إدراج رابط',
        'insertImage': 'إدراج صورة'
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

// Language management for admin page (uses global currentLanguage variable)

// Function to update language text display
function updateLanguageDisplay() {
    const languageText = document.getElementById('languageText');
    if (languageText) {
        const langNames = { en: 'English', zh: '中文', ja: '日本語', fr: 'Français', es: 'Español', ar: 'العربية', ko: '한국어' };
        languageText.textContent = langNames[currentLanguage] || 'English';
    }
}

// Function to toggle language
function toggleLanguage() {
    const langs = ['en', 'zh', 'ja', 'fr', 'es', 'ar', 'ko'];
    const currentIndex = langs.indexOf(currentLanguage);
    currentLanguage = langs[(currentIndex + 1) % langs.length];
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
    updateLanguageDisplay();
    translateAdminPage();
}

// Function to translate the admin page
function translateAdminPage() {
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
    const adminTitles = {
        en: 'Admin Dashboard - 1³ Machine',
        zh: '管理仪表板 - 1³ Machine',
        ja: '管理ダッシュボード - 1³ Machine',
        fr: 'Tableau de bord admin - 1³ Machine',
        es: 'Panel de administración - 1³ Machine',
        ar: 'لوحة التحكم الإدارية - 1³ Machine',
        ko: '관리자 대시보드 - 1³ Machine'
    };
    document.title = adminTitles[currentLanguage] || adminTitles.en;
}

