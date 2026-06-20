const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
let envFileContent = '';
let parsed = {};

try {
  envFileContent = fs.readFileSync(envPath, 'utf8');
  envFileContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = line.split('=');
    if (!key) return;
    const value = rest.join('=').trim();
    parsed[key.trim()] = value;

    // Load into process.env for this Node process, but do not override existing environment variables
    if (!process.env[key.trim()]) {
      process.env[key.trim()] = value;
    }
  });
} catch (error) {
  console.error('Could not read .env.local:', error.message);
}

const keys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

console.log('=== .env.local values ===');
keys.forEach((key) => {
  const value = parsed[key];
  if (value) {
    console.log(`${key}: ${value.slice(0, 10)}...${value.slice(-8)} (${value.length} chars)`);
  } else {
    console.log(`${key}: <not set>`);
  }
});

console.log('\n=== process.env values ===');
keys.forEach((key) => {
  const value = process.env[key];
  if (value) {
    console.log(`${key}: ${value.slice(0, 10)}...${value.slice(-8)} (${value.length} chars)`);
  } else {
    console.log(`${key}: <not set>`);
  }
});

console.log('\n=== effective values ===');
const effectiveUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL || parsed.NEXT_PUBLIC_SUPABASE_URL || '<not set>';
const effectiveKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || parsed.SUPABASE_ANON_KEY || parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || '<not set>';
console.log(`SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL: ${effectiveUrl === '<not set>' ? effectiveUrl : `${effectiveUrl.slice(0, 10)}...${effectiveUrl.slice(-8)} (${effectiveUrl.length} chars)`}`);
console.log(`SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY: ${effectiveKey === '<not set>' ? effectiveKey : `${effectiveKey.slice(0, 10)}...${effectiveKey.slice(-8)} (${effectiveKey.length} chars)`}`);

if (!effectiveUrl || effectiveUrl === '<not set>' || !effectiveKey || effectiveKey === '<not set>') {
  console.error('\nERROR: Supabase environment variables are not fully configured.');
  process.exit(1);
}

console.log('\nEnvironment variables appear configured.');
