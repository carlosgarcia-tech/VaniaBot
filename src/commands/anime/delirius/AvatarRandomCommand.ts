/**
 * AvatarRandomCommand.ts
 *
 * anime command `avatarrandom` — Gets a random styled avatar
 * Usage: !avatarrandom [estilo]
 *
 * DiceBear renders the avatars server-side (verified alive 18-nov-2026); the
 * old Delirius glue is dead.
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** DiceBear styles exposed by the command. */
const STYLES = [
  'adventurer',
  'avataaars',
  'bottts',
  'fun-emoji',
  'lorelei',
  'micah',
  'notionists',
  'pixel-art',
];

/** Command handler for `!avatarrandom`: Gets a random styled avatar. */
export class AvatarRandomCommand extends Command {
  name = 'avatarrandom';
  description = 'Obtiene un avatar aleatorio con estilo';
  category = CommandCategory.ANIME;
  aliases = ['avatarrandom', 'randomavatar'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!avatarrandom [estilo]';
  examples = ['!avatarrandom', '!avatarrandom pixel-art'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const requested = ctx.args?.join(' ').trim().toLowerCase() ?? '';

    if (requested && !STYLES.includes(requested)) {
      await ctx.reply(`✍️ Estilos: ${STYLES.join(', ')}\n_Ejemplo: !avatarrandom pixel-art_`);
      return;
    }

    await ctx.react('🎨');
    try {
      const style = requested || STYLES[Math.floor(Math.random() * STYLES.length)];
      const seed = Math.random().toString(36).slice(2);
      const imageUrl = `https://api.dicebear.com/9.x/${style}/png?seed=${seed}`;
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
        caption: `🎨 *Avatar ${style}*`,
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AvatarRandomCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener el avatar. Intenta de nuevo.');
    }
  }
}
