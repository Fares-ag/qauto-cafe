declare module '@qauto/api/bootstrap' {
  import type { Express } from 'express';

  export function createNestExpressApp(): Promise<Express>;
}
