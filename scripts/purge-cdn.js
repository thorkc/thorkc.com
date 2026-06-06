#!/usr/bin/env node
/**
 * ThorKC CDN Cache Purger
 * Invalidates stale cached assets at the CDN edge after upload.
 *
 * Supported CDN providers (set CDN_PURGE_PROVIDER env var):
 *   cloudflare  - Cloudflare Cache Purge API (default)
 *   fastly      - Fastly Instant Purge API
 *   bunny       - Bunny.net Purge API
 *   none        - skip purging
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const UPLOAD_LOG = path.resolve(__dirname, '../.upload-log.json');
const CDN_BASE   = process.env.CDN_BASE_URL || 'https://cdn.thorkc.com';
const PROVIDER   = (process.env.CDN_PURGE_PROVIDER || 'cloudflare').toLowerCase();

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
async function purgeCloudflare(urls) {
  const zoneId = process.env.CF_ZONE_ID;
  const token  = process.env.CF_API_TOKEN;
  if (!zoneId || !token) throw new Error('CF_ZONE_ID and CF_API_TOKEN must be set.');
  for (let i = 0; i < urls.length; i += 30) {
    const batch = urls.slice(i, i + 30);
    const res = await request('POST',
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      { Authorization: `Bearer ${token}` }, { files: batch });
    const parsed = JSON.parse(res.body);
    if (!parsed.success) throw new Error(`CF purge failed: ${JSON.stringify(parsed.errors)}`);
    console.log(`  Purged batch ${Math.floor(i/30)+1} (${batch.length} URLs)`);
  }
}

async function purgeFastly(urls) {
  const token = process.env.FASTLY_API_KEY;
  if (!token) throw new Error('FASTLY_API_KEY must be set.');
  for (const url of urls) {
    const res = await request('PURGE', url, { 'Fastly-Key': token });
    if (res.status !== 200) throw new Error(`Fastly purge failed: HTTP ${res.status}`);
  }
  console.log(`  Purged ${urls.length} URL(s) via Fastly`);
}

async function purgeBunny(urls) {
  const key = process.env.BUNNY_API_KEY;
  if (!key) throw new Error('BUNNY_API_KEY must be set.');
  for (const url of urls) {
    const res = await request('POST',
      `https://api.bunny.net/purge?url=${encodeURIComponent(url)}`, { AccessKey: key });
    if (res.status !== 200) throw new Error(`Bunny purge failed: HTTP ${res.status}`);
  }
  console.log(`  Purged ${urls.length} URL(s) via Bunny.net`);
}

async function main() {
  if (PROVIDER === 'none') { console.log('Skipping CDN purge.'); return; }
  if (!fs.existsSync(UPLOAD_LOG)) { console.log('No upload log - nothing to purge.'); return; }
  const log = JSON.parse(fs.readFileSync(UPLOAD_LOG, 'utf8'));
  const ok  = log.uploads.filter(u => u.status === 'ok');
  if (ok.length === 0) { console.log('No successful uploads - nothing to purge.'); return; }
  const urls = ok.map(u => `${CDN_BASE}/${u.remote}`);
  console.log(`\nPurging ${urls.length} CDN entries via ${PROVIDER}...`);
  if (PROVIDER === 'cloudflare') await purgeCloudflare(urls);
  else if (PROVIDER === 'fastly') await purgeFastly(urls);
  else if (PROVIDER === 'bunny')  await purgeBunny(urls);
  else throw new Error(`Unknown CDN_PURGE_PROVIDER: ${PROVIDER}`);
  console.log('CDN cache purge complete.');
}

main().catch(err => { console.error(`CDN purge error: ${err.message}`); process.exit(1); });
    const parsed  = new URL(url);
    const options = { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method,
      headers: { 'Content-Type': 'application/json', ...headers } };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
