#!/usr/bin/env node
/**
 * Pre-deploy sanity check for Vercel + Railway split.
 * Usage: node scripts/check-deploy-env.mjs vercel|api
 */
const mode = process.argv[2];

const vercelRequired = ['NEXT_PUBLIC_API_URL', 'API_PROXY_TARGET', 'NEXT_PUBLIC_WS_URL'];
const apiRequired = [
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'TERMINAL_ENROLLMENT_SECRET',
  'CORS_ORIGIN',
  'NODE_ENV',
];

function check(keys) {
  const missing = keys.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`Missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.API_PROXY_TARGET?.includes('localhost') && mode === 'vercel') {
    console.error('API_PROXY_TARGET must be your public Railway URL in production');
    process.exit(1);
  }
  if (process.env.CORS_ORIGIN?.includes('localhost') && mode === 'api') {
    console.error('CORS_ORIGIN must be your Vercel URL in production');
    process.exit(1);
  }
  console.log(`OK — ${mode} env looks ready`);
}

if (mode === 'vercel') check(vercelRequired);
else if (mode === 'api') check(apiRequired);
else {
  console.error('Usage: node scripts/check-deploy-env.mjs vercel|api');
  process.exit(1);
}
