export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  terminalEnrollmentSecret: process.env.TERMINAL_ENROLLMENT_SECRET ?? '',
  workerEnabled: process.env.WORKER_ENABLED !== 'false',
  bullmqEnabled: resolveBullmqEnabled(process.env.BULLMQ_ENABLED, process.env.REDIS_URL),
  auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS ?? '365', 10),
  healthCheckSecret: process.env.HEALTH_CHECK_SECRET ?? '',
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },
  refreshCookieName: 'qauto_refresh',
  accessCookieName: 'qauto_access',
});

/** BullMQ workers poll Redis continuously; Upstash free tier cannot sustain that load. */
function resolveBullmqEnabled(explicit: string | undefined, redisUrl: string | undefined): boolean {
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  const url = redisUrl ?? '';
  if (url.includes('upstash.io')) return false;
  return true;
}
