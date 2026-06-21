#!/usr/bin/env node
/**
 * Build a Railway-ready .env for @qauto/api from local .env + generated production secrets.
 * Output: deploy/.railway-api.env.local (gitignored)
 *
 * Usage:
 *   node scripts/generate-railway-api-env.mjs
 *   node scripts/generate-railway-api-env.mjs --cors-origin https://your-app.vercel.app
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const outPath = join(root, 'deploy', '.railway-api.env.local');

function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (!existsSync(envPath)) {
  console.error('Missing .env — copy .env.example and configure Supabase URLs first.');
  process.exit(1);
}

const local = parseEnv(readFileSync(envPath, 'utf8'));
const corsOrigin = arg('--cors-origin') ?? 'https://qauto-cafe.vercel.app';

const required = ['DATABASE_URL', 'DIRECT_URL'];
const missing = required.filter((k) => !local[k]?.trim());
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

if (local.DATABASE_URL.includes('localhost')) {
  console.error('DATABASE_URL still points at localhost — set Supabase pooler URLs in .env first.');
  process.exit(1);
}

const lines = [
  'NODE_ENV=production',
  `DATABASE_URL=${local.DATABASE_URL}`,
  `DIRECT_URL=${local.DIRECT_URL}`,
  `JWT_ACCESS_SECRET=${secret()}`,
  `JWT_REFRESH_SECRET=${secret()}`,
  `TERMINAL_ENROLLMENT_SECRET=${secret(24)}`,
  `CORS_ORIGIN=${corsOrigin}`,
];

writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
console.log('');
console.log('Option A — Railway dashboard: @qauto/api → Variables → paste file contents');
console.log('Option B — CLI after `railway login` and `railway link`:');
console.log(`  railway variables --set --skip-deploys < "${outPath.replace(/\\/g, '/')}"`);
