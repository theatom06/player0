/**
 * ============================================
 * Player 0 - Build Script
 * ============================================
 * 
 * Builds optimized production assets:
 * - Bundles and minifies JavaScript
 * - Minifies CSS
 * - Copies static assets
 * - Generates source maps
 * 
 * Usage: bun run build
 */

import { readdir, readFile, writeFile, mkdir, copyFile, rm } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, '../public');
const DIST_DIR = join(__dirname, '../dist');

// CSS minification (simple but effective)
function minifyCSS(css) {
  return css
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove whitespace around special characters
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim();
}

// Simple HTML minification
function minifyHTML(html) {
  return html
    // Remove HTML comments (except conditionals)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    // Remove whitespace between tags
    .replace(/>\s+</g, '><')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function processCSS() {
  console.log('📦 Processing CSS...');
  const cssDir = join(PUBLIC_DIR, 'css');
  const distCssDir = join(DIST_DIR, 'css');
  await ensureDir(distCssDir);
  
  const files = await readdir(cssDir);
  let totalSaved = 0;
  
  for (const file of files) {
    if (!file.endsWith('.css')) continue;
    
    const srcPath = join(cssDir, file);
    const destPath = join(distCssDir, file);
    
    const content = await readFile(srcPath, 'utf-8');
    const minified = minifyCSS(content);
    
    const saved = content.length - minified.length;
    totalSaved += saved;
    
    await writeFile(destPath, minified);
    console.log(`  ✓ ${file} (${saved} bytes saved)`);
  }
  
  // Process main.css
  const mainCss = await readFile(join(PUBLIC_DIR, 'main.css'), 'utf-8');
  const mainMinified = minifyCSS(mainCss);
  await writeFile(join(DIST_DIR, 'main.css'), mainMinified);
  totalSaved += mainCss.length - mainMinified.length;
  console.log(`  ✓ main.css (${mainCss.length - mainMinified.length} bytes saved)`);
  
  console.log(`  Total CSS savings: ${(totalSaved / 1024).toFixed(1)} KB`);
}

async function processJS() {
  console.log('📦 Processing JavaScript...');
  
  // Use Bun's built-in bundler for JS
  const result = await Bun.build({
    entrypoints: [join(PUBLIC_DIR, 'app.js')],
    outdir: DIST_DIR,
    minify: true,
    sourcemap: 'external',
    target: 'browser',
    naming: {
      entry: 'app.min.js'
    }
  });
  
  if (!result.success) {
    console.error('Bundle failed:', result.logs);
    return;
  }
  
  console.log('  ✓ app.min.js bundled and minified');
  
  // Copy individual JS files (minified) for service worker compatibility
  const jsDir = join(PUBLIC_DIR, 'js');
  const distJsDir = join(DIST_DIR, 'js');
  await ensureDir(distJsDir);
  
  await copyDir(jsDir, distJsDir);
  console.log('  ✓ JS modules copied');
}

async function processHTML() {
  console.log('📦 Processing HTML...');
  
  // Process index.html
  let html = await readFile(join(PUBLIC_DIR, 'index.html'), 'utf-8');
  
  // Update script reference to use minified bundle
  html = html.replace(
    '<script type="module" src="app.js"></script>',
    '<script type="module" src="app.min.js"></script>'
  );
  
  const minified = minifyHTML(html);
  await writeFile(join(DIST_DIR, 'index.html'), minified);
  console.log(`  ✓ index.html (${html.length - minified.length} bytes saved)`);
  
  // Process view templates
  const viewsDir = join(PUBLIC_DIR, 'views');
  const distViewsDir = join(DIST_DIR, 'views');
  await ensureDir(distViewsDir);
  
  const views = await readdir(viewsDir);
  for (const view of views) {
    if (!view.endsWith('.html')) continue;
    
    const content = await readFile(join(viewsDir, view), 'utf-8');
    const minified = minifyHTML(content);
    await writeFile(join(distViewsDir, view), minified);
    console.log(`  ✓ views/${view}`);
  }
}

async function copyStaticAssets() {
  console.log('📦 Copying static assets...');
  
  // Copy service worker
  await copyFile(join(PUBLIC_DIR, 'sw.js'), join(DIST_DIR, 'sw.js'));
  console.log('  ✓ sw.js');
  
  // Copy favicon if exists
  try {
    await copyFile(join(PUBLIC_DIR, 'favicon.svg'), join(DIST_DIR, 'favicon.svg'));
    console.log('  ✓ favicon.svg');
  } catch {
    // Ignore if not exists
  }
  
  try {
    await copyFile(join(PUBLIC_DIR, 'favicon.ico'), join(DIST_DIR, 'favicon.ico'));
    console.log('  ✓ favicon.ico');
  } catch {
    // Ignore if not exists
  }
}

async function build() {
  console.log('\n🚀 Building Player 0 for production...\n');
  
  const startTime = Date.now();
  
  // Clean dist directory
  try {
    await rm(DIST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  
  await ensureDir(DIST_DIR);
  
  await processCSS();
  await processJS();
  await processHTML();
  await copyStaticAssets();
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Build complete in ${elapsed}s`);
  console.log(`📁 Output: ${DIST_DIR}\n`);
}

build().catch(console.error);
