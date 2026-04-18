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
    const jwtToken = getJwtToken();
    const legacyLogin = localStorage.getItem('adminLoggedIn') === 'true';

    if (!jwtToken && !legacyLogin) {
        window.location.href = 'login.html';
        return false;
    }

    if (jwtToken) {
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: jwtToken })
            });

            if (!response.ok) {
                sessionStorage.removeItem(ADMIN_SESSION_KEY);
                localStorage.removeItem('adminLoggedIn');
                window.location.href = 'login.html';
                return false;
            }
        } catch (error) {
            console.warn('Could not verify token server-side:', error.message);
        }
    }

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
