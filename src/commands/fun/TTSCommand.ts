/**
 * TTSCommand.ts
 *
 * fun command `tts` — Convierte texto a voz
 * Usage: !tts <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { ttsService } from '@/services/external/TTSService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!tts`: Convierte texto a voz. */
export class TTSCommand extends Command {
  name = 'tts';
  description = 'Convierte texto a voz';
  category = CommandCategory.FUN;
  aliases = ['speak', 'say', 'hablar', 'ttsvoz'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!tts <texto>';
  examples = ['!tts Hola mundo', '!tts Vania es genial'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !tts <texto>\n_Ejemplo: !tts Hola Vania_');
      return;
    }

    if (text.length > 500) {
      await ctx.reply('❌ El texto es muy largo (máx 500 caracteres)');
      return;
    }

    await ctx.react('🔊');

    try {
      const audioUrl = await ttsService.textToSpeech(text);
      const audioBuffer = await ttsService.downloadAudio(audioUrl);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: audioBuffer,
        mimetype: 'audio/mp3',
        ptt: true,
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[TTSCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude convertir el texto a voz. Intenta de nuevo.');
    }
  }
}
