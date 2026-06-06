#!/usr/bin/env node
/**
 * ThorKC Asset Optimizer
 * Processes images, SVGs, and static files before upload.
 * Outputs optimized files to ./dist/ mirroring the source structure.
 *
 * Usage:
 *   node scripts/optimize.js                   # process all changed assets
 *   node scripts/optimize.js --all             # force-process every asset
 *   node scripts/optimize.js --file <path>     # process a single file
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Config ──────────────────────────────────────────────────────────────────
const SRC_DIR  = path.resolve(__dirname, '../assets');
const DIST_DIR = path.resolve(__dirname, '../dist');
const CACHE    = path.resolve(__dirname, '../.asset-cache.json');

const IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.avif']);
const SVG_EXTS    = new Set(['.svg']);
const STATIC_EXTS = new Set(['.pdf', '.json', '.txt', '.ico', '.woff', '.woff2']);

// Quality presets per section — tweak as ThorKC art direction evolves
const QUALITY = {
  homepage:  { webp: 85, avif: 80, jpeg: 85, png: 9 },
  journal:   { webp: 82, avif: 78, jpeg: 82, png: 9 },
  thorkade:  { webp: 80, avif: 75, jpeg: 80, png: 8 },
  basement:  { webp: 80, avif: 75, jpeg: 80, png: 8 },
  pfc:       { webp: 82, avif: 78, jpeg: 82, png: 9 },
  shared:    { webp: 85, avif: 80, jpeg: 85, png: 9 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); }
  catch { return {}; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mtimeOf(file) {
  try { return fs.statSync(file).mtimeMs; }
  catch { return 0; }
}

function sectionOf(filePath) {
  const rel = path.relative(SRC_DIR, filePath);
  const parts = rel.split(path.sep);
  return parts[0] && QUALITY[parts[0]] ? parts[0] : 'shared';
}

function relPath(filePath) {
  return path.relative(SRC_DIR, filePath);
}

// ─── Processors ──────────────────────────────────────────────────────────────
async function processImage(srcFile, distDir, section) {
  // Requires: sharp  (npm install sharp)
  const sharp = require('sharp');
  const base  = path.basename(srcFile, path.extname(srcFile));
  const q     = QUALITY[section] || QUALITY.shared;

  ensureDir(distDir);

  const img = sharp(srcFile);
  const meta = await img.metadata();

  const outputs = [];

  // Always produce a WebP version
  const webpOut = path.join(distDir, `${base}.webp`);
  await img.clone().webp({ quality: q.webp }).toFile(webpOut);
  outputs.push(webpOut);

  // Produce AVIF for non-gif images (better compression for hero/section art)
  if (meta.format !== 'gif') {
    const avifOut = path.join(distDir, `${base}.avif`);
    await img.clone().avif({ quality: q.avif }).toFile(avifOut);
    outputs.push(avifOut);
  }

  // Keep a compressed fallback in the original format
  const ext = path.extname(srcFile).toLowerCase();
  const fallbackOut = path.join(distDir, path.basename(srcFile));
  if (['.jpg', '.jpeg'].includes(ext)) {
    await img.clone().jpeg({ quality: q.jpeg, progressive: true }).toFile(fallbackOut);
  } else if (ext === '.png') {
    await img.clone().png({ compressionLevel: q.png, progressive: true }).toFile(fallbackOut);
  } else {
    // GIF, WEBP, AVIF — copy as-is
    fs.copyFileSync(srcFile, fallbackOut);
  }
  outputs.push(fallbackOut);

  const savings = outputs.map(o => {
    const orig = fs.statSync(srcFile).size;
    const opt  = fs.statSync(o).size;
    return `${path.basename(o)}: ${((1 - opt/orig)*100).toFixed(1)}% smaller`;
  });

  console.log(`  ✔ [image] ${relPath(srcFile)}\n      ${savings.join('\n      ')}`);
  return outputs;
}

async function processSvg(srcFile, distDir) {
  // Requires: svgo  (npm install svgo)
  const { optimize } = require('svgo');

  ensureDir(distDir);
  const raw = fs.readFileSync(srcFile, 'utf8');
  const result = optimize(raw, {
    path: srcFile,
    plugins: [
      'preset-default',
      'removeDimensions',
      { name: 'addAttributesToSVGElement',
        params: { attributes: [{ 'aria-hidden': 'true' }] } },
    ],
  });

  const outFile = path.join(distDir, path.basename(srcFile));
  fs.writeFileSync(outFile, result.data);

  const origSize = Buffer.byteLength(raw);
  const optSize  = Buffer.byteLength(result.data);
  console.log(`  ✔ [svg]   ${relPath(srcFile)} — ${((1 - optSize/origSize)*100).toFixed(1)}% smaller`);
  return [outFile];
}

function processStatic(srcFile, distDir) {
  ensureDir(distDir);
  const outFile = path.join(distDir, path.basename(srcFile));
  fs.copyFileSync(srcFile, outFile);
  console.log(`  ✔ [static] ${relPath(srcFile)}`);
  return [outFile];
}

// ─── Walker ──────────────────────────────────────────────────────────────────
function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, files);
    else files.push(full);
  }
  return files;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const forceAll = args.includes('--all');
  const singleFile = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

  const cache = loadCache();
  const allFiles = singleFile
    ? [path.resolve(singleFile)]
    : walkDir(SRC_DIR);

  const toProcess = allFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    const supported = IMAGE_EXTS.has(ext) || SVG_EXTS.has(ext) || STATIC_EXTS.has(ext);
    if (!supported) return false;
    if (forceAll || singleFile) return true;
    return mtimeOf(f) > (cache[f] || 0);
  });

  if (toProcess.length === 0) {
    console.log('✅  No changed assets — nothing to optimize.');
    return;
  }

  console.log(`\n🔧  Optimizing ${toProcess.length} asset(s)…\n`);

  const processed = [];
  for (const srcFile of toProcess) {
    const ext     = path.extname(srcFile).toLowerCase();
    const rel     = path.relative(SRC_DIR, srcFile);
    const distDir = path.join(DIST_DIR, path.dirname(rel));
    const section = sectionOf(srcFile);

    try {
      let outputs;
      if (IMAGE_EXTS.has(ext))  outputs = await processImage(srcFile, distDir, section);
      else if (SVG_EXTS.has(ext)) outputs = await processSvg(srcFile, distDir);
      else                         outputs = processStatic(srcFile, distDir);

      cache[srcFile] = Date.now();
      processed.push({ src: relPath(srcFile), dist: outputs.map(o => path.relative(DIST_DIR, o)), section });
    } catch (err) {
      console.error(`  ✖ [error] ${relPath(srcFile)}: ${err.message}`);
    }
  }

  saveCache(cache);

  // Write a processing report for the upload step to consume
  const reportPath = path.resolve(__dirname, '../.processed-assets.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), assets: processed }, null, 2));
  console.log(`\n✅  Done. ${processed.length} asset(s) processed → dist/`);
}

main().catch(err => { console.error(err); process.exit(1); });
