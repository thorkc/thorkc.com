#!/usr/bin/env node
/**
   * ThorKC Asset Watcher
   * Watches the assets/ directory for changes and automatically
   * runs optimize -> upload -> manifest-update on any new or modified file.
   *
   * Usage:
   *   node scripts/watch.js               # watch & auto-deploy
   *   node scripts/watch.js --dry-run     # watch but don't upload
   */

const fs      = require('fs');
const path    = require('path');
const { spawn } = require('child_process');
const chokidar  = require('chokidar');

const ASSETS_DIR = path.resolve(__dirname, '../assets');
const SCRIPTS    = path.resolve(__dirname);
const DRY_RUN    = process.argv.includes('--dry-run');

let pending = new Set();
let debounceTimer = null;
const DEBOUNCE_MS = 1200;

function enqueuefile(filePath) {
    pending.add(filePath);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
    if (pending.size === 0) return;
    const files = [...pending];
    pending.clear();
    console.log(`\n  [${timestamp()}] ${files.length} asset(s) changed - starting pipeline...`);
    files.forEach(f => console.log(`     - ${path.relative(ASSETS_DIR, f)}`));
    for (const file of files) { await runPipeline(file); }
}

function run(script, args = []) {
    return new Promise((resolve, reject) => {
          const child = spawn('node', [path.join(SCRIPTS, script), ...args], {
                  stdio: 'inherit', env: process.env,
          });
          child.on('close', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
    });
}

async function runPipeline(file) {
    try {
          console.log('\n  Step 1/3 - Optimize');
          await run('optimize.js', ['--file', file]);
          console.log('\n  Step 2/3 - Upload');
          await run('upload.js', DRY_RUN ? ['--dry-run'] : []);
          console.log('\n  Step 3/3 - Update manifest');
          await run('update-manifest.js', DRY_RUN ? ['--dry-run'] : []);
          console.log(`\n  [${timestamp()}] Pipeline complete for: ${path.relative(ASSETS_DIR, file)}\n`);
    } catch (err) {
          console.error(`\n  Pipeline failed: ${err.message}`);
    }
}

function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

const SUPPORTED = /\.(jpg|jpeg|png|webp|gif|avif|tiff|svg|pdf|json|ico|woff|woff2|txt)$/i;

console.log(`\nThorKC Asset Watcher started${DRY_RUN ? ' [DRY RUN]' : ''}`);
console.log(`     Watching: ${ASSETS_DIR}`);
console.log(`     Press Ctrl+C to stop.\n`);

const watcher = chokidar.watch(ASSETS_DIR, {
    ignored: /(^|[\/\\])\../, persistent: true, ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
});

watcher
  .on('add',    fp => { if (SUPPORTED.test(fp)) { console.log(`  New: ${path.relative(ASSETS_DIR, fp)}`); enqueuefile(fp); } })
  .on('change', fp => { if (SUPPORTED.test(fp)) { console.log(`  Changed: ${path.relative(ASSETS_DIR, fp)}`); enqueuefile(fp); } })
  .on('error',  error => console.error(`Watcher error: ${error}`));
