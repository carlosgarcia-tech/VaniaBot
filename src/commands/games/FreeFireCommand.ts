/**
 * FreeFireCommand.ts
 *
 * freefire command `freefire` — Organiza torneos de Free Fire en grupos
 * Usage: !ff <comando>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { freeFireService } from '@/services/games/FreeFireService.js';

function requireAdmin(ctx: MessageContext): boolean {
  return ctx.sender.isAdmin || ctx.sender.isOwner;
}

function parsePipeArgs(args: string[]): string[] {
  return args
    .join(' ')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Command handler for `!freefire`: Organiza torneos de Free Fire en grupos. */
export class FreeFireCommand extends Command {
  name = 'freefire';
  description = 'Organiza torneos de Free Fire en grupos';
  category = CommandCategory.FREEFIRE;
  aliases = [
    'ff',
    'ffcatalogo',
    'ffcrear',
    'ffclan',
    'ffclanes',
    'ffinscribir',
    'ffbaja',
    'ffvs',
    'ffresultado',
    'fftabla',
    'ffpartidos',
    'ffestado',
    'ffcerrar',
  ];
  usage = '!ff <comando>';
  cooldown = 5000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const cmd = ctx.command.toLowerCase();
    const groupId = ctx.chat.jid;
    const senderJid = ctx.sender.jid;

    const aliasMap: Record<string, string> = {
      ff: 'help',
      freefire: 'help',
      ffcatalogo: 'help',
      ffcrear: 'crear',
      ffclan: 'clan',
      ffclanes: 'clanes',
      ffinscribir: 'inscribir',
      ffbaja: 'baja',
      ffvs: 'vs',
      ffresultado: 'resultado',
      fftabla: 'tabla',
      ffpartidos: 'partidos',
      ffestado: 'estado',
      ffcerrar: 'cerrar',
    };

    const action = aliasMap[cmd] || ctx.args[0]?.toLowerCase() || 'help';
    const isArgsBased = !aliasMap[cmd];

    switch (action) {
      case 'help':
      case 'menu': {
        await ctx.reply(
          `*⚔️ FREE FIRE*\n\n` +
            `Torneos de Free Fire en el grupo.\n\n` +
            `Admin:\n` +
            `• !ff crear <nombre> - Crear torneo\n` +
            `• !ff clan add|del <nombre> - Gestionar clanes\n` +
            `• !ff vs ClanA|ClanB|Ronda - Programar VS\n` +
            `• !ff resultado M1|2-1 - Cargar resultado\n` +
            `• !ff cerrar - Cerrar torneo\n\n` +
            `Jugadores:\n` +
            `• !ff inscribir Clan|Nick - Unirse a clan\n` +
            `• !ff baja - Salir del clan\n` +
            `• !ff tabla - Ver posiciones\n` +
            `• !ff estado - Estado del torneo`,
        );
        break;
      }

      case 'crear': {
        if (!requireAdmin(ctx)) {
          await ctx.reply('❌ Solo admin/owner puede crear torneos.');
          return;
        }
        const name = ctx.args.slice(1).join(' ') || 'Torneo Free Fire';
        const tournament = freeFireService.createTournament(groupId, name, senderJid);
        await ctx.reply(
          `*TORNEO CREADO*\n\n` +
            `Nombre: *${tournament.name}*\n` +
            `ID: *${tournament.id}*\n\n` +
            `Siguiente paso:\n` +
            `• !ff clan add NombreDelClan`,
        );
        break;
      }

      case 'clan': {
        if (!requireAdmin(ctx)) {
          await ctx.reply('❌ Solo admin/owner puede gestionar clanes.');
          return;
        }
        const subAction = ctx.args[1]?.toLowerCase();
        const clanName = ctx.args.slice(2).join(' ');

        if (subAction === 'add' && clanName) {
          const clan = freeFireService.addClan(groupId, clanName);
          if (clan) {
            await ctx.reply(`✅ Clan registrado: *${clan.name}*`);
          } else {
            await ctx.reply(`❌ Ese clan ya existe o no hay torneo activo.`);
          }
        } else if (['del', 'remove', 'delete'].includes(subAction) && clanName) {
          if (freeFireService.removeClan(groupId, clanName)) {
            await ctx.reply(`✅ Clan eliminado.`);
          } else {
            await ctx.reply(`❌ Clan no encontrado.`);
          }
        } else {
          await ctx.reply(
            `*GESTIÓN DE CLANES*\n\n` +
              `• !ff clan add Nombre - Agregar\n` +
              `• !ff clan del Nombre - Eliminar`,
          );
        }
        break;
      }

      case 'clanes': {
        const tournament = freeFireService.getActiveTournament(groupId);
        if (!tournament) {
          await ctx.reply('❌ No hay torneo activo. Usa !ff crear');
          return;
        }
        if (tournament.clans.length === 0) {
          await ctx.reply('No hay clanes registrados.');
          return;
        }
        const list = tournament.clans
          .map((c, i) => `${i + 1}. ${c.name} (${c.players.length} jugadores) - Pts: ${c.points}`)
          .join('\n');
        await ctx.reply(`*CLANES*\n\n${list}`);
        break;
      }

      case 'inscribir': {
        const args = parsePipeArgs(isArgsBased ? ctx.args.slice(1) : ctx.args.slice(2));
        const [clanName = '', nick = ''] = args;

        if (!clanName) {
          await ctx.reply(
            `*INSCRIBIRSE*\n\n` +
              `• !ff inscribir NombreDelClan\n` +
              `• !ff inscribir NombreDelClan|MiNick`,
          );
          return;
        }

        if (
          freeFireService.addPlayerToClan(groupId, clanName, senderJid, nick || ctx.sender.pushName)
        ) {
          await ctx.reply(`✅ Inscripción completada en *${clanName}*`);
        } else {
          await ctx.reply(`❌ Clan no encontrado o no hay torneo activo.`);
        }
        break;
      }

      case 'baja': {
        if (freeFireService.removePlayer(groupId, senderJid)) {
          await ctx.reply(`✅ Te diste de baja del clan.`);
        } else {
          await ctx.reply(`❌ No estabas inscrito en ningún clan.`);
        }
        break;
      }

      case 'vs': {
        if (!requireAdmin(ctx)) {
          await ctx.reply('❌ Solo admin/owner puede programar VS.');
          return;
        }
        const args = parsePipeArgs(ctx.args.slice(1));
        const [clanA = '', clanB = '', round = 'R1'] = args;

        if (!clanA || !clanB) {
          await ctx.reply(`*PROGRAMAR VS*\n\n!ff vs ClanA|ClanB|Ronda`);
          return;
        }

        const match = freeFireService.createMatch(groupId, clanA, clanB, round);
        if (match) {
          await ctx.reply(
            `*VS PROGRAMADO*\n\n` +
              `Match: *${match.id}*\n` +
              `${match.clanA} vs ${match.clanB}\n` +
              `Ronda: ${match.round}\n\n` +
              `Para cargar resultado:\n` +
              `!ff resultado ${match.id}|2-1`,
          );
        } else {
          await ctx.reply(`❌ No pude crear el VS. Verifica que ambos clanes existan.`);
        }
        break;
      }

      case 'resultado': {
        if (!requireAdmin(ctx)) {
          await ctx.reply('❌ Solo admin/owner puede cargar resultados.');
          return;
        }
        const args = parsePipeArgs(ctx.args.slice(1));
        const [matchId = '', scoreText = ''] = args;

        if (!matchId || !scoreText) {
          await ctx.reply(`*CARGAR RESULTADO*\n\n!ff resultado M1|2-1`);
          return;
        }

        if (freeFireService.setMatchResult(groupId, matchId, scoreText)) {
          await ctx.reply(`✅ Resultado cargado. Usa !ff tabla para ver更新的 tabla.`);
        } else {
          await ctx.reply(`❌ No pude cargar el resultado. Verifica el ID del partido.`);
        }
        break;
      }

      case 'tabla': {
        const table = freeFireService.getTable(groupId);
        if (table.length === 0) {
          await ctx.reply('❌ No hay torneo activo o no hay clanes.');
          return;
        }
        const rows = table
          .map(
            (c, i) =>
              `${i + 1}. ${c.name}\n   Pts:${c.points} W:${c.wins} D:${c.draws} L:${c.losses}`,
          )
          .join('\n');
        await ctx.reply(`*TABLA FREE FIRE*\n\n${rows}`);
        break;
      }

      case 'partidos': {
        const tournament = freeFireService.getActiveTournament(groupId);
        if (!tournament) {
          await ctx.reply('❌ No hay torneo activo.');
          return;
        }
        if (tournament.matches.length === 0) {
          await ctx.reply('No hay partidos programados.');
          return;
        }
        const list = tournament.matches
          .slice()
          .reverse()
          .slice(0, 10)
          .map(m => {
            if (m.status === 'jugado' && m.result) {
              return `${m.id} | ${m.round}\n${m.clanA} ${m.result.scoreA} - ${m.result.scoreB} ${m.clanB}\nGanador: ${m.result.winner}`;
            }
            return `${m.id} | ${m.round}\n${m.clanA} vs ${m.clanB}\nEstado: Pendiente`;
          })
          .join('\n\n');
        await ctx.reply(`*PARTIDOS*\n\n${list}`);
        break;
      }

      case 'estado': {
        const tournament = freeFireService.getActiveTournament(groupId);
        if (!tournament) {
          await ctx.reply('❌ No hay torneo activo.');
          return;
        }
        const readyClans = tournament.clans.filter(
          c => c.players.length >= tournament.formatRules.teamSize,
        ).length;
        await ctx.reply(
          `*ESTADO TORNEO*\n\n` +
            `Nombre: *${tournament.name}*\n` +
            `Estado: *${tournament.status}*\n` +
            `Clanes: *${tournament.clans.length}* (listos: ${readyClans})\n` +
            `Partidos: *${tournament.matches.length}*\n` +
            `Formato: *${tournament.formatRules.teamSize}v${tournament.formatRules.teamSize}*`,
        );
        break;
      }

      case 'cerrar': {
        if (!requireAdmin(ctx)) {
          await ctx.reply('❌ Solo admin/owner puede cerrar torneos.');
          return;
        }
        const tournament = freeFireService.closeTournament(groupId);
        if (!tournament) {
          await ctx.reply('❌ No hay torneo activo.');
          return;
        }
        const table = freeFireService.getTable(groupId);
        const finalTable = table.map((c, i) => `${i + 1}. ${c.name} - ${c.points} pts`).join('\n');
        await ctx.reply(
          `*TORNEO CERRADO*\n\n` + `${tournament.name}\n\n` + `*TABLA FINAL*\n${finalTable}`,
        );
        break;
      }

      default:
        await ctx.reply(`*⚔️ FREE FIRE*\n\n` + `Usa !ff help para ver los comandos disponibles.`);
    }
  }
}
