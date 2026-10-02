/**
 * assetHelper.ts
 *
 * Locates bundled image assets (rule cards, welcome banners, etc.) and sends
 * them to a chat.
 *
 * Assets are searched across several roots because the bot runs both from a
 * Docker image and from a checkout, where the project root differs.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Searches every known asset root and returns the first match.
 *
 * @param filename Asset name, e.g. `clkRules.png`.
 * @returns File contents, or null when the asset is missing everywhere.
 */
export function findAssetFile(filename: string): Buffer | null {
  const possiblePaths = [
    path.join('/app', 'data', 'assets', filename),
    path.join(process.cwd(), 'data', 'assets', filename),
    path.join(__dirname, '..', '..', 'data', 'assets', filename),
    process.env.ASSETS_DIR ? path.join(process.env.ASSETS_DIR, filename) : null,
    path.join(process.cwd(), 'static', 'assets', filename),
    path.join('/app', 'static', 'assets', filename),
  ].filter(Boolean) as string[];

  for (const imagePath of possiblePaths) {
    if (fs.existsSync(imagePath)) {
      try {
        logger.debug(`Found asset: ${imagePath}`);
        return fs.readFileSync(imagePath);
      } catch (error) {
        logError(`Error reading file ${imagePath}:`, error);
      }
    }
  }

  logger.error(`Asset not found: ${filename}. Searched paths:`, possiblePaths);
  return null;
}

/**
 * Sends a bundled asset image, replying with a user-facing error on any failure.
 *
 * Never throws: callers get a boolean so a missing asset degrades to an error
 * message instead of an unhandled rejection.
 *
 * @param filename Asset to send.
 * @param errorMessage Message used when the asset cannot be found.
 * @returns True when the image was sent, false otherwise.
 */
export async function sendAssetImage(
  ctx: MessageContext,
  filename: string,
  errorMessage: string = '❌ No se encontró la imagen solicitada.',
): Promise<boolean> {
  try {
    const imageBuffer = findAssetFile(filename);

    if (!imageBuffer) {
      await ctx.reply(errorMessage);
      return false;
    }

    await ctx.sock.sendMessage(ctx.chat.jid, { image: imageBuffer }, { quoted: ctx.message });
    return true;
  } catch (error) {
    logError(`Error sending asset image ${filename}:`, error);
    await ctx.reply('❌ Error al enviar la imagen.');
    return false;
  }
}
