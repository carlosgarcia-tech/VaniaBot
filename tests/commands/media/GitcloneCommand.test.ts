/**
 * GitcloneCommand.test.ts
 *
 * gitclone used the dead Delirius glue that just returned a link. Pins the
 * new flow: GitHub API finds the default branch, the zip is downloaded and
 * sent as a document, and non-GitHub urls are rejected.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitcloneCommand } from '@/commands/media/download/GitcloneCommand.js';
import type { MessageContext } from '@/types/index.js';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const bufferResponse = () =>
  ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as Response;

const createCtx = (args: string[]): MessageContext =>
  ({
    args,
    chat: { jid: 'chat@g.us' },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

describe('GitcloneCommand', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the default branch, downloads the zip and sends it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ default_branch: 'master' }))
      .mockResolvedValueOnce(bufferResponse());
    const ctx = createCtx(['https://github.com/user/repo']);

    await new GitcloneCommand().execute(ctx);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/user/repo');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://github.com/user/repo/archive/refs/heads/master.zip',
    );
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ document: expect.anything() }),
    );
  });

  it('rejects non-GitHub urls without any request', async () => {
    const ctx = createCtx(['https://gitlab.com/user/repo']);

    await new GitcloneCommand().execute(ctx);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('GitHub'));
  });

  it('reports a missing repo as a 404-style message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const ctx = createCtx(['https://github.com/user/nada']);

    await new GitcloneCommand().execute(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('no encontré'));
  });
});
