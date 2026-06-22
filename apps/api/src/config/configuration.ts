export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  terminalEnrollmentSecret: process.env.TERMINAL_ENROLLMENT_SECRET ?? '',
  auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS ?? '365', 10),
  healthCheckSecret: process.env.HEALTH_CHECK_SECRET ?? '',
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'menu-images',
  },
  storage: {
    useSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    useLocalUploads: !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
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
