import { describe, it, expect } from 'vitest';
import { resolveRedisUrl } from '../../../src/services/system/DatabaseSwitcher.js';

describe('resolveRedisUrl', () => {
  it('prefers an explicit REDIS_URL', () => {
    expect(
      resolveRedisUrl({ REDIS_URL: 'redis://x:6380', REDIS_HOST: 'orbit-redis', REDIS_PORT: '6379' }),
    ).toBe('redis://x:6380');
  });

  it('builds the URL from REDIS_HOST/REDIS_PORT when REDIS_URL is unset', () => {
    expect(resolveRedisUrl({ REDIS_HOST: 'orbit-redis', REDIS_PORT: '6379' })).toBe(
      'redis://orbit-redis:6379',
    );
  });

  it('falls back to localhost when nothing is set', () => {
    expect(resolveRedisUrl({})).toBe('redis://localhost:6379');
  });
});
