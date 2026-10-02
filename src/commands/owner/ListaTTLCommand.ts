/**
 * ListaTTLCommand.ts
 *
 * owner command `listattl` — Configura el tiempo de expiración de las listas (solo owner)
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { listaManager } from '@/services/game/ListaManager.js';

/** Command handler for `!listattl`: Configura el tiempo de expiración de las listas (solo owner). */
export class ListaTTLCommand extends Command {
  name = 'listattl';
  description = 'Configura el tiempo de expiración de las listas (solo owner)';
  aliases = ['lt'];
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0) {
      const currentTTL = listaManager.getTTL();
      const defaultTTL = listaManager.getDefaultTTL();
      const horasActuales = Math.round(currentTTL / (60 * 60 * 1000));
      const horasDefault = Math.round(defaultTTL / (60 * 60 * 1000));
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *tiempo de listas* ˚₊· ͟͟͞͞➳\n\n` +
          `✩ ahora: *${horasActuales} horas*\n` +
          `✩ predeterminado: *${horasDefault} horas*\n\n` +
          `✿ para cambiarlo: *!listattl* <horas> ✿`,
      );
      return;
    }

    const horas = parseInt(args[0], 10);
    if (isNaN(horas) || horas < 1 || horas > 48) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *ay, así se usa* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!listattl* <horas>\n` +
          `✩ ejemplo: *!listattl 8* (8 horas)\n` +
          `♡ vale de *1* a *48* horas ♡`,
      );
      return;
    }

    listaManager.setTTL(horas);
    await ctx.reply(`✅ TTL configurado a ${horas} horas`);
  }
}

export const listaTTLCommand = new ListaTTLCommand();
