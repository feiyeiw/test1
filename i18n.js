// i18n Configuration
const LANGUAGE_KEY = 'siteLanguage';

let currentLanguage = localStorage.getItem('siteLanguage') || 'en';
let translations = {};
const TRANSLATION_CACHE = {};

function getCurrentPageKey() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    const pageName = filename.replace(/\.html$/, '') || 'index';

    const htmlToJsonKey = {
        'index': 'index',
        'about': 'about',
        'services': 'services',
        'solutions': 'solutions',
        'insights': 'insights',
        'blog-detail': 'blog_detail',
        'case-studies': 'case_studies',
        'case-ecommerce': 'case_ecommerce',
        'case-pharma': 'case_pharma',
        'case-automotive': 'case_automotive',
        'case-miniload': 'case_miniload',
        'asrs-design': 'asrs_design',
        'asrs-cost': 'asrs_cost',
        'contact': 'contact'
    };

    return htmlToJsonKey[pageName] || null;
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

        translations = {};
        for (const lang of Object.keys(commonData)) {
            translations[lang] = { common: commonData[lang] };
        }

        const pageKey = getCurrentPageKey();
        if (pageKey) {
            const pageFile = 'translations-' + pageKey.replace(/_/g, '-') + '.json';
            const pageData = await loadTranslationFile(pageFile);
            if (pageData) {
                for (const lang of Object.keys(pageData)) {
                    if (!translations[lang]) translations[lang] = {};
                    translations[lang][pageKey] = pageData[lang];
                }
            }
        }
    } catch (e) {
        console.error('Failed to load translations:', e);
    }
}

function translatePage() {
    const dict = translations[currentLanguage];
    if (!dict) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const value = getNestedValue(dict, key);
        if (value !== undefined && el.textContent !== value) {
            el.textContent = value;
            el.classList.add('i18n-fade-in');
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const value = getNestedValue(dict, key);
        if (value !== undefined && el.placeholder !== value) {
            el.placeholder = value;
            el.classList.add('i18n-fade-in');
        }
    });

    document.documentElement.lang = currentLanguage;

    if (document.getElementById('adminDashboard') && typeof translateAdminPage === 'function') {
        translateAdminPage();
    }
}

function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('siteLanguage', lang);
    document.querySelectorAll('#lang-select').forEach(function(el) {
        el.value = lang;
    });
    translatePage();
}
