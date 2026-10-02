/**
 * RealTimeMessageProcessor.ts
 *
 * Concurrency controller for inbound message handling.
 *
 * Two queues are kept instead of one because WhatsApp traffic has two distinct
 * concurrency requirements:
 *
 * - **Sequential** messages (most commands, anything mutating shared state such
 *   as the economy) run strictly one at a time, in FIFO arrival order.
 * - **Parallelizable** messages (read-only lookups, marked by the command's
 *   `parallelizable` flag) run with a small fixed cap so a burst cannot saturate
 *   the event loop or trip WhatsApp's rate limits.
 *
 * It also acts as an in-flight deduplicator: a message ID already being handled
 * is rejected outright, so a reconnect that re-delivers the same message cannot
 * execute its command twice.
 *
 * Emits: `processed` (id) after each success, `error` (id, error) on failure.
 * Listeners are attached in WhatsAppClient to update statistics.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { EventEmitter } from 'events';

/** One unit of work waiting to run. */
interface QueuedMessage {
  id: string;
  handler: () => Promise<void>;
  parallel?: boolean;
}

export class RealTimeMessageProcessor extends EventEmitter {
  /** IDs currently executing, used to reject duplicate submissions. */
  private processing = new Set<string>();
  private sequentialQueue: QueuedMessage[] = [];
  private parallelQueue: QueuedMessage[] = [];
  /** Guard flag preventing a second sequential drain loop from starting. */
  private isProcessingSequential = false;
  private maxParallel = 3;
  private activeParallel = 0;

  /**
   * Enqueues a message handler on the queue matching its concurrency class.
   *
   * @param messageId Dedup key; a second submission while in flight is ignored.
   * @param handler Work to run once a slot is available.
   * @param parallel Route to the capped parallel queue instead of sequential.
   * @returns False when the message ID is already in flight, true otherwise.
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
   * Drains the sequential queue in strict FIFO order, one item at a time.
   *
   * The `isProcessingSequential` guard makes re-entrancy harmless: if a second
   * drain is requested while one is awaiting a handler, it returns immediately
   * and the in-flight loop will pick up any newly queued items itself.
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

  /** Queue snapshot used by the client's periodic maintenance log and the panel. */
  getStats() {
    return {
      processing: this.processing.size,
      sequentialQueued: this.sequentialQueue.length,
      parallelQueued: this.parallelQueue.length,
      activeParallel: this.activeParallel,
    };
  }
}
