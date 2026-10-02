/**
 * SetBotPhotoCommand.ts
 *
 * owner command `setbotphoto` — Cambia la foto de perfil del bot
 * Usage: !setbotphoto <url|imagen>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { downloadContentFromMessage } from 'baileys';
import { createWriteStream, unlinkSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { logError } from '@/utils/logger.js';

const TMP_DIR = path.join(process.cwd(), 'tmp');

function ensureTmpDir(): void {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
}

async function downloadImageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VaniBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function downloadImageFromMessage(ctx: MessageContext): Promise<Buffer | null> {
  if (!ctx.quoted) return null;

  const quotedMsg = ctx.quoted as Record<string, unknown>;
  const imageMessage =
    quotedMsg.imageMessage || (quotedMsg.extendedMessage as Record<string, unknown>)?.imageMessage;

  if (!imageMessage) return null;

  try {
    const stream = await downloadContentFromMessage(imageMessage, 'image');
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (error) {
    logError('[SetBotPhoto]', error);
    return null;
  }
}

/** Command handler for `!setbotphoto`: Cambia la foto de perfil del bot. */
export class SetBotPhotoCommand extends Command {
  name = 'setbotphoto';
  description = 'Cambia la foto de perfil del bot';
  category = CommandCategory.OWNER;
  aliases = ['botphoto', 'setppbot', 'setpfpbot', 'setbotpicture'];
  usage = '!setbotphoto <url|imagen>';
  examples = ['!setbotphoto https://example.com/foto.jpg', '!setbotphoto (responder a imagen)'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.react('⏳');

      let imageBuffer: Buffer | null = null;

      if (ctx.args[0]) {
        const url = ctx.args[0].trim();
        if (/^https?:\/\//i.test(url)) {
          imageBuffer = await downloadImageFromUrl(url);
        } else {
          await ctx.reply(
            '*SETBOTPHOTO*\n\n' +
              'Cambia la foto de perfil del bot.\n\n' +
              'Uso:\n' +
              '• !setbotphoto https://example.com/foto.jpg\n' +
              '• !setbotphoto (responder a una imagen)',
          );
          return;
        }
      } else {
        imageBuffer = await downloadImageFromMessage(ctx);
      }

      if (!imageBuffer || !imageBuffer.length) {
        await ctx.reply(
          '*SETBOTPHOTO*\n\n' +
            'No pude obtener la imagen.\n\n' +
            'Uso:\n' +
            '• !setbotphoto https://example.com/foto.jpg\n' +
            '• !setbotphoto (responder a una imagen)',
        );
        return;
      }

      ensureTmpDir();
      const tempFile = path.join(TMP_DIR, `bot-profile-${Date.now()}.jpg`);

      try {
        createWriteStream(tempFile).write(imageBuffer);

        if (typeof ctx.sock.updateProfilePicture !== 'function') {
          throw new Error('Este entorno no soporta cambiar foto de perfil.');
        }

        await ctx.sock.updateProfilePicture(ctx.sock.user?.id || '', { url: tempFile });

        await ctx.reply('✅ Foto de perfil actualizada.');
      } finally {
        try {
          if (existsSync(tempFile)) {
            unlinkSync(tempFile);
          }
        } catch (error) {
          logError('[SetBotPhoto]', error);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.reply(`❌ Error cambiando foto.\n\n${errorMessage}`);
    }
  }
}
