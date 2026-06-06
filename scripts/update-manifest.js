#!/usr/bin/env node
/**
 * ThorKC Asset Manifest Updater
 * Reads .upload-log.json and rewrites assets-manifest.json with
 * current CDN URLs for every known asset, grouped by section.
 *
 * Usage:
 *   node scripts/update-manifest.js            # update from upload log
 *   node scripts/update-manifest.js --dry-run  # preview changes only
 *   node scripts/update-manifest.js --rebuild  # rebuild from all dist files
 */

const fs   = require('fs');
const path = require('path');

const UPLOAD_LOG    = path.resolve(__dirname, '../.upload-log.json');
const DIST_DIR      = path.resolve(__dirname, '../dist');
const MANIFEST_PATH = path.resolve(__dirname, '../assets-manifest.json');

const CDN_BASE = process.env.CDN_BASE_URL || 'https://cdn.thorkc.com';

function sectionFromKey(remoteKey) {
  const parts = remoteKey.replace('assets/', '').split('/');
  return parts[0] || 'shared';
}

function filenameSlug(remoteKey) {
  return path.basename(remoteKey, path.extname(remoteKey));
}

function extOf(remoteKey) {
  return path.extname(remoteKey).toLowerCase().replace('.', '');
}
function mergeUpload(manifest, remoteKey) {
  const section = sectionFromKey(remoteKey);
  const slug    = filenameSlug(remoteKey);
  const ext     = extOf(remoteKey);
  const url     = buildCdnUrl(remoteKey);

  if (!manifest.sections[section]) manifest.sections[section] = {};
  if (!manifest.sections[section][slug]) manifest.sections[section][slug] = { formats: {} };

  manifest.sections[section][slug].formats[ext] = url;

  const fmt = manifest.sections[section][slug].formats;
  manifest.sections[section][slug].url =
    fmt.avif || fmt.webp || fmt.jpg || fmt.jpeg || fmt.png || fmt.gif || fmt.svg || url;

  manifest.sections[section][slug].updatedAt = new Date().toISOString();
}

function walkDist(dir, files = [], base = dir) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDist(full, files, base);
    else files.push(`assets/${path.relative(base, full).replace(/\\/g, '/')}`);
  }
  return files;
}

function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const rebuild = args.includes('--rebuild');

  const manifest = loadManifest();
  let keysToMerge = [];

  if (rebuild) {
    console.log('\nRebuilding manifest from all dist files...');
    keysToMerge = walkDist(DIST_DIR);
    manifest.sections = {};
  } else {
    if (!fs.existsSync(UPLOAD_LOG)) { console.log('No upload log - run upload.js first.'); process.exit(0); }
    const log       = JSON.parse(fs.readFileSync(UPLOAD_LOG, 'utf8'));
    const succeeded = log.uploads.filter(u => u.status === 'ok');
    if (succeeded.length === 0) { console.log('No successful uploads - nothing to update.'); return; }
    keysToMerge = succeeded.map(u => u.remote);
    console.log(`\nMerging ${keysToMerge.length} upload(s) into manifest...`);
  }

  keysToMerge.forEach(key => mergeUpload(manifest, key));

  manifest.generatedAt = new Date().toISOString();
  manifest.version = (manifest.version || 0) + 1;

  const sections = Object.keys(manifest.sections);
  sections.forEach(sec => {
    const slugs = Object.keys(manifest.sections[sec]);
    console.log(`  [${sec}] ${slugs.length} asset(s): ${slugs.join(', ')}`);
  });

  if (dryRun) { console.log('\n[DRY RUN] Manifest would be:'); console.log(JSON.stringify(manifest, null, 2)); return; }

  saveManifest(manifest);
  console.log(`\nassets-manifest.json updated (v${manifest.version})`);
  console.log(`    CDN base: ${CDN_BASE}`);

  try {
    const { execSync } = require('child_process');
    execSync('git add assets-manifest.json', { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
    console.log('    Staged assets-manifest.json for commit.');
  } catch { /* not in a git repo - skip */ }
}

main();

function buildCdnUrl(remoteKey) {
  return `${CDN_BASE}/${remoteKey}`;
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch { return { version: 1, generatedAt: null, sections: {} }; }
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}
