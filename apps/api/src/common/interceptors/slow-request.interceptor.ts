import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

const SLOW_MS = 500;
const HOT_PATH = /\/orders\/|\/pay|\/lines|\/defer|\/void|\/refund|\/menu\/catalog|\/reports\//;

@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logIfSlow(req, started),
        error: () => this.logIfSlow(req, started),
      }),
    );
  }

  private logIfSlow(
    req: { method?: string; url?: string },
    started: number,
  ) {
    const durationMs = Date.now() - started;
    const path = req.url ?? '';
    if (durationMs >= SLOW_MS && HOT_PATH.test(path)) {
      this.logger.warn(`${req.method ?? 'GET'} ${path} ${durationMs}ms`);
    }
  }
}
