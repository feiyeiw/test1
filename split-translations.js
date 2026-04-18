/**
 * Split translations.json into common + page-specific files
 * Usage: node split-translations.js
 */

const fs = require('fs');
const path = require('path');

const INPUT = 'translations.json';
const OUTPUT_DIR = '.';

// Map: HTML filename (without .html) -> translation key in JSON
const PAGE_KEYS = [
    'common',
    'index',
    'about',
    'services',
    'solutions',
    'insights',
    'blog_detail',
    'case_studies',
    'case_ecommerce',
    'case_pharma',
    'case_automotive',
    'case_miniload',
    'asrs_design',
    'asrs_cost',
    'contact',
];

function main() {
    const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
    const languages = Object.keys(data);

    // Split each page key into its own file
    for (const pageKey of PAGE_KEYS) {
        const pageData = {};
        for (const lang of languages) {
            if (data[lang][pageKey]) {
                pageData[lang] = data[lang][pageKey];
            }
        }

        const filename = `translations-${pageKey.replace(/_/g, '-')}.json`;
        const outputPath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(outputPath, JSON.stringify(pageData, null, 2) + '\n', 'utf8');

        const size = fs.statSync(outputPath).size;
        console.log(`Created: ${filename} (${size} bytes)`);
    }

    // Generate a manifest mapping HTML page -> translation file key
    const manifest = {};
    const htmlToKey = {
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
        'contact': 'contact',
    };

    for (const [htmlName, transKey] of Object.entries(htmlToKey)) {
        manifest[htmlName] = `translations-${transKey.replace(/_/g, '-')}`;
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'translations-manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf8'
    );

    console.log(`\nCreated: translations-manifest.json`);
    console.log(`\nTotal: ${PAGE_KEYS.length} translation files + 1 manifest`);
    console.log('Done! You can now delete translations.json after confirming everything works.');
}

main();
