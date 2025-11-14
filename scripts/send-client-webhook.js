#!/usr/bin/env node
// scripts/send-client-webhook.js
// Usage:
//  node scripts/send-client-webhook.js --file payload.json --secret your_secret --url https://example.com/api/webhooks/client

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file' || a === '-f') {
      out.file = args[i+1]; i++;
    } else if (a === '--secret' || a === '-s') {
      out.secret = args[i+1]; i++;
    } else if (a === '--url' || a === '-u') {
      out.url = args[i+1]; i++;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function usage() {
  console.log('Usage:');
  console.log('  node scripts/send-client-webhook.js --file payload.json --secret your_secret --url https://...');
}

(async function main() {
  const args = parseArgs();
  if (args.help || !args.file || !args.secret || !args.url) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  let body;
  try {
    body = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('Could not read file:', filePath);
    console.error(err.message);
    process.exit(2);
  }

  // Trim only trailing newline for convenience
  if (body.endsWith('\n')) body = body.slice(0, -1);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', args.secret).update(message).digest('hex');

  console.log('x-client-timestamp:', timestamp);
  console.log('x-client-signature:', signature);
  console.log('Posting to:', args.url);

  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-timestamp': timestamp,
        'x-client-signature': signature,
      },
      body,
    });

    const text = await res.text();
    console.log('Response status:', res.status);
    try {
      console.log('Response body:', JSON.parse(text));
    } catch (e) {
      console.log('Response body (raw):', text);
    }
    process.exit(res.ok ? 0 : 3);
  } catch (err) {
    console.error('Request failed:', err.message || err);
    process.exit(4);
  }
})();
