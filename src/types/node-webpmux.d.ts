/**
 * Type declarations for 'node-webpmux' module.
 * Provides TypeScript types for WebP image manipulation.
 */
declare module 'node-webpmux' {
  class Image {
    exif: Buffer;
    load(buffer: Buffer): Promise<void>;
    save(path: null): Promise<Buffer>;
  }
  export { Image };
}