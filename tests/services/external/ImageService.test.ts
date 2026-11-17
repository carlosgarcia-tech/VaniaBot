/**
 * ImageService.test.ts
 *
 * Unsplash Source was retired by Unsplash (permanent 503) and removed from
 * the image chain. Pins: with no API keys, the chain goes straight to the
 * Picsum fallback without any HTTP call.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { ImageService } from '@/services/external/ImageService.js';

vi.mock('axios');

const noKeys = () => {
  delete process.env.PIXABAY_API_KEY;
  delete process.env.PEXELS_API_KEY;
};

describe('ImageService image chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noKeys();
  });

  it('falls straight through to Picsum when providers are unavailable', async () => {
    (axios.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));

    const service = new ImageService();
    const results = await service.searchImages('gato', 3);

    expect(results).toHaveLength(3);
    expect(results[0]?.url).toContain('picsum.photos');
    // Unsplash Source must no longer be attempted (its only HTTP use was per-query).
    const urls = (axios.get as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => String(c[0]),
    );
    expect(urls.every(u => !u.includes('unsplash'))).toBe(true);
  });
});
