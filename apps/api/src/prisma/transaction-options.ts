/** Interactive transaction defaults — Supabase pooler adds latency vs local Postgres. */
export const PRISMA_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;
