import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900;

@Injectable()
export class PinLockoutService {
  constructor(private readonly redis: RedisService) {}

  private key(terminalId: string) {
    return `pin-lockout:${terminalId}`;
  }

  async assertNotLocked(terminalId: string) {
    if (!this.redis.client) return;
    const ttl = await this.redis.client.ttl(this.key(terminalId));
    if (ttl > 0) {
      throw new HttpException(
        `PIN locked. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(terminalId: string) {
    if (!this.redis.client) return;
    const key = this.key(terminalId);
    const attempts = await this.redis.client.incr(key);
    if (attempts === 1) {
      await this.redis.client.expire(key, LOCKOUT_SECONDS);
    }
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await this.redis.client.expire(key, LOCKOUT_SECONDS);
      throw new HttpException('Too many failed PIN attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async clear(terminalId: string) {
    if (!this.redis.client) return;
    await this.redis.client.del(this.key(terminalId));
  }
}
