/**
 * FreeFireMenuCommand.ts
 *
 * freefire command `freefiremenu` — Menú de comandos Free Fire
 * Usage: !freefiremenu
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { freeFireService } from '@/services/games/FreeFireService.js';

/** Command handler for `!freefiremenu`: Menú de comandos Free Fire. */
export class FreeFireMenuCommand extends Command {
  name = 'freefiremenu';
  description = 'Menú de comandos Free Fire';
  category = CommandCategory.FREEFIRE;
  aliases = ['ffmenu', 'menuff', 'menufreefire'];
  usage = '!freefiremenu';
  cooldown = 5000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const tournament = freeFireService.getActiveTournament(ctx.chat.jid);
    const hasTournament = tournament !== null;

    const text =
      `*⚔️ MENÚ FREE FIRE*\n\n` +
      (hasTournament
        ? `📊 Torneo activo: *${tournament.name}*\n` +
          `Clanes: ${tournament.clans.length} | Partidos: ${tournament.matches.length}\n\n`
        : '❌ No hay torneo activo\n\n') +
      `*Admin:*\n` +
      `• !ff crear <nombre> - Crear torneo\n` +
      `• !ff clan add|del <clan> - Gestionar clanes\n` +
      `• !ff vs ClanA|ClanB|Ronda - Programar VS\n` +
      `• !ff resultado M1|2-1 - Cargar resultado\n\n` +
      `*Jugadores:*\n` +
      `• !ff inscribir Clan|Nick - Inscribirse\n` +
      `• !ff baja - Darse de baja\n` +
      `• !ff tabla - Ver posiciones\n` +
      `• !ff estado - Estado del torneo`;

    await ctx.reply(text);
  }
}
