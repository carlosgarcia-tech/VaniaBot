/**
 * PoesiaBase.ts
 *
 * fun command `PoesiaBase`
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { poesiaService } from '@/services/creative/PoesiaService.js';
import { parsePoesiaArgs } from '@/services/creative/PoesiaParser.js';
import { isRight } from '@/utils/either.js';
import type { ContenidoTipo } from '@/services/creative/PoesiaTypes.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!PoesiaBase`: command handler. */
export abstract class PoesiaBaseCommand extends Command {
  name = '';
  description = '';
  abstract readonly tipo: ContenidoTipo;

  category = CommandCategory.FUN;
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = [...(ctx.args ?? [])];

    if (args[0]?.toLowerCase() === 'help' || args[0] === '--help') {
      await this.sendHelp(ctx);
      return;
    }

    const { opts } = parsePoesiaArgs(this.tipo, args);

    await ctx.react('🔄');

    const result = await poesiaService.generar(
      opts,
      ctx.sender.jid,
      ctx.sender.pushName ?? 'Alguien',
      ctx.chat.jid,
    );

    if (!isRight(result)) {
      await ctx.react('❌');
      await ctx.reply(`❌ ${result.left.message}`);
      return;
    }

    await ctx.react('✅');
    await ctx.reply(poesiaService.formatEntry(result.right.entry));
  }

  protected abstract sendHelp(ctx: MessageContext): Promise<void>;
}
