#!/usr/bin/env node
/**
 * ThorKC Asset Uploader
 * Reads .processed-assets.json produced by optimize.js and uploads
 * each optimized file to the configured storage provider.
 *
 * Supported providers (set ASSET_STORAGE_PROVIDER env var):
 *   s3        – Amazon S3 / S3-compatible (default)
 *   cloudflare – Cloudflare R2 (S3-compatible, different endpoint)
 *   azure     – Azure Blob Storage
 *
 * Usage:
 *   node scripts/upload.js              # upload only processed-assets report
 *   node scripts/upload.js --all        # re-upload every file in dist/
 *   node scripts/upload.js --dry-run    # print what would be uploaded
 */

const fs   = require('fs');
const path = require('path');

const DIST_DIR    = path.resolve(__dirname, '../dist');
const REPORT_PATH = path.resolve(__dirname, '../.processed-assets.json');
const UPLOAD_LOG  = path.resolve(__dirname, '../.upload-log.json');

// ─── Provider factory ─────────────────────────────────────────────────────────
function getProvider() {
  const provider = (process.env.ASSET_STORAGE_PROVIDER || 's3').toLowerCase();

  if (provider === 's3' || provider === 'cloudflare') {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const clientConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
    // Cloudflare R2 needs a custom endpoint
    if (provider === 'cloudflare') {
      clientConfig.endpoint = `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      clientConfig.region   = 'auto';
    }
    const client = new S3Client(clientConfig);
    const bucket = process.env.ASSET_BUCKET;

    return {
      name: provider === 'cloudflare' ? 'Cloudflare R2' : 'Amazon S3',
      async upload(localPath, remotePath, contentType) {
        const body = fs.readFileSync(localPath);
        await client.send(new PutObjectCommand({
          Bucket:       bucket,
          Key:          remotePath,
          Body:         body,
          ContentType:  contentType,
          CacheControl: 'public, max-age=31536000, immutable',
          Metadata:     { 'x-thorkc-pipeline': 'auto', 'x-upload-ts': new Date().toISOString() },
        }));
      },
    };
  }

  if (provider === 'azure') {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const serviceClient   = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = serviceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME || 'thorkc-assets');

    return {
      name: 'Azure Blob Storage',
      async upload(localPath, remotePath, contentType) {
        const blockBlobClient = containerClient.getBlockBlobClient(remotePath);
        await blockBlobClient.uploadFile(localPath, {
          blobHTTPHeaders: {
            blobContentType:        contentType,
            blobCacheControl:       'public, max-age=31536000, immutable',
          },
          metadata: { thorkcPipeline: 'auto', uploadTs: new Date().toISOString() },
        });
      },
    };
  }

  throw new Error(`Unknown ASSET_STORAGE_PROVIDER: ${provider}`);
}

// ─── MIME helpers ─────────────────────────────────────────────────────────────
const MIME = {
  '.webp':  'image/webp',
  '.avif':  'image/avif',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.png':   'image/png',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.pdf':   'application/pdf',
  '.json':  'application/json',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.txt':   'text/plain',
};

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

// Section → CDN path prefix mapping
function remoteKey(distRelPath) {
  // e.g.  homepage/hero.webp  →  assets/homepage/hero.webp
  return `assets/${distRelPath.replace(/\\/g, '/')}`;
}

// ─── Walk dist ────────────────────────────────────────────────────────────────
function walkDist(dir, files = [], base = dir) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDist(full, files, base);
    else files.push(path.relative(base, full));
  }
  return files;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const forceAll = args.includes('--all');

  // Determine file set to upload
  let filesToUpload = [];
  if (forceAll) {
    filesToUpload = walkDist(DIST_DIR);
    console.log(`\n📦  Full re-upload: ${filesToUpload.length} file(s) in dist/`);
  } else {
    if (!fs.existsSync(REPORT_PATH)) {
      console.log('ℹ️   No processed-assets report found — run optimize.js first.');
      process.exit(0);
    }
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    filesToUpload = report.assets.flatMap(a => a.dist);
    console.log(`\n📦  Uploading ${filesToUpload.length} optimized asset(s) from last run…`);
  }

  if (filesToUpload.length === 0) {
    console.log('✅  Nothing to upload.');
    return;
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would upload:');
    filesToUpload.forEach(f => console.log(`  → ${remoteKey(f)}`));
    return;
  }

  const provider = getProvider();
  console.log(`\n☁️   Provider: ${provider.name}\n`);

  const log = { timestamp: new Date().toISOString(), provider: provider.name, uploads: [] };
  let ok = 0, failed = 0;

  for (const rel of filesToUpload) {
    const localPath  = path.join(DIST_DIR, rel);
    const remotePath = remoteKey(rel);
    const mime       = mimeOf(rel);

    try {
      await provider.upload(localPath, remotePath, mime);
      console.log(`  ✔  ${remotePath}`);
      log.uploads.push({ file: rel, remote: remotePath, status: 'ok' });
      ok++;
    } catch (err) {
      console.error(`  ✖  ${remotePath}: ${err.message}`);
      log.uploads.push({ file: rel, remote: remotePath, status: 'error', error: err.message });
      failed++;
    }
  }

  fs.writeFileSync(UPLOAD_LOG, JSON.stringify(log, null, 2));
  console.log(`\n✅  Upload complete: ${ok} succeeded, ${failed} failed → .upload-log.json`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
