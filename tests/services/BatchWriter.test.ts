/**
 * BatchWriter.test.ts
 *
 * Unit tests for the BatchWriter class.
 * Tests batch writing, scheduling, and flush operations.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BatchWriter } from '../../src/services/database/BatchWriter.js';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_WAL_DIR = './data/test-wal';

function cleanupTestDir() {
  try {
    if (existsSync(TEST_WAL_DIR)) {
      rmSync(TEST_WAL_DIR, { recursive: true, force: true });
    }
  } catch {}
}

describe('BatchWriter', () => {
  let batchWriter: BatchWriter;
  let mockWriteCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanupTestDir();
    mockWriteCallback = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    batchWriter = new BatchWriter(mockWriteCallback as any, './data/test.json');
    batchWriter.resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupTestDir();
  });

  describe('schedule', () => {
    it('should schedule a write operation', () => {
      batchWriter.schedule('users', 'user1', { name: 'Test' });

      expect(batchWriter.getPendingCount()).toBe(1);
    });

    it('should update existing key in batch', () => {
      batchWriter.schedule('users', 'user1', { name: 'Test 1' });
      batchWriter.schedule('users', 'user1', { name: 'Test 2' });

      expect(batchWriter.getPendingCount()).toBe(1);
    });

    it('should handle multiple collections', () => {
      batchWriter.schedule('users', 'user1', { name: 'User' });
      batchWriter.schedule('groups', 'group1', { name: 'Group' });

      expect(batchWriter.getPendingCount()).toBe(2);
    });
  });

  describe('flushNow', () => {
    it('should flush pending writes immediately', async () => {
      batchWriter.schedule('users', 'user1', { name: 'Test' });

      await batchWriter.flushNow();

      expect(mockWriteCallback).toHaveBeenCalledTimes(1);
      expect(mockWriteCallback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            collection: 'users',
            key: 'user1',
            value: { name: 'Test' },
          }),
        ]),
      );
      expect(batchWriter.getPendingCount()).toBe(0);
    });

    it('should not flush if no pending writes', async () => {
      await batchWriter.flushNow();

      expect(mockWriteCallback).not.toHaveBeenCalled();
    });

    it('should not allow concurrent flush', async () => {
      vi.useFakeTimers();

      let flushResolve!: () => void;
      mockWriteCallback = vi.fn<() => Promise<void>>().mockImplementation(() => {
        return new Promise<void>(resolve => {
          flushResolve = resolve;
        });
      });

      batchWriter = new BatchWriter(mockWriteCallback as any, './data/test2.json');
      batchWriter.schedule('users', 'user1', { name: 'Test' });

      const flush1 = batchWriter.flushNow();
      const flush2 = batchWriter.flushNow();

      // Concurrent flush returns early (isWriting guard); await the assertion
      // explicitly so this stays valid when Vitest 3 stops auto-awaiting.
      await expect(flush2).resolves.toBeUndefined();

      flushResolve();
      await flush1;
    });

    it('should restore writes on error', async () => {
      mockWriteCallback = vi.fn().mockRejectedValue(new Error('Write error')) as any;
      batchWriter = new BatchWriter(
        mockWriteCallback as (writes: any[]) => Promise<void>,
        './data/test3.json',
      );

      batchWriter.schedule('users', 'user1', { name: 'Test' });

      await batchWriter.flushNow();

      expect(batchWriter.getPendingCount()).toBe(1);
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 for empty batch', () => {
      expect(batchWriter.getPendingCount()).toBe(0);
    });

    it('should return correct count after scheduling', () => {
      batchWriter.schedule('users', 'user1', { name: 'Test 1' });
      batchWriter.schedule('users', 'user2', { name: 'Test 2' });
      batchWriter.schedule('groups', 'group1', { name: 'Test 3' });

      expect(batchWriter.getPendingCount()).toBe(3);
    });
  });

  describe('hasPendingWrites', () => {
    it('should return false for empty batch', () => {
      expect(batchWriter.hasPendingWrites()).toBe(false);
    });

    it('should return true when writes are pending', () => {
      batchWriter.schedule('users', 'user1', { name: 'Test' });
      expect(batchWriter.hasPendingWrites()).toBe(true);
    });
  });
});
