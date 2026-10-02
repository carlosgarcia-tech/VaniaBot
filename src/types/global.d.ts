/**
 * global.d.ts
 *
 * Ambient declarations for values attached to `globalThis`.
 *
 * Kept minimal on purpose: globals are harder to trace than imports, so this is
 * only used for values that must be reachable without threading a reference
 * through every call site (see the `client` global declared in core/Client.ts).
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

declare global {
  /**
   * Legacy in-memory database handle.
   *
   * Superseded by the SQLite-backed repositories; retained only for older call
   * sites that still read from it.
   */
  var db: {
    data: {
      users: Record<string, unknown>;
      chats: Record<string, unknown>;
    };
  };
}

export {};
