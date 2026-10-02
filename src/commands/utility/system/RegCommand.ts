/**
 * RegCommand.ts
 *
 * utility command `reg` — Regístrate para usar el bot
 * Usage: !reg nombre.edad
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!reg`: Regístrate para usar el bot. */
export class RegCommand extends Command {
  name = 'reg';
  description = 'Regístrate para usar el bot';
  category = CommandCategory.UTILITY;
  aliases = ['registrar', 'register', 'registro'];
  usage = '!reg nombre.edad';
  examples = ['!reg Carlos.25', '!reg Juan.18'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args.join(' ');

    if (!args || !args.includes('.')) {
      await ctx.reply(
        `📝 *REGISTRO*\n\n` +
          `Para registrarte usa:\n` +
          `✦ *!reg nombre.edad*\n\n` +
          `📌 *Ejemplo:*\n` +
          `✦ !reg Carlos.25\n\n` +
          `⚠️ *Nota:* No puedes cambiar tu nombre después de registrado.`,
      );
      return;
    }

    const parts = args.split('.');
    const name = parts[0].trim();
    const ageStr = parts[1].trim();

    if (!name || name.length < 2) {
      await ctx.reply('❌ El nombre debe tener al menos 2 caracteres');
      return;
    }

    if (name.length > 20) {
      await ctx.reply('❌ El nombre debe tener máximo 20 caracteres');
      return;
    }

    const age = parseInt(ageStr);
    if (isNaN(age) || age < 13 || age > 120) {
      await ctx.reply('❌ La edad debe ser un número entre 13 y 120');
      return;
    }

    try {
      const existingUser = await serviceManager.userService.getUser(ctx.sender.jid);

      if (existingUser.name && existingUser.name !== 'User') {
        await ctx.reply(
          `❌ Ya estás registrado\n\n` +
            `Tu perfil: *${existingUser.name}*\n` +
            `Usa *!perfil* para ver tu información`,
        );
        return;
      }

      await serviceManager.userService.updateUser(ctx.sender.jid, {
        name: name,
      });

      await ctx.reply(
        `✅ *¡REGISTRADO!* 🎉\n\n` +
          `✦ *Nombre:* ${name}\n` +
          `✦ *Edad:* ${age} años\n\n` +
          `¡Bienvenido a VaniaBot! 🎊\n\n` +
          `📌 *Comandos disponibles:*\n` +
          `✦ !work - Trabajar\n` +
          `✦ !daily - Recompensa diaria\n` +
          `✦ !casino - Juegos de casino\n` +
          `✦ !perfil - Ver tu perfil\n\n` +
          `Usa *!help* para ver más comandos`,
      );
    } catch {
      await ctx.reply('❌ Error al registrarte. Intenta de nuevo.');
    }
  }
}
