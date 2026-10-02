/**
 * node-webpmux.d.ts
 *
 * Ambient types for the WebP conversion helper used when sending stickers.
 *
 * Only the sticker-specific surface is declared: `save(null)` returns the
 * encoded buffer instead of writing a file, which is how the sticker commands
 * consume it.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

declare module 'node-webpmux' {
  class Image {
    /** Raw EXIF payload preserved across conversion. */
    exif: Buffer;
    load(buffer: Buffer): Promise<void>;
    /** Encodes to WebP; a null path returns the bytes rather than writing. */
    save(path: null): Promise<Buffer>;
  }
  export { Image };
}
