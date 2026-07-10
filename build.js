const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Terser = require('terser');
const CleanCSS = require('clean-css');
const { generateSitemap } = require('./tools/generate-sitemap');
const { generateRss } = require('./tools/generate-rss');

console.log('Starting build process...');

// Clean or create dist directory
const distDir = 'dist';
if (fs.existsSync(distDir)) {
  console.log('Cleaning dist directory...');
  const files = fs.readdirSync(distDir);
  for (const file of files) {
    const filePath = path.join(distDir, file);
    fs.rmSync(filePath, { recursive: true, force: true });
  }
} else {
  console.log('Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

// Files to copy (patterns)
const patterns = [
  '*.html',
  '*.css',
  '*.js',
  '*.svg',
  '*.json',
  '*.ico',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.webp',
  '*.txt',
  '*.xml'
];

// Files to exclude from dist
const excludeFiles = [
  'build.js',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'README.md',
  'DEPLOYMENT.md',
  'new_assets_contact_sheet.jpg',
  'hero-contact-automation.webp',
  'acr-system.jpg'
];

// Directories to exclude
const excludeDirs = ['.git', 'node_modules', '.claude', 'dist'];
const preservedStaticDirs = ['blog', 'case', 'cases', 'images', 'videos'];
const preservedRootFiles = new Set(['_headers', '_redirects']);
const CLOUDFLARE_PAGES_MAX_FILE_BYTES = 25 * 1024 * 1024;

function shouldSkipForPagesLimit(filePath) {
  const size = fs.statSync(filePath).size;
  if (size <= CLOUDFLARE_PAGES_MAX_FILE_BYTES) {
    return false;
  }

  const relativePath = path.relative('.', filePath);
  const sizeMb = (size / (1024 * 1024)).toFixed(1);
  console.warn(`Skipping ${relativePath}: ${sizeMb} MiB exceeds the Cloudflare Pages 25 MiB file limit.`);
  return true;
}

// Function to generate hash from file content
function generateFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Minify CSS/JS content
async function minifyContent(filePath, content) {
  const ext = path.extname(filePath);
  if (ext === '.js') {
    try {
      const result = await Terser.minify(content.toString(), {
        compress: {
          drop_console: false,
          drop_debugger: true,
          passes: 1
        },
        mangle: true
      });
      if (result.error) {
        console.warn(`Warning: JS minification failed for ${path.basename(filePath)}:`, result.error);
        return content;
      }
      return Buffer.from(result.code);
    } catch (err) {
      console.warn(`Warning: JS minification error for ${path.basename(filePath)}:`, err.message);
      return content;
    }
  } else if (ext === '.css') {
    const result = new CleanCSS({ level: 2 }).minify(content.toString());
    if (result.errors && result.errors.length > 0) {
      console.warn(`Warning: CSS minification failed for ${path.basename(filePath)}:`, result.errors.join(', '));
      return content;
    }
    return Buffer.from(result.styles);
  }
  return content;
}

// Function to copy files matching patterns with hash naming
async function copyFiles(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  const fileMap = {};

  for (const entry of entries) {
    if (excludeDirs.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // Always copy functions directory
      if (entry.name === 'functions') {
        console.log(`Copying directory: ${entry.name}`);
        copyDir(srcPath, destPath);
      }
      if (preservedStaticDirs.includes(entry.name)) {
        console.log(`Copying static content directory: ${entry.name}`);
        copyDir(srcPath, destPath);
      }
      // Skip other directories.
    } else {
      // Check if file matches any pattern
      let shouldCopy = false;
      for (const pattern of patterns) {
        if (pattern.startsWith('*')) {
          const ext = pattern.slice(1);
          if (entry.name.endsWith(ext)) {
            shouldCopy = true;
            break;
          }
        }
      }

      if ((shouldCopy || preservedRootFiles.has(entry.name)) && !excludeFiles.includes(entry.name)) {
        if (shouldSkipForPagesLimit(srcPath)) {
          continue;
        }

        const parsedPath = path.parse(entry.name);

        // Determine if file should be hashed
        let finalFileName, finalDestPath;

        if (preservedRootFiles.has(entry.name) ||
            parsedPath.ext === '.html' || parsedPath.ext === '.txt' || parsedPath.ext === '.xml' ||
            (parsedPath.ext === '.json' && parsedPath.name.startsWith('translations-'))) {
          // HTML, robots.txt, sitemap.xml, and translation files keep original names
          finalFileName = entry.name;
          finalDestPath = path.join(destDir, finalFileName);
          console.log(`Copying preserved-name file: ${entry.name}`);
        } else {
          // Generate hash for other files
          const hash = generateFileHash(srcPath);
          finalFileName = `${parsedPath.name}.${hash}${parsedPath.ext}`;
          finalDestPath = path.join(destDir, finalFileName);
          console.log(`Copying file: ${entry.name} -> ${finalFileName}`);
        }

        if (parsedPath.ext === '.js' || parsedPath.ext === '.css') {
          const rawContent = fs.readFileSync(srcPath);
          const minified = await minifyContent(srcPath, rawContent);
          fs.writeFileSync(finalDestPath, minified);
        } else {
          fs.copyFileSync(srcPath, finalDestPath);
        }

        if (entry.name === 'logo.jpg' && finalFileName !== entry.name) {
          fs.copyFileSync(srcPath, path.join(destDir, entry.name));
          console.log('Copying compatibility file: logo.jpg');
        }

        if (entry.name === 'hero-home-automation.webp') {
          fs.copyFileSync(srcPath, path.join(destDir, entry.name));
          fs.copyFileSync(srcPath, path.join(destDir, 'hero-home-automation.7fabe3f3.webp'));
          console.log('Copying compatibility files for homepage hero image');
        }

        // Store mapping for reference updates
        fileMap[entry.name] = finalFileName;
      }
    }
  }

  return fileMap;
}

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      if (shouldSkipForPagesLimit(srcPath)) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to update HTML, CSS, and JS files with hashed file names
function getFilesRecursive(dir, extensions) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursive(entryPath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function updateHtmlFiles(distDir, fileMap) {
  const extensions = ['.html', '.css', '.js'];
  const files = getFilesRecursive(distDir, extensions);

  for (const filePath of files) {
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;

      // Replace all references to hashed files
      for (const [originalName, hashedName] of Object.entries(fileMap)) {
        // Create regex to match references to original file name
        // This matches src="originalName", src="../originalName", href="originalName", url("originalName") etc.
        const escapedName = escapeRegExp(originalName);
        // Match patterns like: href="file", src="file", url("file"), url('file')
        const regex = new RegExp(`(["'\\(])\\s*((?:\\.\\./)*)${escapedName}\\s*(["'\\s>])`, 'g');
        const newContent = content.replace(regex, `$1$2${hashedName}$3`);

        if (newContent !== content) {
          content = newContent;
          updated = true;
        }
      }

      if (updated) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated references in ${path.relative(distDir, filePath)}`);
      }
  }
}

function injectRssDiscovery(distDir) {
  const files = getFilesRecursive(distDir, ['.html']);
  const rssLink = '    <link rel="alternate" type="application/rss+xml" title="13ASRS Blog, Case Studies & News" href="https://13asrs.com/rss.xml">';

  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (/type=["']application\/rss\+xml["']/i.test(content)) continue;
    if (!/<\/head>/i.test(content)) continue;

    content = content.replace(/<\/head>/i, rssLink + '\n</head>');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added RSS discovery link in ' + path.relative(distDir, filePath));
  }
}

function injectSiteIcons(distDir) {
  const files = getFilesRecursive(distDir, ['.html']);
  const siteIconLink = '    <link rel="icon" href="/logo.jpg" type="image/jpeg">';

  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (/rel=["']icon["'][^>]+href=["']\/logo\.jpg["']/i.test(content) ||
        /href=["']\/logo\.jpg["'][^>]+rel=["']icon["']/i.test(content)) continue;
    if (!/<\/head>/i.test(content)) continue;

    content = content.replace(/<\/head>/i, siteIconLink + '\n</head>');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added site icon links in ' + path.relative(distDir, filePath));
  }
}

function injectCaseStudiesInternalLinks(distDir) {
  const files = getFilesRecursive(distDir, ['.html']);
  const internalLinksSection = `        <section class="case-study-internal-links" data-case-study-internal-links="true">
            <div class="container">
                <span class="eyebrow">Automation Case Studies</span>
                <h2>See real automation projects before planning your system.</h2>
                <p>Compare warehouse automation, smart factory, packaging, and industrial manufacturing case studies from 13ASRS.</p>
                <div class="case-study-link-list">
                    <a href="/case-studies.html">All Case Studies</a>
                    <a href="/case-studies.html?solution=asrs#caseGrid">ASRS Case Studies</a>
                    <a href="/case-studies.html?solution=smart-factory#caseGrid">Smart Factory Cases</a>
                    <a href="/case-studies.html?industry=packaging-printing#caseGrid">Packaging & Printing Cases</a>
                </div>
            </div>
        </section>`;

  for (const filePath of files) {
    const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/');
    if (relativePath === 'admin.html' || relativePath === 'login.html') continue;

    let content = fs.readFileSync(filePath, 'utf8');
    if (/data-case-study-internal-links=["']true["']/i.test(content)) continue;

    if (/<\/main>/i.test(content)) {
      content = content.replace(/<\/main>/i, internalLinksSection + '\n    </main>');
    } else if (/<footer/i.test(content)) {
      content = content.replace(/<footer/i, internalLinksSection + '\n    <footer');
    } else if (/<\/body>/i.test(content)) {
      content = content.replace(/<\/body>/i, internalLinksSection + '\n</body>');
    } else {
      continue;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added case studies internal links in ' + relativePath);
  }
}

(async function main() {
  // Keep robots/sitemap/RSS aligned with newly generated static blog and case pages.
  generateSitemap();
  generateRss();

  // Copy files from current directory to dist
  console.log('Copying static files...');
  const fileMap = await copyFiles('.', distDir);

  // Update HTML files with hashed file names
  console.log('Updating HTML files with hashed file names...');
  updateHtmlFiles(distDir, fileMap);
  injectCaseStudiesInternalLinks(distDir);
  injectSiteIcons(distDir);
  injectRssDiscovery(distDir);

  console.log('Build completed successfully!');
  console.log(`Files in ${distDir}:`, fs.readdirSync(distDir));
})();
