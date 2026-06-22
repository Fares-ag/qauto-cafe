const DEV_ACCESS_SECRET = 'dev-access-secret-change-in-production';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-in-production';

export function validateProductionConfig() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'production') {
    return;
  }

  const errors: string[] = [];

  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET === DEV_ACCESS_SECRET) {
    errors.push('JWT_ACCESS_SECRET must be set to a strong value in production');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === DEV_REFRESH_SECRET) {
    errors.push('JWT_REFRESH_SECRET must be set to a strong value in production');
  }
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required in production');
  }
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.includes('localhost')) {
    errors.push('CORS_ORIGIN must be set to production web origin(s)');
  }
  if (!process.env.TERMINAL_ENROLLMENT_SECRET || process.env.TERMINAL_ENROLLMENT_SECRET.length < 16) {
    errors.push('TERMINAL_ENROLLMENT_SECRET must be at least 16 characters in production');
  }
  if (!process.env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is required in production');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production');
  }

  if (errors.length) {
    throw new Error(`Production configuration invalid:\n- ${errors.join('\n- ')}`);
  }
}
