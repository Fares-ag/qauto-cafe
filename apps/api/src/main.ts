import { ConfigService } from '@nestjs/config';
import { createNestApplication } from './bootstrap';

async function bootstrap() {
  const app = await createNestApplication();
  const port = app.get(ConfigService).get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
