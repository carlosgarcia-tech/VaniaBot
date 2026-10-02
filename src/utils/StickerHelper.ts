/**
 * StickerHelper.ts
 *
 * Convenience facade over StickerService that stamps the bot's pack metadata
 * onto every sticker it produces, so commands do not have to remember to call
 * `addExif` themselves.
 *
 * Errors are logged and rethrown, letting the calling command decide how to
 * report them.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import axios from 'axios';
import { logError } from '@/utils/logger.js';
import { StickerService } from '@/services/media/StickerService.js';

/** Pack name/author embedded in every generated sticker. */
const PACK_NAME = '𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩';
const PACK_AUTHOR = '𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩';

export class StickerHelper {
  private static service = new StickerService();

  /** Converts arbitrary media into a sticker and applies the pack metadata. */
  static async createSticker(buffer: Buffer): Promise<Buffer> {
    try {
      const raw = await this.service.createSticker(buffer);
      return await this.service.addExif(raw, PACK_NAME, PACK_AUTHOR);
    } catch (error) {
      logError('[StickerHelper] Error creating sticker:', error);
      throw error;
    }
  }

  /** Converts an already-resized/validated image buffer into a sticker. */
  static async imageToSticker(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const raw = await this.service.imageToSticker(imageBuffer);
      return await this.service.addExif(raw, PACK_NAME, PACK_AUTHOR);
    } catch (error) {
      logError('[StickerHelper] Error converting to sticker:', error);
      throw error;
    }
  }

  /** Downloads a remote image and converts it to a sticker. */
  static async imageUrlToSticker(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return await this.imageToSticker(Buffer.from(response.data));
    } catch (error) {
      logError('[StickerHelper] Error fetching image:', error);
      throw error;
    }
  }

  /** Converts a base64 data URI or bare payload into a sticker. */
  static async base64ToSticker(base64Data: string): Promise<Buffer> {
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      return await this.imageToSticker(Buffer.from(base64Content, 'base64'));
    } catch (error) {
      logError('[StickerHelper] Error converting base64 to sticker:', error);
      throw error;
    }
  }
}
