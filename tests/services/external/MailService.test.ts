/**
 * MailService.test.ts
 *
 * mail.tm (verified alive 17-nov-2026) restores the temporary-email commands
 * that died with Delirius. Pins: account creation persists address→password
 * (needed later by !mailmessages), login fetches a fresh JWT on demand, and
 * message listing maps the hydra collection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MailService, mailService } from '@/services/external/MailService.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const STORE = new Map<string, string>();

vi.mock('@/utils/JsonFileStore.js', () => {
  return {
    JsonFileStore: class {
      load() {
        return Object.fromEntries(STORE);
      }
      save(data: Record<string, string>) {
        for (const [k, v] of Object.entries(data)) STORE.set(k, v);
      }
    },
  };
});

describe('MailService', () => {
  let service: MailService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    STORE.clear();
    service = new MailService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates an account and persists address→password', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ 'hydra:member': [{ domain: 'euploading.com' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'acc1', address: 'x@euploading.com' }))
      .mockResolvedValueOnce(jsonResponse({ token: 'jwt-token' }));

    const account = await service.createAccount();

    expect(account.address).toMatch(/@euploading\.com$/);
    expect(STORE.get(account.address)).toBeTruthy();
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('euploading.com');
  });

  it('logs in with the persisted password to list messages', async () => {
    STORE.set('x@euploading.com', 'saved-pass');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'jwt-token' }))
      .mockResolvedValueOnce(
        jsonResponse({ 'hydra:member': [{ id: 'm1', intro: 'hi' }] }),
      );

    const messages = await service.listMessages('x@euploading.com');

    expect(messages).toEqual([{ id: 'm1', intro: 'hi' }]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('saved-pass');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/messages');
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.Authorization).toBe('Bearer jwt-token');
  });

  it('fails with a clear message for an unknown address', async () => {
    await expect(service.listMessages('nope@unknown.com')).rejects.toThrow('no encontrada');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exposes a shared singleton', () => {
    expect(mailService).toBeInstanceOf(MailService);
  });
});
