const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Terser = require('terser');
const CleanCSS = require('clean-css');

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
  'DEPLOYMENT.md'
];

// Directories to exclude
const excludeDirs = ['.git', 'node_modules', '.claude', 'dist'];

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
      // Skip other directories (static site, no subdirectories expected)
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

      if (shouldCopy && !excludeFiles.includes(entry.name)) {
        const parsedPath = path.parse(entry.name);

        // Determine if file should be hashed
        let finalFileName, finalDestPath;

        if (parsedPath.ext === '.html' || parsedPath.ext === '.txt' || parsedPath.ext === '.xml' ||
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
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to update HTML, CSS, and JS files with hashed file names
function updateHtmlFiles(distDir, fileMap) {
  const extensions = ['.html', '.css', '.js'];

  for (const ext of extensions) {
    const files = fs.readdirSync(distDir).filter(file => file.endsWith(ext));

    for (const file of files) {
      const filePath = path.join(distDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;

      // Replace all references to hashed files
      for (const [originalName, hashedName] of Object.entries(fileMap)) {
        // Create regex to match references to original file name
        // This matches src="originalName", href="originalName", url("originalName") etc.
        const escapedName = escapeRegExp(originalName);
        // Match patterns like: href="file", src="file", url("file"), url('file')
        const regex = new RegExp(`(["'\\(])\\s*${escapedName}\\s*(["'\\s>])`, 'g');
        const newContent = content.replace(regex, `$1${hashedName}$2`);

        if (newContent !== content) {
          content = newContent;
          updated = true;
        }
      }

      if (updated) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated references in ${file}`);
      }
    }
  }
}

(async function main() {
  // Copy files from current directory to dist
  console.log('Copying static files...');
  const fileMap = await copyFiles('.', distDir);

  // Update HTML files with hashed file names
  console.log('Updating HTML files with hashed file names...');
  updateHtmlFiles(distDir, fileMap);

  console.log('Build completed successfully!');
  console.log(`Files in ${distDir}:`, fs.readdirSync(distDir));
})();