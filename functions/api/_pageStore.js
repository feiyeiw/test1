import {
    jsonResponse,
    requireAdmin,
    requireKv
} from './_blogStore.js';

const PAGE_PREFIX = 'page_v1:';
const PAGE_INDEX_KEY = 'page_v1_index';

const ALLOWED_TYPES = new Set(['hero', 'text', 'cards', 'media', 'cta']);

function makeId() {
    return `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function normalizePageId(value) {
    const page = String(value || 'home').toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '');
    return page || 'home';
}

function cleanText(value, maxLength = 4000) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanUrl(value) {
    const url = cleanText(value, 900);
    if (!url) return '';
    if (/^(https?:\/\/|\/|#|mailto:)/i.test(url)) return url;
    return '';
}

function normalizeCardItem(item = {}) {
    return {
        id: cleanText(item.id, 120) || makeId(),
        title: cleanText(item.title, 220),
        text: cleanText(item.text, 1000),
        href: cleanUrl(item.href)
    };
}

function normalizeModule(input = {}) {
    const type = ALLOWED_TYPES.has(input.type) ? input.type : 'text';
    return {
        id: cleanText(input.id, 120) || makeId(),
        type,
        label: cleanText(input.label, 160),
        eyebrow: cleanText(input.eyebrow, 180),
        title: cleanText(input.title, 260),
        text: cleanText(input.text, 5000),
        image: cleanUrl(input.image),
        youtubeUrl: cleanUrl(input.youtubeUrl),
        ctaText: cleanText(input.ctaText, 120),
        ctaHref: cleanUrl(input.ctaHref),
        items: Array.isArray(input.items) ? input.items.slice(0, 12).map(normalizeCardItem) : []
    };
}

function normalizePage(input = {}, pageParam = 'home') {
    const now = new Date().toISOString();
    const page = normalizePageId(input.page || pageParam);
    const modules = Array.isArray(input.modules) ? input.modules.slice(0, 40).map(normalizeModule) : [];

    return {
        page,
        title: cleanText(input.title, 220),
        modules,
        updatedAt: now
    };
}

async function readPageIndex(kv) {
    const data = await kv.get(PAGE_INDEX_KEY);
    if (!data) return [];
    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writePageIndex(kv, index) {
    const sorted = [...index].sort((a, b) => String(a.page).localeCompare(String(b.page)));
    await kv.put(PAGE_INDEX_KEY, JSON.stringify(sorted));
    return sorted;
}

async function getPage(kv, pageParam) {
    const page = normalizePageId(pageParam);
    const data = await kv.get(`${PAGE_PREFIX}${page}`);
    return data ? JSON.parse(data) : { page, title: '', modules: [], updatedAt: null };
}

async function putPage(kv, pageData) {
    const page = normalizePage(pageData, pageData.page);
    await kv.put(`${PAGE_PREFIX}${page.page}`, JSON.stringify(page));

    const index = await readPageIndex(kv);
    const nextIndex = index.filter(item => item.page !== page.page);
    nextIndex.push({
        page: page.page,
        title: page.title,
        moduleCount: page.modules.length,
        updatedAt: page.updatedAt
    });
    await writePageIndex(kv, nextIndex);
    return page;
}

async function listPages(kv) {
    return readPageIndex(kv);
}

export {
    jsonResponse,
    requireAdmin,
    requireKv,
    normalizePage,
    normalizePageId,
    getPage,
    putPage,
    listPages
};
