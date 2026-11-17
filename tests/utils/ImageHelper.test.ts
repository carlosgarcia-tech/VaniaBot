/**
 * ImageHelper.test.ts
 *
 * safeProfilePicUrl must NEVER hang: WhatsApp's server sometimes never answers
 * a picture query (no privacy token for that user), and Baileys'
 * profilePictureUrl has no default timeout — callers died waiting forever.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ImageHelper } from '@/utils/ImageHelper.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('ImageHelper.safeProfilePicUrl', () => {
  it('returns the url when WhatsApp answers', async () => {
    const sock = { profilePictureUrl: vi.fn().mockResolvedValue('http://pic/1') };

    await expect(ImageHelper.safeProfilePicUrl(sock as never, 'user@s.whatsapp.net')).resolves.toBe(
      'http://pic/1',
    );
    expect(sock.profilePictureUrl).toHaveBeenCalledWith('user@s.whatsapp.net', 'image', 8000);
  });

  it('returns null when WhatsApp throws (no picture / item-not-found)', async () => {
    const sock = { profilePictureUrl: vi.fn().mockRejectedValue(new Error('item-not-found')) };

    await expect(ImageHelper.safeProfilePicUrl(sock as never, 'user@s.whatsapp.net')).resolves.toBeNull();
  });

  it('gives up after the timeout instead of hanging forever', async () => {
    vi.useFakeTimers();
    const sock = {
      // Server never answers — exactly what happens without a privacy token.
      profilePictureUrl: vi.fn().mockImplementation(
        () => new Promise<string>(() => {}),
      ),
    };

    const pending = ImageHelper.safeProfilePicUrl(sock as never, 'user@s.whatsapp.net');
    await vi.advanceTimersByTimeAsync(8000);

    await expect(pending).resolves.toBeNull();
  });
});

describe('ImageHelper.getProfileImage', () => {
  it('returns the real picture URL when one exists', async () => {
    const ctx = {
      sock: { profilePictureUrl: vi.fn().mockResolvedValue('http://pic/real') },
      mentionedJid: undefined,
      sender: { jid: 'user@s.whatsapp.net' },
    } as unknown as MessageContext;

    await expect(ImageHelper.getProfileImage(ctx)).resolves.toBe('http://pic/real');
  });

  it('falls back to the packaged default avatar when the user has none', async () => {
    const ctx = {
      sock: { profilePictureUrl: vi.fn().mockRejectedValue(new Error('item-not-found')) },
      mentionedJid: undefined,
      sender: { jid: 'user@s.whatsapp.net' },
    } as unknown as MessageContext;

    const url = await ImageHelper.getProfileImage(ctx);
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });
});
