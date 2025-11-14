#!/usr/bin/env node
// scripts/load-test-webhook.js
// Usage:
// node scripts/load-test-webhook.js --url <WEBHOOK_URL> --secret <SECRET> --total 1000 --concurrency 200 --size 1024

const crypto = require('crypto');
const { argv } = require('process');

function parseArgs() {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--secret') out.secret = argv[++i];
    else if (a === '--total') out.total = parseInt(argv[++i], 10);
    else if (a === '--concurrency') out.concurrency = parseInt(argv[++i], 10);
    else if (a === '--size') out.size = parseInt(argv[++i], 10);
    else if (a === '--delay') out.delay = parseInt(argv[++i], 10);
  }
  return out;
}

const { url, secret, total = 1000, concurrency = 200, size = 1024, delay = 0 } = parseArgs();

if (!url || !secret) {
  console.error('Usage: node scripts/load-test-webhook.js --url <WEBHOOK_URL> --secret <SECRET> --total 1000 --concurrency 200 --size 1024');
  process.exit(1);
}

function makePayload(i, size) {
  const now = new Date();
  const started = new Date(now.getTime() - 5000).toISOString();
  const completed = now.toISOString();
  const meta = { r: crypto.randomBytes(Math.max(1, Math.floor(size / 8))).toString('hex') };
  return {
    eventId: `lt-${Date.now()}-${i}`,
    eventType: 'token_use',
    timestamp: now.toISOString(),
    startedAt: started,
    completedAt: completed,
    tokenId: `t-${i}`,
    userId: `u-${i}`,
    action_name: 'use',
    durationMs: 5000,
    payload: meta,
  };
}

async function sendOne(i) {
  const payload = makePayload(i, size);
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-timestamp': ts,
        'x-client-signature': sig,
      },
      body,
    });
    const text = await res.text();
    const dur = Date.now() - start;
    return { ok: res.ok, status: res.status, body: text, dur };
  } catch (err) {
    const dur = Date.now() - start;
    return { ok: false, error: err.message || err, dur };
  }
}

async function run() {
  console.log(`Load test starting: url=${url} total=${total} concurrency=${concurrency} size≈${size} bytes`);
  const results = [];

  const indices = Array.from({ length: total }, (_, i) => i + 1);
  // process in chunks to limit concurrency
  while (indices.length) {
    const chunk = indices.splice(0, concurrency);
    const promises = chunk.map((i) => sendOne(i));
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  const success = results.filter((r) => r.ok).length;
  const failed = results.length - success;
  const avg = Math.round(results.reduce((s, r) => s + (r.dur || 0), 0) / results.length);

  console.log('Load test finished');
  console.log(`Total: ${results.length}, Success: ${success}, Failed: ${failed}, Avg ms: ${avg}`);

  const statusCounts = results.reduce((acc, r) => {
    const k = r.status || 'err';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  console.log('Status counts:', statusCounts);

  const errors = results.filter((r) => !r.ok).slice(0, 10);
  if (errors.length) {
    console.log('Sample errors:');
    errors.forEach((e, i) => console.log(i + 1, e));
  }
}

run().catch((e) => {
  console.error('Load test failed:', e);
  process.exit(2);
});
