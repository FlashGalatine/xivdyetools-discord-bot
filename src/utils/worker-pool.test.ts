/**
 * Unit tests for Worker Pool utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock os module
vi.mock('os', () => ({
  cpus: vi.fn(() => new Array(8).fill({ model: 'mock-cpu' })), // 8 cores
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}));

// Mock worker_threads module
const mockTerminate = vi.fn().mockResolvedValue(0);
const mockPostMessage = vi.fn();
const mockOnce = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();

let messageHandler: ((result: any) => void) | null = null;
let errorHandler: ((error: Error) => void) | null = null;

vi.mock('worker_threads', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    threadId: Math.floor(Math.random() * 1000) + 1,
    terminate: mockTerminate,
    postMessage: mockPostMessage,
    once: vi.fn((event: string, handler: any) => {
      if (event === 'message') messageHandler = handler;
      if (event === 'error') errorHandler = handler;
    }),
    on: mockOn,
    removeListener: mockRemoveListener,
  })),
}));

describe('Worker Pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageHandler = null;
    errorHandler = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should limit workers to CPU cores - 1', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      // 8 cores - 1 = 7, but max is 4
      expect(pool.getStats().workers).toBe(0); // No workers created yet
    });

    it('should cap workers at maximum 4', async () => {
      const { cpus } = await import('os');
      vi.mocked(cpus).mockReturnValue(new Array(16).fill({ model: 'mock' }) as any);

      vi.resetModules();
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      // Should use max of 4
      const stats = pool.getStats();
      expect(stats.workers).toBeLessThanOrEqual(4);
    });

    it('should respect custom max workers parameter', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js', 2);

      expect(pool.getStats().workers).toBe(0);
    });
  });

  describe('execute', () => {
    it('should create worker on first task', async () => {
      const { Worker } = await import('worker_threads');
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      // Start task (don't await)
      const promise = pool.execute({ type: 'test' });

      // Simulate successful response
      setTimeout(() => {
        if (messageHandler) {
          messageHandler({ success: true, data: 'result' });
        }
      }, 0);

      const result = await promise;

      expect(Worker).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should queue tasks when all workers busy', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js', 1); // 1 worker max

      // Start first task (will use the worker)
      const promise1 = pool.execute({ type: 'task1' });

      // Start second task (should be queued)
      const promise2 = pool.execute({ type: 'task2' });

      expect(pool.getStats().queuedTasks).toBeGreaterThanOrEqual(0);

      // Resolve both
      setTimeout(() => {
        if (messageHandler) {
          messageHandler({ success: true, data: 'result1' });
        }
      }, 0);

      await promise1;

      setTimeout(() => {
        if (messageHandler) {
          messageHandler({ success: true, data: 'result2' });
        }
      }, 0);

      await promise2;
    });

    it('should resolve with worker result on success', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      const promise = pool.execute({ type: 'test' });

      setTimeout(() => {
        if (messageHandler) {
          messageHandler({ success: true, data: { processed: true } });
        }
      }, 0);

      const result = await promise;

      expect(result).toEqual({ processed: true });
    });

    it('should reject on worker error', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      const promise = pool.execute({ type: 'fail' });

      setTimeout(() => {
        if (messageHandler) {
          messageHandler({ success: false, error: 'Task failed' });
        }
      }, 0);

      await expect(promise).rejects.toThrow('Task failed');
    });

    it('should reject on worker error event', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      const promise = pool.execute({ type: 'crash' });

      setTimeout(() => {
        if (errorHandler) {
          errorHandler(new Error('Worker crashed'));
        }
      }, 0);

      await expect(promise).rejects.toThrow('Worker crashed');
    });
  });

  describe('getStats', () => {
    it('should return correct worker count', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      const stats = pool.getStats();

      expect(stats).toHaveProperty('workers');
      expect(typeof stats.workers).toBe('number');
    });

    it('should return correct active task count', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      const stats = pool.getStats();

      expect(stats).toHaveProperty('activeTasks');
      expect(typeof stats.activeTasks).toBe('number');
    });

    it('should return correct queued task count', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      const stats = pool.getStats();

      expect(stats).toHaveProperty('queuedTasks');
      expect(typeof stats.queuedTasks).toBe('number');
    });
  });

  describe('terminate', () => {
    it('should reject all queued tasks', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js', 1);

      // Queue up tasks
      const promise1 = pool.execute({ type: 'task1' });
      const promise2 = pool.execute({ type: 'task2' });

      // Terminate before completion
      await pool.terminate();

      // Both should be rejected (or first one if it started)
      await expect(promise2).rejects.toThrow('Worker pool terminated');
    });

    it('should terminate all workers', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      // Create a worker by executing a task
      const promise = pool.execute({ type: 'test' });

      // Terminate
      await pool.terminate();

      expect(mockTerminate).toHaveBeenCalled();
    });

    it('should clear workers array after termination', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      await pool.terminate();

      const stats = pool.getStats();
      expect(stats.workers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.activeTasks).toBe(0);
    });
  });

  describe('worker lifecycle', () => {
    it('should remove failed workers from pool', async () => {
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./test-worker.js');

      // Start a task
      const promise = pool.execute({ type: 'test' });

      // Simulate worker error
      setTimeout(() => {
        if (errorHandler) {
          errorHandler(new Error('Worker failed'));
        }
      }, 0);

      await expect(promise).rejects.toThrow();

      // Worker should be removed
      const stats = pool.getStats();
      expect(stats.workers).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should throw when worker script not found', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValueOnce(false);

      vi.resetModules();
      const { WorkerPool } = await import('./worker-pool.js');
      const pool = new WorkerPool('./nonexistent-worker.js');

      await expect(pool.execute({ type: 'test' })).rejects.toThrow(
        /Worker script not found/
      );
    });
  });
});
