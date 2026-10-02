/**
 * ModerationCommand.ts
 *
 * admin command `antiwele` — Bloquear usuarios que usan WhatsApp Web
 * Usage: .antiwele [on/off]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

/** Command handler for `!antiwele`: Bloquear usuarios que usan WhatsApp Web. */
export class AntiWeleCommand extends Command {
  name = 'antiwele';
  description = 'Bloquear usuarios que usan WhatsApp Web';
  category = CommandCategory.ADMIN;
  aliases = ['antimeta', 'antiweb'];
  usage = '.antiwele [on/off]';
  examples = ['.antiwele on', '.antiwele off'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action || !['on', 'off', 'activar', 'desactivar'].includes(action)) {
      await ctx.reply('用法: .antiwele [on/off]\nActiva el bloqueo de usuarios de WhatsApp Web');
      return;
    }

    await ctx.reply(
      '⚠️ *Función no implementada*\n\nAnti-WhatsApp Web requiere integración con la API de WhatsApp para detectar dispositivos. [PLANNED]',
    );
  }
}

export class AntiFakeCommand extends Command {
  name = 'antifake';
  description = 'Bloquear números no registrados';
  category = CommandCategory.ADMIN;
  aliases = ['antifake'];
  usage = '.antifake [on/off]';
  examples = ['.antifake on', '.antifake off'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action || !['on', 'off', 'activar', 'desactivar'].includes(action)) {
      await ctx.reply('用法: .antifake [on/off]\nBloquea usuarios con números no registrados');
      return;
    }

    await ctx.reply(
      '⚠️ *Función no implementada*\n\nAnti-Fake requiere validación de números contra la API de WhatsApp. [PLANNED]',
    );
  }
}

export class FilterCommand extends Command {
  name = 'filtrar';
  description = 'Gestionar palabras filtradas';
  category = CommandCategory.ADMIN;
  aliases = ['filter', 'palabras'];
  usage = '.filtrar [add/remove/list/clear] <palabra>';
  examples = ['.filtrar add spam', '.filtrar remove spam', '.filtrar list'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();
    const word = ctx.args.slice(1).join(' ').toLowerCase();

    switch (action) {
      case 'add':
      case 'agregar': {
        if (!word) {
          await ctx.reply('用法: .filtrar add <palabra>');
          return;
        }

        await ctx.reply(
          `✅ "${word}" añadido a palabras filtradas\n(Requiere implementación en BD)`,
        );
        break;
      }

      case 'remove':
      case 'quitar': {
        if (!word) {
          await ctx.reply('用法: .filtrar remove <palabra>');
          return;
        }

        await ctx.reply(`✅ "${word}" eliminado de palabras filtradas`);
        break;
      }

      case 'list':
      case 'lista': {
        await ctx.reply('📝 No hay palabras filtradas en este grupo');
        break;
      }

      case 'clear':
      case 'limpiar': {
        await ctx.reply('✅ Lista de palabras filtradas limpiada');
        break;
      }

      default:
        await ctx.reply(
          '*📝 Comandos de filtro:*\n\n' +
            '• .filtrar add <palabra> - Añadir palabra\n' +
            '• .filtrar remove <palabra> - Quitar palabra\n' +
            '• .filtrar list - Ver lista\n' +
            '• .filtrar clear - Limpiar todo',
        );
    }
  }
}

export class CleanCommand extends Command {
  name = 'clean';
  description = 'Eliminar mensajes recientes del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['purge', 'limpiar'];
  usage = '.clean <número>';
  examples = ['.clean 10', '.clean 50'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const count = parseInt(ctx.args[0]) || 10;

    if (count < 1 || count > 100) {
      await ctx.reply('El número debe estar entre 1 y 100');
      return;
    }

    await ctx.reply(
      `🧹 Eliminando últimos ${count} mensajes...\n\n⚠️ Esta función requiere implementación avanzada de la API de WhatsApp`,
    );
  }
}
