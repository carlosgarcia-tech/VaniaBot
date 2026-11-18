/**
 * GofileCommand.ts
 *
 * media command `gofile` — Uploads a quoted/attached file to gofile.io and
 * replies with the download page link.
 *
 * Uses the official gofile.io anonymous upload API (verified alive
 * 17-nov-2026: POST store1.gofile.io/uploadFile, no key). The quoted document
 * resolves against MediaMessageCache (quoted stubs lack the CDN url).
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { mediaMessageCache } from '@/services/media/MediaMessageCache.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const GOFILE_API = 'https://store1.gofile.io/uploadFile';

/** Command handler for `!gofile`: Uploads a file to gofile.io. */
export class GofileCommand extends Command {
  name = 'gofile';
  /** Uploads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  parallelizable = true;
  description = 'Sube un archivo a gofile.io y comparte el link';
  category = CommandCategory.MEDIA;
  aliases = ['gofile'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!gofile (responde a un archivo)';
  examples = ['!gofile (respondiendo a un documento)'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const directDoc = ctx.message.message?.documentMessage;

    if (!directDoc && !quotedMsg?.documentMessage) {
      await ctx.reply('❌ Responde a un archivo para subirlo a Gofile.');
      return;
    }

    await ctx.react('📤');

    try {
      const doc = directDoc ?? quotedMsg?.documentMessage;
      // Quoted stubs lack the CDN url — resolve the ORIGINAL cached message.
      const source: WAMessage =
        directDoc || !quotedMsgId
          ? (ctx.message as WAMessage)
          : (mediaMessageCache.get(ctx.chat.jid, quotedMsgId) ??
            ({
              key: {
                id: quotedMsgId,
                remoteJid: ctx.quotedParticipant || ctx.chat.jid,
                fromMe: false,
              },
              message: { documentMessage: doc },
              messageTimestamp: Date.now(),
              pushName: '',
              status: 0,
            } as WAMessage));

      const buffer = (await downloadMediaMessage(source, 'buffer', {})) as Buffer;

      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buffer)]), doc?.fileName ?? 'archivo');
      const response = await fetch(GOFILE_API, { method: 'POST', body: form });
      if (!response.ok) {
        throw new Error(`gofile error: ${response.status}`);
      }
      const data = (await response.json()) as {
        status?: string;
        data?: { downloadPage?: string };
      };
      const link = data.data?.downloadPage;
      if (data.status !== 'ok' || !link) {
        throw new Error('gofile: sin link');
      }

      await ctx.reply(`📤 *Archivo subido a Gofile*\n\n🔗 ${link}`);
      await ctx.react('✅');
    } catch (error) {
      logError('[GofileCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude subir el archivo. Intenta de nuevo.');
    }
  }
}
