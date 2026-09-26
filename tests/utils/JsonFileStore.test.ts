/**
 * JsonFileStore.test.ts
 *
 * Unit tests for the generic atomic JSON file store.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { JsonFileStore } from '../../src/utils/JsonFileStore.js';

interface TestStore {
  groups: Record<string, { enabled: boolean }>;
}

describe('JsonFileStore', () => {
  let tempDir: string;
  let filePath: string;
  let store: JsonFileStore<TestStore>;

  const defaults = (): TestStore => ({ groups: {} });

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'vania-store-test-'));
    filePath = join(tempDir, 'nested', 'store.json');
    store = new JsonFileStore<TestStore>({ filePath, defaults });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when the file does not exist', () => {
    expect(store.load()).toEqual({ groups: {} });
  });

  it('saves and loads a store round-trip', () => {
    const data: TestStore = { groups: { '123@g.us': { enabled: true } } };
    store.save(data);
    expect(store.load()).toEqual(data);
  });

  it('creates parent directories on save and load', () => {
    store.save({ groups: { a: { enabled: false } } });
    expect(existsSync(filePath)).toBe(true);
  });

  it('writes atomically without leaving temp files behind', () => {
    store.save({ groups: {} });
    store.save({ groups: { x: { enabled: true } } });
    const files = readdirSync(join(tempDir, 'nested'));
    expect(files).toEqual(['store.json']);
  });

  it('returns defaults when the file contains corrupt JSON', () => {
    store.ensureDir();
    writeFileSync(filePath, '{not valid json', 'utf-8');
    expect(store.load()).toEqual({ groups: {} });
  });

  it('returns defaults when the file contains non-object JSON', () => {
    store.ensureDir();
    writeFileSync(filePath, '[1, 2, 3]', 'utf-8');
    expect(store.load()).toEqual({ groups: {} });
  });

  it('runs the validate hook on loaded data', () => {
    const validating = new JsonFileStore<TestStore>({
      filePath,
      defaults,
      validate: data => {
        const obj = data as { groups?: unknown };
        if (!obj.groups || typeof obj.groups !== 'object') return defaults();
        return data as TestStore;
      },
    });
    validating.ensureDir();
    writeFileSync(filePath, JSON.stringify({ wrong: 'shape' }), 'utf-8');
    expect(validating.load()).toEqual({ groups: {} });
  });

  it('pretty-prints the stored JSON', () => {
    store.save({ groups: {} });
    const raw = readFileSync(filePath, 'utf-8');
    expect(raw).toBe(JSON.stringify({ groups: {} }, null, 2));
  });

  it('throws on save failure and cleans up the temp file', () => {
    // Make the target directory read-only to force a rename failure.
    const nestedDir = join(tempDir, 'nested');
    store.save({ groups: {} });
    const { chmodSync } = require('fs') as typeof import('fs');
    chmodSync(nestedDir, 0o500);
    try {
      expect(() => store.save({ groups: { y: { enabled: true } } })).toThrow();
      const files = readdirSync(nestedDir);
      expect(files).toEqual(['store.json']);
    } finally {
      chmodSync(nestedDir, 0o755);
    }
  });
});
