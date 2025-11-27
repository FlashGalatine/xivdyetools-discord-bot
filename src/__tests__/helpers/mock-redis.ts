/**
 * Shared mock Redis helpers for testing
 * Provides in-memory Redis mock and optional real Redis integration testing
 */

import { vi } from 'vitest';

/**
 * Pipeline result type matching ioredis
 */
type PipelineResult = [Error | null, unknown][];

/**
 * Mock Redis pipeline for testing
 */
export class MockRedisPipeline {
  private commands: Array<{ command: string; args: unknown[] }> = [];
  private store: Map<string, string>;
  private ttls: Map<string, number>;

  constructor(store: Map<string, string>, ttls: Map<string, number>) {
    this.store = store;
    this.ttls = ttls;
  }

  incr(key: string): this {
    this.commands.push({ command: 'incr', args: [key] });
    return this;
  }

  expire(key: string, seconds: number, _mode?: string): this {
    this.commands.push({ command: 'expire', args: [key, seconds] });
    return this;
  }

  ttl(key: string): this {
    this.commands.push({ command: 'ttl', args: [key] });
    return this;
  }

  get(key: string): this {
    this.commands.push({ command: 'get', args: [key] });
    return this;
  }

  set(key: string, value: string, ...args: unknown[]): this {
    this.commands.push({ command: 'set', args: [key, value, ...args] });
    return this;
  }

  del(key: string): this {
    this.commands.push({ command: 'del', args: [key] });
    return this;
  }

  pfadd(key: string, ...elements: string[]): this {
    this.commands.push({ command: 'pfadd', args: [key, ...elements] });
    return this;
  }

  lpush(key: string, ...values: string[]): this {
    this.commands.push({ command: 'lpush', args: [key, ...values] });
    return this;
  }

  ltrim(key: string, start: number, stop: number): this {
    this.commands.push({ command: 'ltrim', args: [key, start, stop] });
    return this;
  }

  async exec(): Promise<PipelineResult> {
    const results: PipelineResult = [];

    for (const cmd of this.commands) {
      try {
        let result: unknown;
        switch (cmd.command) {
          case 'incr': {
            const key = cmd.args[0] as string;
            const current = parseInt(this.store.get(key) || '0', 10);
            const newValue = current + 1;
            this.store.set(key, String(newValue));
            result = newValue;
            break;
          }
          case 'expire': {
            const key = cmd.args[0] as string;
            const seconds = cmd.args[1] as number;
            if (this.store.has(key)) {
              this.ttls.set(key, Date.now() + seconds * 1000);
              result = 1;
            } else {
              result = 0;
            }
            break;
          }
          case 'ttl': {
            const key = cmd.args[0] as string;
            const expiry = this.ttls.get(key);
            if (expiry) {
              result = Math.ceil((expiry - Date.now()) / 1000);
            } else if (this.store.has(key)) {
              result = -1; // No expiry
            } else {
              result = -2; // Key doesn't exist
            }
            break;
          }
          case 'get': {
            const key = cmd.args[0] as string;
            result = this.store.get(key) ?? null;
            break;
          }
          case 'set': {
            const key = cmd.args[0] as string;
            const value = cmd.args[1] as string;
            this.store.set(key, value);
            // Handle EX argument for TTL
            const exIndex = cmd.args.indexOf('EX');
            if (exIndex !== -1) {
              const ttl = cmd.args[exIndex + 1] as number;
              this.ttls.set(key, Date.now() + ttl * 1000);
            }
            result = 'OK';
            break;
          }
          case 'del': {
            const key = cmd.args[0] as string;
            const existed = this.store.has(key);
            this.store.delete(key);
            this.ttls.delete(key);
            result = existed ? 1 : 0;
            break;
          }
          case 'pfadd': {
            const key = cmd.args[0] as string;
            const elements = cmd.args.slice(1) as string[];
            const existing = this.store.get(key);
            const set = existing ? new Set(JSON.parse(existing) as string[]) : new Set<string>();
            const sizeBefore = set.size;
            elements.forEach((el) => set.add(el));
            this.store.set(key, JSON.stringify(Array.from(set)));
            result = set.size > sizeBefore ? 1 : 0;
            break;
          }
          case 'lpush': {
            const key = cmd.args[0] as string;
            const values = cmd.args.slice(1) as string[];
            const existing = this.store.get(key);
            const list: string[] = existing ? (JSON.parse(existing) as string[]) : [];
            list.unshift(...values.reverse());
            this.store.set(key, JSON.stringify(list));
            result = list.length;
            break;
          }
          case 'ltrim': {
            const key = cmd.args[0] as string;
            const start = cmd.args[1] as number;
            const stop = cmd.args[2] as number;
            const data = this.store.get(key);
            if (data) {
              const list = JSON.parse(data) as string[];
              const actualStop = stop < 0 ? list.length + stop + 1 : stop + 1;
              this.store.set(key, JSON.stringify(list.slice(start, actualStop)));
            }
            result = 'OK';
            break;
          }
          default:
            result = null;
        }
        results.push([null, result]);
      } catch (error) {
        results.push([error as Error, null]);
      }
    }

    return results;
  }
}

/**
 * Mock Redis client for testing
 * Implements common Redis commands with in-memory storage
 */
export class MockRedisClient {
  private store = new Map<string, string>();
  private ttls = new Map<string, number>();
  private eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor() {
    // Emit connect and ready events after construction
    setTimeout(() => {
      this.emit('connect');
      this.emit('ready');
    }, 0);
  }

  // Event handling
  on(event: string, handler: (...args: unknown[]) => void): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => handler(...args));
  }

  // Basic commands
  async get(key: string): Promise<string | null> {
    this.checkExpiry(key);
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    this.store.set(key, value);

    // Handle EX option for TTL
    const exIndex = args.indexOf('EX');
    if (exIndex !== -1) {
      const ttl = args[exIndex + 1] as number;
      this.ttls.set(key, Date.now() + ttl * 1000);
    }

    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        this.ttls.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    this.checkExpiry(key);
    const current = parseInt(this.store.get(key) || '0', 10);
    const newValue = current + 1;
    this.store.set(key, String(newValue));
    return newValue;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.store.has(key)) {
      this.ttls.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const expiry = this.ttls.get(key);
    if (expiry) {
      const remaining = Math.ceil((expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }
    if (this.store.has(key)) {
      return -1; // No expiry
    }
    return -2; // Key doesn't exist
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      this.checkExpiry(key);
      if (this.store.has(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    this.cleanupExpired();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.store.clear();
    this.ttls.clear();
    this.emit('close');
    return 'OK';
  }

  // HyperLogLog commands (simplified)
  async pfadd(key: string, ...elements: string[]): Promise<number> {
    const existing = this.store.get(key);
    const set = existing ? new Set(JSON.parse(existing) as string[]) : new Set<string>();
    const sizeBefore = set.size;
    elements.forEach((el) => set.add(el));
    this.store.set(key, JSON.stringify(Array.from(set)));
    return set.size > sizeBefore ? 1 : 0;
  }

  async pfcount(...keys: string[]): Promise<number> {
    const combined = new Set<string>();
    for (const key of keys) {
      const data = this.store.get(key);
      if (data) {
        (JSON.parse(data) as string[]).forEach((el) => combined.add(el));
      }
    }
    return combined.size;
  }

  // List commands
  async lpush(key: string, ...values: string[]): Promise<number> {
    const existing = this.store.get(key);
    const list: string[] = existing ? (JSON.parse(existing) as string[]) : [];
    list.unshift(...values.reverse());
    this.store.set(key, JSON.stringify(list));
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const data = this.store.get(key);
    if (!data) return [];
    const list = JSON.parse(data) as string[];
    const actualStop = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, actualStop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const data = this.store.get(key);
    if (!data) return 'OK';
    const list = JSON.parse(data) as string[];
    const actualStop = stop < 0 ? list.length + stop + 1 : stop + 1;
    this.store.set(key, JSON.stringify(list.slice(start, actualStop)));
    return 'OK';
  }

  // Pipeline
  pipeline(): MockRedisPipeline {
    return new MockRedisPipeline(this.store, this.ttls);
  }

  // Helper methods
  private checkExpiry(key: string): void {
    const expiry = this.ttls.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.ttls.delete(key);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, expiry] of this.ttls.entries()) {
      if (now > expiry) {
        this.store.delete(key);
        this.ttls.delete(key);
      }
    }
  }

  // Test helpers
  _getStore(): Map<string, string> {
    return this.store;
  }

  _clear(): void {
    this.store.clear();
    this.ttls.clear();
  }
}

/**
 * Create a mock Redis client for testing
 */
export function createMockRedisClient(): MockRedisClient {
  return new MockRedisClient();
}

/**
 * Create vi.fn() mock functions for Redis client
 * Useful when you need to verify specific call patterns
 */
export function createMockRedisClientWithSpies(): {
  client: MockRedisClient;
  spies: Record<string, ReturnType<typeof vi.fn>>;
} {
  const client = new MockRedisClient();
  const spies = {
    get: vi.spyOn(client, 'get'),
    set: vi.spyOn(client, 'set'),
    del: vi.spyOn(client, 'del'),
    incr: vi.spyOn(client, 'incr'),
    expire: vi.spyOn(client, 'expire'),
    pipeline: vi.spyOn(client, 'pipeline'),
    quit: vi.spyOn(client, 'quit'),
  };
  return { client, spies: spies as unknown as Record<string, ReturnType<typeof vi.fn>> };
}

/**
 * Check if Redis integration tests should run
 * Set REDIS_TEST_URL environment variable to enable
 */
export function shouldRunRedisIntegration(): boolean {
  return !!process.env.REDIS_TEST_URL;
}

/**
 * Get Redis URL for integration tests
 */
export function getRedisTestUrl(): string | undefined {
  return process.env.REDIS_TEST_URL;
}

/**
 * Helper to create a test key with prefix to avoid collisions
 */
export function createTestKey(suffix: string): string {
  return `xivdye:test:${Date.now()}:${suffix}`;
}
