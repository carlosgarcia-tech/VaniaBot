/**
 * FriendshipCommand.ts
 *
 * creative command `friendship` — Genera imagen de amistad
 * Usage: !friendship [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!friendship`: Genera imagen de amistad. */
export class FriendshipCommand extends Command {
  name = 'friendship';
  description = 'Genera imagen de amistad';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!friendship [@usuario]';
  examples = ['!friendship', '!friendship @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🤝');

    const [image1, image2] = await ImageHelper.getTwoProfileImages(ctx);

    const mentionedJid = ctx.mentionedJid;

    const name1 = ctx.sender.pushName || 'User 1';
    const name2 = mentionedJid ? (await this.getPushName(mentionedJid, ctx)) || 'User 2' : 'User 2';

    const base = (ctx.sender.jid + (mentionedJid || ''))
      .split('')
      .reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
    const percentage = ((base % 80) + 20).toString();

    const params: Record<string, string> = {
      name1: name1.substring(0, 15),
      name2: name2.substring(0, 15),
      percentage,
      text: 'Friends',
    };

    if (image1) params.image1 = image1;
    if (image2) params.image2 = image2;

    await new CanvasBase().sendImage(ctx, 'friendship', params);
  }

  private async getPushName(jid: string, ctx: MessageContext): Promise<string | null> {
    try {
      const contacts = await ctx.sock.onWhatsApp(jid);
      const contact = contacts?.[0];
      if (contact && 'pushName' in contact && contact.pushName) return contact.pushName as string;
      const number = jid.split('@')[0];
      return number;
    } catch {
      return null;
    }
  }
}
