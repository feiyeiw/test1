// i18n Configuration
const LANGUAGE_KEY = 'siteLanguage';

let currentLanguage = localStorage.getItem('siteLanguage') || 'en';
let translations = {};
const TRANSLATION_CACHE = {};
const RUNTIME_TEXT_NODE_SOURCE = new WeakMap();

const RUNTIME_TRANSLATIONS = {
    'Home': { zh: '首页', es: 'Inicio', fr: 'Accueil', ja: 'ホーム', ko: '홈', ar: 'الرئيسية' },
    'Solutions': { zh: '解决方案', es: 'Soluciones', fr: 'Solutions', ja: 'ソリューション', ko: '솔루션', ar: 'الحلول' },
    'Industries': { zh: '行业应用', es: 'Industrias', fr: 'Secteurs', ja: '業界', ko: '산업', ar: 'الصناعات' },
    'Case Studies': { zh: '案例研究', es: 'Casos de estudio', fr: 'Études de cas', ja: '導入事例', ko: '사례 연구', ar: 'دراسات الحالة' },
    'Blog': { zh: '博客', es: 'Blog', fr: 'Blog', ja: 'ブログ', ko: '블로그', ar: 'المدونة' },
    'About': { zh: '关于我们', es: 'Acerca de', fr: 'À propos', ja: '会社情報', ko: '회사 소개', ar: 'من نحن' },
    'Contact': { zh: '联系我们', es: 'Contacto', fr: 'Contact', ja: 'お問い合わせ', ko: '문의', ar: 'اتصل بنا' },
    'Industrial Automation Solutions': { zh: '工业自动化解决方案', es: 'Soluciones de automatización industrial', fr: 'Solutions d’automatisation industrielle', ja: '産業自動化ソリューション', ko: '산업 자동화 솔루션', ar: 'حلول الأتمتة الصناعية' },
    'Smart warehouse and factory integration': { zh: '智能仓储与工厂集成', es: 'Integración de almacenes y fábricas inteligentes', fr: 'Intégration d’entrepôts et d’usines intelligents', ja: 'スマート倉庫と工場の統合', ko: '스마트 창고 및 공장 통합', ar: 'تكامل المستودعات والمصانع الذكية' },
    'Warehouse Automation': { zh: '仓储自动化', es: 'Automatización de almacenes', fr: 'Automatisation d’entrepôt', ja: '倉庫自動化', ko: '창고 자동화', ar: 'أتمتة المستودعات' },
    'Smart Factory': { zh: '智能工厂', es: 'Fábrica inteligente', fr: 'Usine intelligente', ja: 'スマートファクトリー', ko: '스마트 팩토리', ar: 'المصنع الذكي' },
    'Industrial Manufacturing': { zh: '工业制造', es: 'Fabricación industrial', fr: 'Fabrication industrielle', ja: '産業製造', ko: '산업 제조', ar: 'التصنيع الصناعي' },
    'Resources': { zh: '资源中心', es: 'Recursos', fr: 'Ressources', ja: 'リソース', ko: '자료', ar: 'الموارد' },
    'Knowledge Center': { zh: '知识中心', es: 'Centro de conocimiento', fr: 'Centre de connaissances', ja: 'ナレッジセンター', ko: '지식 센터', ar: 'مركز المعرفة' },
    'YouTube Channel': { zh: 'YouTube 频道', es: 'Canal de YouTube', fr: 'Chaîne YouTube', ja: 'YouTubeチャンネル', ko: 'YouTube 채널', ar: 'قناة يوتيوب' },
    'Website: 13asrs.com': { zh: '网站：13asrs.com', es: 'Sitio web: 13asrs.com', fr: 'Site web : 13asrs.com', ja: 'ウェブサイト：13asrs.com', ko: '웹사이트: 13asrs.com', ar: 'الموقع: 13asrs.com' },
    'Email: pjm@13asrs.com': { zh: '邮箱：pjm@13asrs.com', es: 'Correo: pjm@13asrs.com', fr: 'E-mail : pjm@13asrs.com', ja: 'メール：pjm@13asrs.com', ko: '이메일: pjm@13asrs.com', ar: 'البريد الإلكتروني: pjm@13asrs.com' },
    'Location: China': { zh: '所在地：中国', es: 'Ubicación: China', fr: 'Localisation : Chine', ja: '所在地：中国', ko: '위치: 중국', ar: 'الموقع: الصين' },
    '13ASRS Industrial Automation': { zh: '13ASRS 工业自动化' },
    'Industrial Automation Solutions for Warehouses and Factories': { zh: '面向仓库与工厂的工业自动化解决方案' },
    'Warehouse automation, smart factory systems, packaging technologies, and industrial manufacturing solutions designed to improve efficiency, productivity, and operational performance.': { zh: '提供仓储自动化、智能工厂系统、包装技术和工业制造解决方案，帮助提升效率、产能和运营表现。' },
    'Explore Solutions': { zh: '查看解决方案', es: 'Ver soluciones', fr: 'Voir les solutions', ja: 'ソリューションを見る', ko: '솔루션 보기', ar: 'استعرض الحلول' },
    'Discuss Your Project': { zh: '咨询项目', es: 'Hablemos de su proyecto', fr: 'Discuter de votre projet', ja: 'プロジェクトを相談する', ko: '프로젝트 상담', ar: 'ناقش مشروعك' },
    'Core Solutions': { zh: '核心解决方案' },
    'Automation technologies designed to solve real warehouse, production, and material handling challenges.': { zh: '面向真实仓储、生产和物料搬运问题的自动化技术。' },
    'Explore integrated solutions across warehousing, manufacturing, packaging, and industrial processing.': { zh: '探索覆盖仓储、制造、包装和工业加工的一体化解决方案。' },
    'ASRS & Smart Warehouse Solutions': { zh: 'ASRS 与智能仓储解决方案' },
    'Shuttle ASRS, stacker crane, miniload, cold storage, conveyors, WMS/WES, and AGV logistics.': { zh: '穿梭车 ASRS、堆垛机、Miniload、冷库、输送线、WMS/WES 和 AGV 物流。' },
    'Smart Factory Automation': { zh: '智能工厂自动化' },
    'Automated production lines, robotic automation, intelligent material handling, factory upgrades, and multi-machine systems.': { zh: '自动化产线、机器人自动化、智能物料搬运、工厂升级和多设备系统。' },
    'Industrial Machinery Solutions': { zh: '工业机械解决方案' },
    'Printing, packaging, filling, film blowing, bag making, laser equipment, and supporting manufacturing systems.': { zh: '印刷、包装、灌装、吹膜、制袋、激光设备及配套制造系统。' },
    'Featured Case Studies': { zh: '精选案例' },
    'Real Projects. Practical Solutions.': { zh: '真实项目，实用方案。' },
    'Why Automation Projects Succeed': { zh: '自动化项目成功的关键' },
    'Project success depends on planning, integration, delivery, reliability, and handover.': { zh: '项目成功取决于规划、集成、交付、可靠性和移交。' },
    'Engineering Design': { zh: '工程设计' },
    'Technology Integration': { zh: '技术集成' },
    'Project Delivery': { zh: '项目交付' },
    'Operational Reliability': { zh: '运行可靠性' },
    'Knowledge Transfer': { zh: '知识移交' },
    'Practical automation insights, without the empty waiting room.': { zh: '实用自动化知识，不讲空话。' },
    'Visit Knowledge Center': { zh: '访问知识中心' },
    'Why Choose 13ASRS': { zh: '为什么选择 13ASRS' },
    'Why Companies Work With 13ASRS': { zh: '企业为什么与 13ASRS 合作' },
    'Real Project Experience': { zh: '真实项目经验' },
    'Engineering Integration': { zh: '工程集成能力' },
    'Global Manufacturing Resources': { zh: '全球制造资源' },
    'Warehouse & Factory Automation Expertise': { zh: '仓库与工厂自动化经验' },
    'Practical Automation Solutions': { zh: '实用自动化方案' },
    'Long-Term Project Support': { zh: '长期项目支持' },
    'Business Challenge': { zh: '业务挑战' },
    'Start with Your Business Challenge': { zh: '从您的业务挑战开始' },
    'Automation Solutions Designed Around Real Operational Challenges.': { zh: '围绕真实运营挑战设计的自动化解决方案。' },
    'Industries We Support': { zh: '我们支持的行业' },
    'Industry Cards': { zh: '行业卡片' },
    'Explore Solutions by Technology': { zh: '按技术查看解决方案' },
    'Connect industry challenges with practical automation technologies.': { zh: '将行业挑战与实用自动化技术连接起来。' },
    'Food & Beverage': { zh: '食品饮料' },
    'Chemical Industry': { zh: '化工行业' },
    'Packaging & Converting': { zh: '包装与复合加工' },
    'Cold Storage': { zh: '冷库' },
    'Pharmaceutical': { zh: '医药' },
    'Printing Industry': { zh: '印刷行业' },
    'Logistics & Distribution': { zh: '物流与配送' },
    'Electronics Manufacturing': { zh: '电子制造' },
    'Automotive Manufacturing': { zh: '汽车制造' },
    'Project Reference Library': { zh: '项目案例库' },
    'Real project references for warehouse, factory, and industrial automation planning.': { zh: '用于仓库、工厂和工业自动化规划的真实项目案例。' },
    'Case Library': { zh: '案例库' },
    'Explore Solutions Related to These Projects': { zh: '查看这些项目相关的解决方案' },
    'Move from project examples to practical automation planning.': { zh: '从项目案例进入实际自动化规划。' },
    'Browse Project Library': { zh: '浏览项目库' },
    'Browse by Industry and Technology': { zh: '按行业和技术浏览' },
    'View complete case and video': { zh: '查看完整案例和视频' },
    'Published Articles': { zh: '已发布文章' },
    'Latest Blog Posts': { zh: '最新博客文章' },
    'Browse published automation articles from the CMS. Drafts stay hidden until they are published from the admin panel.': { zh: '浏览 CMS 已发布的自动化文章，草稿在后台发布前不会显示。' },
    'Read article': { zh: '阅读文章', es: 'Leer artículo', fr: 'Lire l’article', ja: '記事を読む', ko: '글 읽기', ar: 'اقرأ المقال' },
    'Global Industrial Automation Solutions Partner': { zh: '全球工业自动化解决方案合作伙伴' },
    'What We Do': { zh: '我们做什么' },
    'How We Work': { zh: '我们的工作方式' },
    'From Concept to Operational Performance.': { zh: '从概念到稳定运营。' },
    'Discover': { zh: '需求了解' },
    'Design': { zh: '方案设计' },
    'Integrate': { zh: '系统集成' },
    'Deliver': { zh: '项目交付' },
    'Optimize': { zh: '持续优化' },
    'What Makes Us Different': { zh: '我们的不同之处' },
    'Focused on business outcomes, not equipment listings.': { zh: '关注业务结果，而不是简单罗列设备。' },
    'Engineering-Oriented': { zh: '工程导向' },
    'Solution-Focused': { zh: '方案导向' },
    'Project-Based': { zh: '项目经验驱动' },
    'Global Perspective': { zh: '全球视野' },
    'Our Focus Areas': { zh: '重点领域' },
    'What We Support': { zh: '我们支持的方向' },
    'Locations': { zh: '服务地点' },
    'Tell Us About Your Project': { zh: '告诉我们您的项目' },
    'Project Information': { zh: '项目信息' },
    'How We Can Help': { zh: '我们可以如何帮助' },
    'Practical guidance for automation planning and project evaluation.': { zh: '为自动化规划和项目评估提供实用建议。' },
    'Other Ways to Reach Us': { zh: '其他联系方式' },
    'Prefer direct contact?': { zh: '希望直接联系？' },
    'Company Name': { zh: '公司名称', es: 'Nombre de la empresa', fr: 'Nom de l’entreprise', ja: '会社名', ko: '회사명', ar: 'اسم الشركة' },
    'Industry': { zh: '行业', es: 'Industria', fr: 'Secteur', ja: '業界', ko: '산업', ar: 'الصناعة' },
    'Country / Region': { zh: '国家 / 地区', es: 'País / Región', fr: 'Pays / Région', ja: '国 / 地域', ko: '국가 / 지역', ar: 'الدولة / المنطقة' },
    'Contact Person': { zh: '联系人', es: 'Persona de contacto', fr: 'Contact', ja: '担当者', ko: '담당자', ar: 'الشخص المسؤول' },
    'Email': { zh: '邮箱', es: 'Correo', fr: 'E-mail', ja: 'メール', ko: '이메일', ar: 'البريد الإلكتروني' },
    'Phone': { zh: '电话', es: 'Teléfono', fr: 'Téléphone', ja: '電話', ko: '전화', ar: 'الهاتف' },
    'WhatsApp': { zh: 'WhatsApp' },
    'WeChat (Optional)': { zh: '微信（选填）' },
    'Automation Interest': { zh: '感兴趣的自动化方向' },
    'Estimated Project Budget': { zh: '预估项目预算' },
    'Detailed Requirements': { zh: '详细需求' },
    'Request Project Consultation': { zh: '提交项目咨询', es: 'Solicitar consulta', fr: 'Demander une consultation', ja: 'プロジェクト相談を依頼', ko: '프로젝트 상담 요청', ar: 'طلب استشارة مشروع' },
    'Select industry': { zh: '选择行业' },
    'Select automation interest': { zh: '选择自动化方向' },
    'Select estimated project budget': { zh: '选择预估项目预算' },
    'Not Sure Yet': { zh: '暂不确定' },
    'Not decided yet': { zh: '暂未决定' },
    'Loading latest blog posts...': { zh: '正在加载最新博客...' },
    'Unable to load blog posts.': { zh: '无法加载博客文章。' },
    'Learn more': { zh: '了解更多', es: 'Saber más', fr: 'En savoir plus', ja: '詳細を見る', ko: '더 알아보기', ar: 'اعرف المزيد' },
    'Sending...': { zh: '发送中...', es: 'Enviando...', fr: 'Envoi en cours...', ja: '送信中...', ko: '전송 중...', ar: 'جارٍ الإرسال...' },
    'Industry: All': { zh: '行业：全部' },
    'Solution: All': { zh: '解决方案：全部' },
    'ASRS / Automated Storage & Retrieval Systems': { zh: 'ASRS / 自动存取系统' },
    'Conveyor Systems / Automated Transport': { zh: '输送系统 / 自动运输' },
    'Smart Factory / Factory Automation': { zh: '智能工厂 / 工厂自动化' },
    'Production Line Automation': { zh: '产线自动化' },
    'Packaging Automation': { zh: '包装自动化' },
    'Intelligent WMS / WES Integration': { zh: '智能 WMS / WES 集成' },
    'Robotics Integration': { zh: '机器人集成' },
    'Other Industrial Automation Solutions': { zh: '其他工业自动化方案' },
    'Pharmaceutical & Biotech': { zh: '医药与生物科技' },
    'Packaging & Printing': { zh: '包装与印刷' },
    'Cold Chain / Frozen Food': { zh: '冷链 / 冷冻食品' },
    'E-commerce Fulfillment': { zh: '电商履约' },
    'Manufacturing / Industrial': { zh: '制造 / 工业' },
    'Chemical & Petrochemical': { zh: '化工与石化' },
    'Automotive & Transportation': { zh: '汽车与运输' },
    'Electronics & Semiconductors': { zh: '电子与半导体' },
    'Other': { zh: '其他' },
    'Fetching the latest published blog posts.': { zh: '正在获取最新发布的博客文章。' },
    'Loading published articles': { zh: '正在加载已发布文章' },
    'Media placeholder': { zh: '媒体占位符' },
    'Project References': { zh: '项目参考' },
    'Review case examples before planning your next automation project.': { zh: '在规划下一个自动化项目之前，查看案例示例。' },
    'AGV / AMR Logistics': { zh: 'AGV / AMR 物流' },
    'Shuttle System': { zh: '穿梭车系统' },
    'Stacker Crane ASRS': { zh: '堆垛机 ASRS' },
    'Printing & Packaging Systems': { zh: '印刷与包装系统' },
    'Filling Systems': { zh: '灌装系统' },
    'Film Blowing Systems': { zh: '吹膜系统' },
    'Laser Processing Equipment': { zh: '激光加工设备' },
    'Warehousing & Logistics': { zh: '仓储与物流' },
    'Building Materials': { zh: '建材' },
    'Under USD 300K': { zh: '30 万美元以下' },
    'USD 300K - 800K': { zh: '30 万 - 80 万美元' },
    'USD 800K - 2M': { zh: '80 万 - 200 万美元' },
    'USD 2M - 5M': { zh: '200 万 - 500 万美元' },
    'USD 5M+': { zh: '500 万美元以上' }
};

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
    if (!dict) {
        applyRuntimeTranslations();
        return;
    }

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

    applyRuntimeTranslations();
}

function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('siteLanguage', lang);
    document.querySelectorAll('#lang-select').forEach(function(el) {
        el.value = lang;
    });
    translatePage();
}

function translateRuntimeText(value, lang = currentLanguage) {
    const source = String(value || '').trim();
    if (!source || lang === 'en') return source;
    return RUNTIME_TRANSLATIONS[source]?.[lang] || source;
}

function translateRuntimeAttribute(el, attributeName) {
    const sourceAttribute = `data-i18n-source-${attributeName}`;
    if (!el.hasAttribute(sourceAttribute)) {
        const current = el.getAttribute(attributeName);
        if (current) el.setAttribute(sourceAttribute, current);
    }
    const source = el.getAttribute(sourceAttribute);
    if (!source) return;
    el.setAttribute(attributeName, translateRuntimeText(source));
}

function applyRuntimeTranslations(root = document) {
    const walker = document.createTreeWalker(
        root.body || root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest('script, style, textarea, [contenteditable="true"], option')) return NodeFilter.FILTER_REJECT;
                if (parent.closest('[data-i18n]')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
        if (!RUNTIME_TEXT_NODE_SOURCE.has(node)) {
            RUNTIME_TEXT_NODE_SOURCE.set(node, node.nodeValue.trim());
        }
        const source = RUNTIME_TEXT_NODE_SOURCE.get(node);
        const translated = translateRuntimeText(source);
        const prefix = node.nodeValue.match(/^\s*/)?.[0] || '';
        const suffix = node.nodeValue.match(/\s*$/)?.[0] || '';
        node.nodeValue = `${prefix}${translated}${suffix}`;
    });

    (root.querySelectorAll ? root : document).querySelectorAll('input[placeholder], textarea[placeholder], option').forEach(el => {
        if (el.hasAttribute('placeholder') && !el.hasAttribute('data-i18n-placeholder')) translateRuntimeAttribute(el, 'placeholder');
        if (el.tagName === 'OPTION') {
            if (el.hasAttribute('data-i18n')) return;
            if (!el.dataset.i18nSourceText) el.dataset.i18nSourceText = el.textContent.trim();
            el.textContent = translateRuntimeText(el.dataset.i18nSourceText);
        }
    });
}

window.translateRuntimeText = translateRuntimeText;
window.applyRuntimeTranslations = applyRuntimeTranslations;
