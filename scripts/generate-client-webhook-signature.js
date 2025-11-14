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
    } else if (a === '--payload' || a === '-p') {
      out.payload = args[i+1]; i++;
    } else if (a === '--secret' || a === '-s') {
      out.secret = args[i+1]; i++;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function usage() {
  console.log('Usage:');
  console.log("  node scripts/generate-client-webhook-signature.js --file payload.json --secret your_secret");
}

(async function main() {
  const args = parseArgs();
  if (args.help || (!args.file && !args.payload) || !args.secret) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  let body;
  if (args.file) {
    const filePath = path.resolve(process.cwd(), args.file);
    try {
      body = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error('Could not read file:', filePath);
      console.error(err.message);
      process.exit(2);
    }
  } else {
    body = args.payload;
  }

  // Trim only trailing newline for convenience; don't reformat JSON otherwise
  if (body.endsWith('\n')) body = body.slice(0, -1);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}.${body}`;
  const hmac = crypto.createHmac('sha256', args.secret).update(message).digest('hex');

  console.log('x-client-timestamp:', timestamp);
  console.log('x-client-signature:', hmac);
  console.log('\nCopy these header values into Insomnia as:');
  console.log("  x-client-timestamp: <timestamp>");
  console.log("  x-client-signature: <hex signature>");
  console.log('\nMake sure the request body in Insomnia is exactly the same content as the file or payload you used to compute the signature.');
})();
