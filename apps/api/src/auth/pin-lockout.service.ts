import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900;

interface LockoutEntry {
  attempts: number;
  lockedUntil: number;
}

@Injectable()
export class PinLockoutService {
  private readonly store = new Map<string, LockoutEntry>();

  private getEntry(terminalId: string): LockoutEntry {
    const entry = this.store.get(terminalId);
    if (!entry) return { attempts: 0, lockedUntil: 0 };
    if (entry.lockedUntil > 0 && Date.now() >= entry.lockedUntil) {
      this.store.delete(terminalId);
      return { attempts: 0, lockedUntil: 0 };
    }
    return entry;
  }

  async assertNotLocked(terminalId: string) {
    const entry = this.getEntry(terminalId);
    if (entry.lockedUntil > Date.now()) {
      const ttl = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
      throw new HttpException(
        `PIN locked. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(terminalId: string) {
    const entry = this.getEntry(terminalId);
    const attempts = entry.attempts + 1;
    const lockedUntil =
      attempts >= MAX_PIN_ATTEMPTS ? Date.now() + LOCKOUT_SECONDS * 1000 : entry.lockedUntil;
    this.store.set(terminalId, { attempts, lockedUntil });

    if (attempts >= MAX_PIN_ATTEMPTS) {
      throw new HttpException('Too many failed PIN attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async clear(terminalId: string) {
    this.store.delete(terminalId);
  }
}
