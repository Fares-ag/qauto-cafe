import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';
import { getWsCorsOrigins } from '../config/security';

export class SocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(SocketIoAdapter.name);

  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
    this.logger.log('Socket.IO in-memory adapter enabled');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const corsOrigin = getWsCorsOrigins(this.config);
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigin,
        credentials: true,
      },
    });
  }
}
