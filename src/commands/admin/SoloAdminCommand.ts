/**
 * SoloAdminCommand.ts
 *
 * Command to enable/disable admin-only mode in groups.
 * When enabled, only group admins and bot owners can use commands.
 * Regular users can still react to lists but cannot use other commands.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/**
 * Command to manage admin-only mode in groups.
 * Requires group admin permissions to use.
 *
 * @example
 * ```typescript
 * .soloadmin on
 * .soloadmin off
 * .soloadmin status
 * ```
 */
export class SoloAdminCommand extends Command {
  name = 'soloadmin';
  description = 'Enables admin-only mode: only admins and owners can use commands';
  category = CommandCategory.ADMIN;
  aliases = ['adminonly', 'soloadminmode'];
  usage = '.soloadmin [on/off/status]';
  examples = ['.soloadmin', '.soloadmin on', '.soloadmin off', '.soloadmin status'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  /**
   * Executes the soloadmin command.
   * Toggles admin-only mode on/off or shows current status.
   *
   * @param ctx - The message context
   * @returns Promise<void>
   */
  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action) {
      await this.showStatus(ctx);
      return;
    }

    switch (action) {
      case 'on':
      case 'activar':
        await serviceManager.groupService.setOnlyAdmin(ctx.chat.jid, true);
        await ctx.reply(
          `╭━━━ 🌸  *VaniaBot*  ━━━╮\n` +
            `   *Modo Solo Admin* activado\n` +
            `\n` +
            `Ahora solo los *admins del grupo*\n` +
            `   y los *owners del bot* pueden\n` +
            `   usar mis comandos.\n` +
            `\n` +
            `Los demás miembros aún podrán\n` +
            `   reaccionar a las listas.\n` +
            `\n` +
            `   Gracias por cuidar el orden\n` +
            `   del grupo conmigo 💗\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯`,
        );
        break;

      case 'off':
      case 'desactivar':
        await serviceManager.groupService.setOnlyAdmin(ctx.chat.jid, false);
        await ctx.reply(
          `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
            `   *Modo Solo Admin desactivado*\n` +
            `\n` +
            `Todos los miembros del grupo\n` +
            `   pueden usar mis comandos\n` +
            `   nuevamente.\n` +
            `\n` +
            `Gracias por mantener\n` +
            `   el grupo organizado.\n` +
            `\n` +
            `   Estoy aquí para ayudar 💗\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯`,
        );
        break;

      case 'status':
      case 'estado':
        await this.showStatus(ctx);
        break;

      default:
        await ctx.reply(
          `❓ *Unknown command*\n\n` +
            `Available options:\n` +
            `• \`.soloadmin on\` — Enable admin-only mode\n` +
            `• \`.soloadmin off\` — Disable admin-only mode\n` +
            `• \`.soloadmin status\` — Show current status\n\n` +
            `_— VaniaBot 🌸_`,
        );
    }
  }

  /**
   * Shows the current admin-only mode status.
   *
   * @param ctx - The message context
   * @returns Promise<void>
   */
  private async showStatus(ctx: MessageContext): Promise<void> {
    const onlyAdmin = await serviceManager.groupService.getOnlyAdmin(ctx.chat.jid);

    await ctx.reply(
      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
        `   ⚙️ *Modo Solo Admin*\n` +
        `\n` +
        `*Estado actual:* ${onlyAdmin ? '✅ Activado' : '❌ Desactivado'}\n` +
        `\n` +
        `${
          onlyAdmin
            ? `Solo *admins del grupo*\n` +
              `   y *owners del bot*\n` +
              `   pueden usar comandos.\n` +
              `\n` +
              `Los demás miembros\n` +
              `   solo podrán reaccionar\n` +
              `   a las listas.`
            : `Todos los miembros\n` + `   pueden usar mis\n` + `   comandos libremente.`
        }\n` +
        `\n` +
        `*Comandos disponibles*\n` +
        `• \`.soloadmin on\`  — Activar\n` +
        `• \`.soloadmin off\` — Desactivar\n` +
        `\n` +
        `   Estoy aquí para ayudarte 💗\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯`,
    );
  }
}
