/**
 * Ytmp3v2Command.ts
 *
 * media command `ytmp3v2` — Descarga audio de YouTube (v2)
 * Usage: !ytmp3v2 <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!ytmp3v2`: Descarga audio de YouTube (v2). */
export class Ytmp3v2Command extends Command {
  name = 'ytmp3v2';
  description = 'Descarga audio de YouTube (v2)';
  category = CommandCategory.MEDIA;
  aliases = ['ytmp3v2'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  usage = '!ytmp3v2 <url>';
  examples = ['!ytmp3v2 https://youtube.com/...'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply('✍️ *Uso:* !ytmp3v2 <url>\n_Ejemplo: !ytmp3v2 https://youtube.com/..._');
      return;
    }

    await ctx.react('🎵');
    await ctx.reply('> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕');

    try {
      const data = (await deliriusService.getJson('download', 'ytmp3v2', { url })) as {
        result?: string;
        audio?: string;
        download?: string;
      };

      const downloadUrl = data?.result || data?.audio || data?.download;

      if (downloadUrl) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          audio: { url: downloadUrl },
          mimetype: 'audio/mpeg',
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No pude descargar el audio. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[Ytmp3v2Command]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar. Intenta de nuevo.');
    }
  }
}
