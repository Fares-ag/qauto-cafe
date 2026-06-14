import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

export function applySecurityMiddleware(app: INestApplication) {
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
}

export function getWsCorsOrigins(config: ConfigService): string[] | boolean {
  const corsOrigin = config.get<string>('corsOrigin', 'http://localhost:3000');
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return corsOrigin.split(',').map((o) => o.trim());
}
