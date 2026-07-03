#!/usr/bin/env node
/**
   * upload-to-r2.js
   * Uploads optimized assets from assets/images/ to Cloudflare R2.
   * Hash-based deduplication: skips unchanged files.
   */
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!ACCOUNT_ID || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    console.error('Missing R2 credentials.');
    process.exit(1);
}

const client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

function fileHash(p) {
    return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
}
function mime(ext) {
    return ({ webp:'image/webp', avif:'image/avif', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', svg:'image/svg+xml', ico:'image/x-icon' })[ext.toLowerCase()] || 'application/octet-stream';
}
async function remoteETag(key) {
    try { const r = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return (r.ETag||'').replace(/"/g,''); }
    catch { return null; }
}

async function uploadAll() {
    if (!fs.existsSync(ASSETS_DIR)) { console.log('No assets dir  skipping.'); return; }
    const files = fs.readdirSync(ASSETS_DIR).filter(f => /\.(webp|avif|png|jpe?g|svg|ico)$/i.test(f));
    let uploaded = 0, skipped = 0;
    for (const file of files) {
          const fp = path.join(ASSETS_DIR, file);
          const local = fileHash(fp);
          const remote = await remoteETag(file);
          if (remote && remote === local) { skipped++; continue; }
          await client.send(new PutObjectCommand({
                  Bucket: BUCKET, Key: file,
                  Body: fs.readFileSync(fp),
                  ContentType: mime(path.extname(file).slice(1)),
                  CacheControl: 'public, max-age=31536000, immutable',
          }));
          console.log('Uploaded: ' + file);
          uploaded++;
    }
    console.log('Done. Uploaded: ' + uploaded + ', Skipped: ' + skipped);
}

uploadAll().catch(err => { console.error(err); process.exit(1); });
