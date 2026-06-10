import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class CryptoService {
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  generateDeviceToken(): string {
    return `dt_${randomBytes(32).toString('base64url')}`;
  }
}
