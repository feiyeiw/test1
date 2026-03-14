const fs = require('fs');
const path = require('path');

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
  '*.webp'
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

// Function to copy files matching patterns
function copyFiles(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

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
        console.log(`Copying file: ${entry.name}`);
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
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

// Copy files from current directory to dist
console.log('Copying static files...');
copyFiles('.', distDir);

console.log('Build completed successfully!');
console.log(`Files in ${distDir}:`, fs.readdirSync(distDir));