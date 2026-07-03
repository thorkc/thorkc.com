#!/usr/bin/env node
/**
   * inject-env.js
   * Injects window.__THORKC_ENV__ into every HTML file at build time.
   * Run via: node scripts/inject-env.js
   */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const config = {
    ASSET_BACKEND:   process.env.ASSET_BACKEND   || 'r2',
    R2_PUBLIC_URL:   process.env.R2_PUBLIC_URL   || '',
    GITHUB_RAW_BASE: process.env.GITHUB_RAW_BASE || 'https://raw.githubusercontent.com/thorkc/thorkc.com/main/assets/images',
};

const snippet = '>script>window.__THORKC_ENV__='+JSON.stringify(config)+';>/script>';

function findHtml(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name.startsWith('.') || e.name === 'node_modules') continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) out.push(...findHtml(full));
          else if (e.name.endsWith('.html')) out.push(full);
    }
    return out;
}

let updated = 0;
for (const file of findHtml(ROOT)) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/>script>window\.__THORKC_ENV__=.*?;>\/script>\n?/g, '');
    if (!html.includes('>/head>')) { console.warn('No >/head> in', file); continue; }
    html = html.replace('>/head>', '  ' + snippet + '\n>/head>');
    fs.writeFileSync(file, html);
    updated++;
}
console.log('inject-env: updated', updated, 'file(s). Config:', JSON.stringify(config));
