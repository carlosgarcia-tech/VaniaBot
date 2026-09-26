/**
 * ChatSummaryService.test.ts
 *
 * Unit tests for the ChatSummaryService. The JsonFileStore is mocked so no
 * test touches the real database/ directory; the mocks let us verify the
 * debounced persistence schedule (writes coalesced once per second), the
 * flush() escape hatch, and that disk errors never break message intake.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatSummaryService } from '../../src/services/chat/ChatSummaryService.js';
import type { ChatMessage } from '../../src/services/chat/ChatSummaryService.js';

// --- Module mocks ----------------------------------------------------------

const { mockSave, mockLoad } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockLoad: vi.fn(),
}));

vi.mock('../../src/utils/JsonFileStore.js', () => ({
  JsonFileStore: class {
    load = mockLoad;
    save = mockSave;
    constructor(_options: unknown) {}
  },
}));

// --- Fixtures --------------------------------------------------------------

const GROUP_JID = '120363012345678888@g.us';
const OTHER_JID = '120363099999999999@g.us';

/** Hard cap from ChatSummaryService (module-private constant). */
const MAX_BUFFER_PER_GROUP = 260;

const makeMessage = (sender: string, text: string): ChatMessage => ({
  sender,
  text,
  at: new Date('2026-01-01T10:00:00.000Z').toISOString(),
});

const makeService = (): ChatSummaryService => new ChatSummaryService();

// --- Tests -----------------------------------------------------------------

describe('ChatSummaryService', () => {
  let service: ChatSummaryService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSave.mockReset();
    mockLoad.mockReset().mockReturnValue({
      trackedSince: '2026-01-01T00:00:00.000Z',
      groups: {},
    });
    service = makeService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounced persistence', () => {
    it('does not write to disk synchronously when a message arrives', () => {
      service.addMessage(GROUP_JID, 'Alice', 'hola');

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('coalesces a burst of messages into a single write', async () => {
      for (let i = 0; i < 10; i++) {
        service.addMessage(GROUP_JID, `User${i}`, `mensaje ${i}`);
      }

      await vi.advanceTimersByTimeAsync(1000);

      expect(mockSave).toHaveBeenCalledTimes(1);
      // The single write must contain every message of the burst.
      const savedStore = mockSave.mock.calls[0][0] as {
        groups: Record<string, Array<{ text: string }>>;
      };
      expect(savedStore.groups[GROUP_JID]).toHaveLength(10);
    });

    it('includes messages added mid-window in the pending write', async () => {
      service.addMessage(GROUP_JID, 'Alice', 'primero');
      await vi.advanceTimersByTimeAsync(500);
      service.addMessage(GROUP_JID, 'Bob', 'segundo');
      await vi.advanceTimersByTimeAsync(600);

      expect(mockSave).toHaveBeenCalledTimes(1);
      const savedStore = mockSave.mock.calls[0][0] as {
        groups: Record<string, Array<{ text: string }>>;
      };
      expect(savedStore.groups[GROUP_JID]).toHaveLength(2);
    });

    it('schedules a new write for messages added after the previous one fired', async () => {
      service.addMessage(GROUP_JID, 'Alice', 'primero');
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockSave).toHaveBeenCalledTimes(1);

      service.addMessage(GROUP_JID, 'Bob', 'segundo');
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockSave).toHaveBeenCalledTimes(2);
    });

    it('keeps working when the disk write throws', async () => {
      mockSave.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      service.addMessage(GROUP_JID, 'Alice', 'hola');

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockSave).toHaveBeenCalledTimes(1);

      // The service must keep accepting messages and schedule new writes.
      service.addMessage(GROUP_JID, 'Bob', 'de nuevo');
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('flush', () => {
    it('persists immediately and cancels the pending timer', async () => {
      service.addMessage(GROUP_JID, 'Alice', 'hola');

      service.flush();

      expect(mockSave).toHaveBeenCalledTimes(1);

      // The debounced timer must not fire again afterwards.
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('saves even when there is no pending timer', () => {
      service.flush();

      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('buffer cap', () => {
    it(`keeps at most ${MAX_BUFFER_PER_GROUP} messages per group`, () => {
      for (let i = 0; i < 300; i++) {
        service.addMessage(GROUP_JID, 'Alice', `msg ${i}`);
      }

      // Requesting more than the cap still returns only the capped window.
      const summary = service.getSummary(GROUP_JID, 300);
      expect(summary?.count).toBe(MAX_BUFFER_PER_GROUP);
    });

    it('drops the oldest messages, keeping the most recent ones', () => {
      for (let i = 0; i < 300; i++) {
        service.addMessage(GROUP_JID, 'Alice', `msg ${i}`);
      }

      const summary = service.getSummary(GROUP_JID, 5);
      expect(summary?.highlights.map(h => h.split(': ')[1])).toEqual([
        'msg 295',
        'msg 296',
        'msg 297',
        'msg 298',
        'msg 299',
      ]);
    });
  });

  describe('addMessage normalization', () => {
    it('collapses whitespace in text and sender', () => {
      service.addMessage(GROUP_JID, '  Alice  ', '  hola\n  mundo  ');

      const summary = service.getSummary(GROUP_JID);
      expect(summary?.highlights).toEqual(['Alice: hola mundo']);
    });

    it('stores messages per group independently', () => {
      service.addMessage(GROUP_JID, 'Alice', 'del grupo 1');
      service.addMessage(OTHER_JID, 'Bob', 'del grupo 2');

      expect(service.getSummary(GROUP_JID)?.count).toBe(1);
      expect(service.getSummary(OTHER_JID)?.count).toBe(1);
      expect(service.getSummary(OTHER_JID)?.highlights).toEqual(['Bob: del grupo 2']);
    });
  });

  describe('getSummary', () => {
    it('returns null for a group without messages', () => {
      expect(service.getSummary(GROUP_JID)).toBeNull();
    });

    it('limits the aggregation window to the requested count', () => {
      for (let i = 0; i < 10; i++) {
        service.addMessage(GROUP_JID, 'Alice', `mensaje numero ${i}`);
      }

      expect(service.getSummary(GROUP_JID, 3)?.count).toBe(3);
      expect(service.getSummary(GROUP_JID)?.count).toBe(10);
    });

    it('keeps only the last 6 messages as highlights', () => {
      for (let i = 0; i < 8; i++) {
        service.addMessage(GROUP_JID, 'Alice', `mensaje ${i}`);
      }

      const summary = service.getSummary(GROUP_JID);
      expect(summary?.highlights).toHaveLength(6);
      expect(summary?.highlights[0]).toBe('Alice: mensaje 2');
      expect(summary?.highlights[5]).toBe('Alice: mensaje 7');
    });

    it('truncates highlights longer than 80 characters', () => {
      const longText = 'x'.repeat(85);
      service.addMessage(GROUP_JID, 'Alice', longText);

      const summary = service.getSummary(GROUP_JID);
      const highlight = summary?.highlights[0] ?? '';
      expect(highlight).toBe(`Alice: ${'x'.repeat(77)}...`);
      expect(highlight.length).toBe('Alice: '.length + 80);
    });

    it('reports a time range containing a separator', () => {
      service.addMessage(GROUP_JID, 'Alice', 'hola');

      const summary = service.getSummary(GROUP_JID);
      expect(summary?.range).toContain(' - ');
    });
  });

  describe('keyword aggregation', () => {
    it('ranks keywords by frequency excluding stopwords, short words and numbers', () => {
      const messages: ChatMessage[] = [
        makeMessage('Alice', 'python es genial'),
        makeMessage('Bob', 'python mola'),
        makeMessage('Carol', 'python otra vez'),
        makeMessage('Dave', 'que tal las cosas'),
        makeMessage('Eve', 'abc 1234 ab'),
      ];

      const keywords = service.getTopKeywords(messages, 20);

      expect(keywords[0]).toEqual(['python', 3]);
      // 'es', 'que', 'tal', 'las' are stopwords; 'abc' survives (len 3);
      // '1234' (pure number) and 'ab' (len < 3) are dropped.
      expect(keywords.map(([word]) => word)).toContain('abc');
      expect(keywords.map(([word]) => word)).not.toContain('que');
      expect(keywords.map(([word]) => word)).not.toContain('1234');
      expect(keywords.map(([word]) => word)).not.toContain('ab');
    });

    it('respects the requested limit', () => {
      const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) =>
        makeMessage('Alice', `palabra${i} repetida repetida`),
      );

      const keywords = service.getTopKeywords(messages, 3);

      expect(keywords).toHaveLength(3);
    });

    it('ranks participants by message count', () => {
      const messages: ChatMessage[] = [
        makeMessage('Alice', 'a'),
        makeMessage('Alice', 'b'),
        makeMessage('Alice', 'c'),
        makeMessage('Bob', 'd'),
      ];

      const participants = service.getTopParticipants(messages);

      expect(participants[0]).toEqual(['Alice', 3]);
      expect(participants[1]).toEqual(['Bob', 1]);
    });

    it('falls back to Desconocido for empty senders', () => {
      const participants = service.getTopParticipants([makeMessage('', 'hola')]);

      expect(participants).toEqual([['Desconocido', 1]]);
    });
  });

  describe('clearGroup', () => {
    it('removes the group buffer and persists synchronously', () => {
      service.addMessage(GROUP_JID, 'Alice', 'hola');
      mockSave.mockClear();

      service.clearGroup(GROUP_JID);

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(service.getSummary(GROUP_JID)).toBeNull();
    });

    it('does not affect other groups', () => {
      service.addMessage(GROUP_JID, 'Alice', 'grupo 1');
      service.addMessage(OTHER_JID, 'Bob', 'grupo 2');

      service.clearGroup(GROUP_JID);

      expect(service.getSummary(GROUP_JID)).toBeNull();
      expect(service.getSummary(OTHER_JID)?.count).toBe(1);
    });
  });

  describe('persistence round-trip', () => {
    it('restores buffers from the loaded store', () => {
      mockLoad.mockReturnValue({
        trackedSince: '2026-01-01T00:00:00.000Z',
        groups: {
          [GROUP_JID]: [makeMessage('Alice', 'mensaje persistido')],
        },
      });
      const restored = makeService();

      const summary = restored.getSummary(GROUP_JID);
      expect(summary?.count).toBe(1);
      expect(summary?.highlights).toEqual(['Alice: mensaje persistido']);
    });
  });

  describe('module singleton', () => {
    it('exports a ChatSummaryService instance', async () => {
      const mod = await import('../../src/services/chat/ChatSummaryService.js');
      expect(mod.chatSummaryService).toBeInstanceOf(ChatSummaryService);
    });
  });
});
