/**
 * Worker Pool Manager
 * Per P-6: Manages a pool of worker threads for CPU-intensive tasks
 * Limits to CPU cores - 1 to avoid blocking the main event loop
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Task queue item
 */
interface QueuedTask {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  task: unknown;
}

/**
 * Worker pool for managing worker threads
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private queue: QueuedTask[] = [];
  private activeTasks = 0;
  private readonly maxWorkers: number;
  private readonly workerPath: string;

  /**
   * Create a new worker pool
   * @param workerPath - Path to worker script
   * @param maxWorkers - Maximum number of workers (defaults to CPU cores - 1)
   */
  constructor(workerPath: string, maxWorkers?: number) {
    this.workerPath = workerPath;
    // Default to CPU cores - 1, minimum 1, maximum 4
    this.maxWorkers = maxWorkers ?? Math.max(1, Math.min(cpus().length - 1, 4));
    logger.info(`Worker pool initialized: ${this.maxWorkers} workers (${cpus().length} CPU cores)`);
  }

  /**
   * Execute a task using the worker pool
   * @param task - Task data to send to worker
   * @returns Promise that resolves with worker result
   */
  async execute<T>(task: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        resolve: (value: unknown) => resolve(value as T),
        reject,
        task,
      });

      // Process queue if we have available workers
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    // Don't process if queue is empty or no available workers
    if (this.queue.length === 0 || this.activeTasks >= this.maxWorkers) {
      return;
    }

    // Get next task
    const queuedTask = this.queue.shift();
    if (!queuedTask) {
      return;
    }

    // Get or create worker
    const worker = this.getAvailableWorker();
    if (!worker) {
      // No worker available, put task back in queue
      this.queue.unshift(queuedTask);
      return;
    }

    this.activeTasks++;

    // Set up message handler
    const messageHandler = (result: { success: boolean; data?: unknown; error?: string }): void => {
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      this.activeTasks--;

      if (result.success && result.data !== undefined) {
        queuedTask.resolve(result.data);
      } else {
        queuedTask.reject(new Error(result.error || 'Worker task failed'));
      }

      // Process next task in queue
      this.processQueue();
    };

    const errorHandler = (error: Error): void => {
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      this.activeTasks--;

      logger.error('Worker error:', error);
      queuedTask.reject(error);

      // Remove failed worker and process next task
      this.removeWorker(worker);
      this.processQueue();
    };

    worker.once('message', messageHandler);
    worker.once('error', errorHandler);

    // Send task to worker
    worker.postMessage(queuedTask.task);
  }

  /**
   * Get an available worker or create a new one
   */
  private getAvailableWorker(): Worker | null {
    // Check for existing workers
    for (const worker of this.workers) {
      if (worker.threadId !== 0) {
        // Worker is alive
        return worker;
      }
    }

    // Create new worker if under limit
    if (this.workers.length < this.maxWorkers) {
      const worker = this.createWorker();
      this.workers.push(worker);
      return worker;
    }

    return null;
  }

  /**
   * Create a new worker thread
   */
  private createWorker(): Worker {
    // Resolve worker path relative to dist directory
    // In production, __dirname points to dist/utils, so we go up one level
    const workerScript = path.resolve(__dirname, this.workerPath);

    // Verify file exists
    if (!existsSync(workerScript)) {
      throw new Error(`Worker script not found: ${workerScript}`);
    }

    const worker = new Worker(workerScript, {
      // Pass environment variables if needed
      env: process.env,
    });

    worker.on('error', (error) => {
      logger.error(`Worker ${worker.threadId} error:`, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.warn(`Worker ${worker.threadId} exited with code ${code}`);
      }
      // Remove worker from pool
      this.removeWorker(worker);
    });

    logger.debug(`Created worker ${worker.threadId}`);
    return worker;
  }

  /**
   * Remove a worker from the pool
   */
  private removeWorker(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      try {
        void worker.terminate().catch((error) => {
          logger.warn(`Error terminating worker ${worker.threadId}:`, error);
        });
      } catch (error) {
        logger.warn(`Error terminating worker ${worker.threadId}:`, error);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { workers: number; activeTasks: number; queuedTasks: number } {
    return {
      workers: this.workers.length,
      activeTasks: this.activeTasks,
      queuedTasks: this.queue.length,
    };
  }

  /**
   * Terminate all workers and clear queue
   */
  async terminate(): Promise<void> {
    logger.info('Terminating worker pool...');

    // Reject all queued tasks
    for (const task of this.queue) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.queue = [];

    // Terminate all workers
    const terminatePromises = this.workers.map((worker) => {
      return worker.terminate();
    });

    await Promise.all(terminatePromises);
    this.workers = [];
    this.activeTasks = 0;

    logger.info('Worker pool terminated');
  }
}
