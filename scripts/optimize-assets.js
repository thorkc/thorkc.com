#!/usr/bin/env node
/**
   * optimize-assets.js
   * Reads source images from assets/images/source/
   * Outputs optimized WebP + AVIF (and resized thumbnails) to assets/images/
   * Strips all metadata. Hash-based skipping to avoid redundant work.
   */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE_DIR = path.join(__dirname, '..', 'assets', 'images', 'source');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'images');
const HASH_FILE = path.join(__dirname, '..', 'assets', '.asset-hashes.json');

const SIZES = [
  { suffix: '', width: 1200 },
  { suffix: '-thumb', width: 400 },
  ];
const FORMATS = ['webp', 'avif'];

function fileHash(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

function loadHashes() {
    try { return JSON.parse(fs.readFileSync(HASH_FILE, 'utf8')); }
    catch { return {}; }
}

function saveHashes(hashes) {
    fs.writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 2));
}

async function optimizeAll() {
    if (!fs.existsSync(SOURCE_DIR)) {
          console.log('No source directory found  skipping optimization.');
          return;
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const hashes = loadHashes();
    const sourceFiles = fs.readdirSync(SOURCE_DIR).filter(f =>
          /\.(png|jpe?g|gif|webp|tiff?)$/i.test(f)
                                                            );
    let processed = 0, skipped = 0;
    for (const file of sourceFiles) {
          const srcPath = path.join(SOURCE_DIR, file);
          const hash = fileHash(srcPath);
          const baseName = path.parse(file).name;
          if (hashes[file] === hash) { skipped++; continue; }
          for (const { suffix, width } of SIZES) {
                  for (const format of FORMATS) {
                            const outName = baseName + suffix + '.' + format;
                            await sharp(srcPath)
                              .resize({ width, withoutEnlargement: true })
                              .toFormat(format, { quality: format === 'avif' ? 60 : 80, effort: 4 })
                              .withMetadata(false)
                              .toFile(path.join(OUT_DIR, outName));
                  }
          }
          hashes[file] = hash;
          processed++;
    }
    saveHashes(hashes);
    console.log('Done. Processed: ' + processed + ', Skipped: ' + skipped);
}

optimizeAll().catch(err => { console.error(err); process.exit(1); });
