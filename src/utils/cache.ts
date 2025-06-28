interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTLMs;
    
    // Cleanup expired entries every minute
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cleanup();
      }, 60 * 1000);
    }
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs || this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache hit/miss stats
  getStats() {
    return {
      size: this.cache.size,
      defaultTTL: this.defaultTTL
    };
  }
}

// Create cache instances for different data types
export const routeCache = new MemoryCache(5 * 60 * 1000); // 5 minutes for routes
export const isochroneCache = new MemoryCache(10 * 60 * 1000); // 10 minutes for isochrones
export const healthCache = new MemoryCache(30 * 1000); // 30 seconds for health checks 