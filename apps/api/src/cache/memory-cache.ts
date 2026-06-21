interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/** Process-local TTL cache used when Redis is unavailable. */
export class MemoryCache {
  private readonly store = new Map<string, MemoryEntry>();

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  delMany(keys: string[]): void {
    for (const key of keys) this.store.delete(key);
  }
}
