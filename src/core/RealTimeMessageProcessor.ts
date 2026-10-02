import { EventEmitter } from 'events';

interface QueuedMessage {
  id: string;
  handler: () => Promise<void>;
  parallel?: boolean;
}

/**
 * Processes messages with configurable parallel and sequential queues.
 * Extends EventEmitter to emit 'processed' and 'error' events.
 */
export class RealTimeMessageProcessor extends EventEmitter {
  private processing = new Set<string>();
  private sequentialQueue: QueuedMessage[] = [];
  private parallelQueue: QueuedMessage[] = [];
  private isProcessingSequential = false;
  private maxParallel = 3;
  private activeParallel = 0;

  /**
   * Queues a message for processing.
   *
   * @param messageId - Unique identifier for the message.
   * @param handler - Async function to process the message.
   * @param parallel - Whether to process in parallel queue (default: false).
   * @returns True if queued, false if messageId is already being processed.
   */
  async process(
    messageId: string,
    handler: () => Promise<void>,
    parallel = false,
  ): Promise<boolean> {
    if (this.processing.has(messageId)) return false;
    if (parallel) {
      this.parallelQueue.push({ id: messageId, handler, parallel: true });
    } else {
      this.sequentialQueue.push({ id: messageId, handler, parallel: false });
    }
    // Schedule per-item instead of "drain the whole queue" calls: a burst of
    // messages used to call processParallelQueue() repeatedly while it was
    // still awaiting, spawning N+1 concurrent loops that each shifted an item
    // off the queue and broke the maxParallel cap (and FIFO order).
    setImmediate(() => {
      if (parallel) {
        void this.processParallelQueue();
      } else {
        void this.processSequentialQueue();
      }
    });
    return true;
  }

  /**
   * Processes the next item in the parallel queue.
   * Maintains concurrency limit via activeParallel counter.
   *
   * @returns A promise that resolves when the item is processed.
   */
  private async processParallelQueue(): Promise<void> {
    // One item per call: the finally block re-invokes this when a slot frees
    // up, so the concurrency cap can never be exceeded.
    if (this.activeParallel >= this.maxParallel || this.parallelQueue.length === 0) return;
    const item = this.parallelQueue.shift();
    if (!item) return;
    this.activeParallel++;
    this.processing.add(item.id);
    try {
      await item.handler();
      this.emit('processed', item.id);
    } catch (error) {
      this.emit('error', item.id, error);
    } finally {
      this.processing.delete(item.id);
      this.activeParallel--;
      if (this.parallelQueue.length > 0) {
        setImmediate(() => void this.processParallelQueue());
      }
    }
  }

  /**
   * Processes the sequential queue one item at a time.
   * Ensures FIFO order for sequential messages.
   *
   * @returns A promise that resolves when the queue is empty.
   */
  private async processSequentialQueue(): Promise<void> {
    if (this.isProcessingSequential) return;
    if (this.sequentialQueue.length === 0) return;
    this.isProcessingSequential = true;
    try {
      while (this.sequentialQueue.length > 0) {
        const item = this.sequentialQueue.shift();
        if (!item) break;
        this.processing.add(item.id);
        try {
          await item.handler();
          this.emit('processed', item.id);
        } catch (error) {
          this.emit('error', item.id, error);
        } finally {
          this.processing.delete(item.id);
        }
      }
    } finally {
      this.isProcessingSequential = false;
    }
  }

  /**
   * Gets current queue statistics.
   *
   * @returns An object with queue sizes and processing counts.
   */
  getStats() {
    return {
      processing: this.processing.size,
      sequentialQueued: this.sequentialQueue.length,
      parallelQueued: this.parallelQueue.length,
      activeParallel: this.activeParallel,
    };
  }
}