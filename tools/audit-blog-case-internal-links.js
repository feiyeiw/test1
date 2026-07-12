const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'content', 'static-posts', 'generated');
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'blog-case-internal-link-review.csv');
const SITE_ORIGIN = 'https://13asrs.com';
const MAX_RECOMMENDATIONS_PER_BLOG = 2;

const TARGETS = [
  {
    slug: '4-aisle-mini-load-asrs-warehouse-high-sku-automated-storage-and-goods-to-person-picking-solution',
    titlePattern: /mini load|high sku|goods-to-person|warehouse|asrs/i,
    phrases: [
      '4-aisle mini load ASRS',
      'mini load ASRS warehouse',
      'mini load ASRS system',
      'mini load ASRS',
      'high SKU warehouses',
      'high SKU warehouse',
      'goods-to-person picking stations'
    ]
  },
  {
    slug: '536-bins-hour-mega-warehouse-automation-case-33-acr-18-amr-intelligent-asrs-system',
    titlePattern: /acr|amr|warehouse|asrs/i,
    phrases: [
      '536 bins/hour',
      '536 bins per hour',
      '33 ACR + 18 AMR',
      '33 ACR and 18 AMR',
      'ACR and AMR warehouse system',
      'ACR and AMR robots'
    ]
  },
  {
    slug: 'aluminum-profile-extrusion-production-line-case-study-fully-automated-smart-manufacturing-system-for-industrial-aluminum-processing',
    titlePattern: /aluminum|extrusion/i,
    phrases: [
      'aluminum profile extrusion production line',
      'aluminum extrusion production line',
      'automated aluminum extrusion line',
      'smart aluminum factory',
      'aluminum extrusion line',
      'automated extrusion line',
      'modern extrusion lines',
      'aluminum extrusion technology',
      'aluminum profile extrusion factory',
      'aluminum profile extrusion factory layout',
      'aluminum extrusion factory layout'
    ]
  },
  {
    slug: 'asrs-warehouse-industry-applications-case-study-how-manufacturing-e-commerce-pharma-food-industries-benefit-from-automated-storage-systems',
    titlePattern: /asrs|warehouse|storage|logistics|fulfillment/i,
    phrases: [
      'ASRS warehouse systems',
      'ASRS warehouse system',
      'automated storage systems',
      'warehouse automation for manufacturing',
      'ASRS automated warehouses',
      'automated storage and retrieval systems',
      'fully automated ASRS warehouse',
      'warehouse automation systems',
      'warehouse automation system',
      'ASRS automation',
      'ASRS systems',
      'ASRS warehouse design'
    ]
  },
  {
    slug: 'can-108-amrs-46-acrs-replace-manual-picking-high-density-asrs-automation-case-study',
    titlePattern: /acr|amr/i,
    phrases: [
      '108 AMRs and 46 ACRs',
      '108 AMR and 46 ACR',
      '108 AMRs',
      '46 ACRs',
      'AMR fleet management system',
      'high-throughput ASRS warehouse with ACR and AMR robots'
    ]
  },
  {
    slug: 'complete-asrs-workflow-case-study-amr-rgv-stacker-crane-integrated-warehouse-automation-system',
    titlePattern: /amr|rgv|stacker|asrs|warehouse/i,
    phrases: [
      'AMR, RGV, and stacker cranes',
      'AMR, RGV and stacker cranes',
      'AMR RGV stacker crane',
      'complete ASRS workflow',
      'integrated ASRS system',
      'WMS WCS AMR RGV and ASRS',
      'AMR, RGV & stacker cranes',
      'AMR, RGV & ASRS',
      'AMR, RGV and ASRS',
      'AMR robots, RGV shuttles, and stacker cranes',
      'WMS, WCS, AMR, RGV and ASRS'
    ]
  },
  {
    slug: 'complete-cartoning-case-packing-line-for-pharmaceutical-beauty-health-daily-care-industries',
    titlePattern: /packag|carton|pharma|beauty|cosmetic|daily care/i,
    phrases: [
      'complete cartoning and case packing line',
      'cartoning and case packing line',
      'automated cartoning systems',
      'automatic cartoning line',
      'pharmaceutical packaging line',
      'automated packaging line',
      'packaging automation'
    ]
  },
  {
    slug: 'fully-automated-motor-assembly-line-complete-industrial-case-study',
    titlePattern: /motor|assembly/i,
    phrases: [
      'fully automated motor assembly line',
      'automated motor assembly line',
      'motor assembly line',
      'smart assembly lines',
      'motor manufacturing',
      'motor assembly'
    ]
  },
  {
    slug: 'fully-automatic-paper-cup-production-line-intelligent-cup-forming-inspection-sterilization-and-packaging-system',
    titlePattern: /paper cup/i,
    phrases: [
      'fully automatic paper cup production line',
      'paper cup production line',
      'paper cup manufacturing process',
      'paper cup manufacturing',
      'paper cup machine'
    ]
  },
  {
    slug: 'fully-automatic-reel-tray-vacuum-packaging-line-with-mes-integration-and-smart-traceability-system',
    titlePattern: /reel|tray|vacuum|electronics|semiconductor/i,
    phrases: [
      'fully automatic reel and tray packaging line',
      'reel and tray packaging automation',
      'reel and tray packaging',
      'tray and reel packaging automation',
      'reel & tray packaging line',
      'reel & tray packaging',
      'reel tray packaging',
      'electronics packaging line',
      'vacuum packaging line',
      'vacuum packaging',
      'labeling and traceability'
    ]
  },
  {
    slug: 'goods-to-person-ctu-warehouse-replace-manual-picking-completely',
    titlePattern: /ctu|goods-to-person/i,
    phrases: [
      'CTU goods-to-person warehouse',
      'CTU goods-to-person system',
      'CTU warehouse system',
      'CTU warehouse',
      'CTU system',
      'goods-to-person systems',
      'goods-to-person system'
    ]
  },
  {
    slug: 'heavy-duty-asrs-for-chemical-drums-how-stacker-cranes-handle-extreme-loads',
    titlePattern: /chemical|hazard|drum/i,
    phrases: [
      'heavy-duty ASRS for chemical drums',
      'chemical drum ASRS warehouse',
      'chemical drum warehouse',
      'chemical warehouses',
      'hazardous material storage',
      'stacker crane ASRS system'
    ]
  },
  {
    slug: 'industrial-coating-machine-applications-case-study-medical-devices-electronics-lithium-batteries-packaging-textile-semiconductor-manufacturing',
    titlePattern: /coating|lithium battery|medical device|optical film/i,
    phrases: [
      'industrial coating machine',
      'industrial coating systems',
      'roll-to-roll coating technology',
      'lithium battery manufacturing',
      'medical device coating',
      'optical film coating',
      'coating machine',
      'coating defects'
    ]
  },
  {
    slug: 'complete-ev-battery-production-line-turnkey-lithium-battery-smart-factory-automation-solution',
    titlePattern: /battery|\bev\b/i,
    phrases: [
      'complete lithium battery production line',
      'EV battery production line',
      'lithium battery production line',
      'battery manufacturing automation',
      'smart battery factory',
      'battery factory layout',
      'battery production equipment',
      'ASRS battery warehouse'
    ]
  },
  {
    slug: 'mega-asrs-warehouse-case-study-12-000-system-with-50-000-storage-locations-1-000-tasks-hour',
    titlePattern: /mega|storage location|tasks per hour|warehouse design/i,
    phrases: [
      'mega ASRS warehouse system',
      'mega ASRS warehouse',
      '50,000 storage locations',
      '1,000 tasks per hour',
      '12,000 automated warehouse',
      '129,000 storage locations',
      '129,000 storage location ASRS warehouse',
      'warehouse layout design'
    ]
  },
  {
    slug: 'tomato-paste-canned-tomato-production-line-fully-automated-food-processing-filling-packaging-asrs-system',
    titlePattern: /tomato|food processing|aseptic/i,
    phrases: [
      'tomato paste production line',
      'tomato processing line',
      'tomato processing plant',
      'tomato processing systems',
      'tomato paste lines',
      'automated tomato processing',
      'aseptic filling systems',
      'canned tomato production line'
    ]
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value) {
  return decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flatten(value) {
  if (Array.isArray(value)) return value.join(' ');
  return stripHtml(value);
}

function getBodySections(post) {
  return [
    ['Summary', flatten(post.summary)],
    ['Technology', flatten(post.technology)],
    ['Challenge', flatten(post.challenge)],
    ['Solution', flatten(post.solutionDetail)],
    ['Workflow & Layout', flatten(post.layoutWorkflow)],
    ['Results & ROI', flatten(post.results)],
    ['Equipment List', flatten(post.equipmentList)],
    ['Body', flatten(post.contentHtml)]
  ].filter(([, text]) => text);
}

function findPhrase(sectionText, phrase) {
  const lowerText = sectionText.toLocaleLowerCase('en-US');
  const lowerPhrase = phrase.toLocaleLowerCase('en-US');
  let fromIndex = 0;

  while (fromIndex < lowerText.length) {
    const index = lowerText.indexOf(lowerPhrase, fromIndex);
    if (index === -1) return null;

    const before = index === 0 ? '' : lowerText[index - 1];
    const afterIndex = index + lowerPhrase.length;
    const after = afterIndex >= lowerText.length ? '' : lowerText[afterIndex];
    const startsCleanly = !before || !/[a-z0-9]/i.test(before);
    const endsCleanly = !after || !/[a-z0-9]/i.test(after);

    if (startsCleanly && endsCleanly) {
      return {
        index,
        original: sectionText.slice(index, index + phrase.length)
      };
    }
    fromIndex = index + 1;
  }
  return null;
}

function makeContext(text, index, phraseLength) {
  const radius = 105;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + phraseLength + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function getCaseMap(files) {
  const cases = files
    .filter(name => name.startsWith('case-') && name.endsWith('.json'))
    .map(name => readJson(path.join(POSTS_DIR, name)));

  return new Map(cases.map(post => [post.urlSlug, post]));
}

function getExistingBodyLinks(post) {
  const links = [];
  const html = String(post.contentHtml || '');
  const pattern = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html))) links.push(match[1]);
  return links;
}

function scoreMatch(post, target, matches) {
  const title = String(post.title || '').toLocaleLowerCase('en-US');
  const titleBonus = matches.some(match => title.includes(match.phrase.toLocaleLowerCase('en-US'))) ? 60 : 0;
  const phraseScore = matches.reduce((total, match) => {
    const words = match.phrase.trim().split(/\s+/).length;
    return total + words * 8 + match.phrase.length;
  }, 0);
  return titleBonus + phraseScore + Math.min(matches.length, 4) * 20;
}

function collectRecommendations(post, caseMap) {
  const sections = getBodySections(post);
  const existingLinks = getExistingBodyLinks(post);
  const candidates = [];

  for (const target of TARGETS) {
    const targetPost = caseMap.get(target.slug);
    if (!targetPost) continue;
    if (target.titlePattern && !target.titlePattern.test(String(post.title || ''))) continue;

    const matches = [];
    for (const phrase of target.phrases) {
      for (const [section, text] of sections) {
        const found = findPhrase(text, phrase);
        if (!found) continue;
        matches.push({ phrase, section, text, ...found });
        break;
      }
    }
    if (!matches.length) continue;

    matches.sort((a, b) => {
      const wordDifference = b.phrase.split(/\s+/).length - a.phrase.split(/\s+/).length;
      return wordDifference || b.phrase.length - a.phrase.length;
    });

    const best = matches[0];
    const targetPath = `/case/${target.slug}/`;
    const score = scoreMatch(post, target, matches);
    candidates.push({
      score,
      matchCount: matches.length,
      section: best.section,
      anchor: best.original,
      context: makeContext(best.text, best.index, best.original.length),
      targetTitle: targetPost.title,
      targetUrl: `${SITE_ORIGIN}${targetPath}`,
      alreadyLinked: existingLinks.some(href => href.includes(targetPath)),
      titleMatched: String(post.title || '').toLocaleLowerCase('en-US').includes(best.phrase.toLocaleLowerCase('en-US'))
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.anchor.length - a.anchor.length)
    .slice(0, MAX_RECOMMENDATIONS_PER_BLOG);
}

function csvCell(value) {
  const text = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildRows(blogs, caseMap) {
  const rows = [];

  for (const post of blogs) {
    const recommendations = collectRecommendations(post, caseMap);
    const sourceUrl = `${SITE_ORIGIN}/blog/${post.urlSlug}/`;

    if (!recommendations.length) {
      rows.push([
        '无合适候选', post.title, sourceUrl, '', '', '', '', '', '', '',
        '当前规则未在正文中找到与已发布 Case 高度对应的原词；不建议为了加链接而硬改锚文本。', ''
      ]);
      continue;
    }

    for (const recommendation of recommendations) {
      const wordCount = recommendation.anchor.trim().split(/\s+/).length;
      const relevance = recommendation.titleMatched || recommendation.matchCount >= 2 || wordCount >= 4 ? '高' : '中';
      const reason = recommendation.matchCount >= 2
        ? `正文中发现 ${recommendation.matchCount} 个与该案例主题一致的表达，优先选取最具体的一处。`
        : '正文原词与该案例的设备、行业或应用场景直接对应。';

      rows.push([
        '待审核',
        post.title,
        sourceUrl,
        recommendation.section,
        recommendation.anchor,
        wordCount >= 4 ? '长尾词/短句' : '关键词组',
        recommendation.context,
        recommendation.targetTitle,
        recommendation.targetUrl,
        relevance,
        reason,
        recommendation.alreadyLinked ? '是（正文已有同目标链接）' : '否'
      ]);
    }
  }

  return rows;
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    throw new Error(`Static post data directory not found: ${POSTS_DIR}`);
  }

  const files = fs.readdirSync(POSTS_DIR);
  const caseMap = getCaseMap(files);
  const blogs = files
    .filter(name => name.startsWith('blog-') && name.endsWith('.json'))
    .map(name => readJson(path.join(POSTS_DIR, name)))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'en'));

  const headers = [
    '审核状态',
    '来源Blog标题',
    '来源Blog URL',
    '正文板块',
    '建议锚文本（正文原词）',
    '锚文本类型',
    '原文上下文',
    '建议目标Case标题',
    '建议目标Case URL',
    '相关度',
    '匹配依据',
    '正文已链接该目标'
  ];
  const rows = buildRows(blogs, caseMap);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `\uFEFF${csv}\r\n`, 'utf8');

  const candidateRows = rows.filter(row => row[0] === '待审核').length;
  const unmatchedBlogs = rows.filter(row => row[0] === '无合适候选').length;
  console.log(`Scanned ${blogs.length} published blog posts.`);
  console.log(`Generated ${candidateRows} review candidates; ${unmatchedBlogs} posts had no safe match.`);
  console.log(`Report: ${REPORT_PATH}`);
}

main();
