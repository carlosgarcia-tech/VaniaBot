/**
 * AchievementsCommand.ts
 *
 * utility command `achievements` — Muestra tus logros desbloqueados
 * Usage: !achievements [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!achievements`: Muestra tus logros desbloqueados. */
export class AchievementsCommand extends Command {
  name = 'achievements';
  description = 'Muestra tus logros desbloqueados';
  category = CommandCategory.UTILITY;
  requiresRegistration = true;
  aliases = ['logros', 'trofeos', 'trophies'];
  usage = '!achievements [@usuario]';
  examples = ['!achievements', '!logros', '!achievements @5215551234567'];

  private readonly AVAILABLE_ACHIEVEMENTS = [
    {
      id: 'first_command',
      name: 'Primeros Pasos',
      description: 'Usa tu primer comando',
      emoji: '🎯',
      reward: 100,
    },
    {
      id: 'level_10',
      name: 'Novato Graduado',
      description: 'Alcanza el nivel 10',
      emoji: '🥉',
      reward: 500,
    },
    {
      id: 'level_25',
      name: 'Veterano en Ascenso',
      description: 'Alcanza el nivel 25',
      emoji: '🥈',
      reward: 1000,
    },
    {
      id: 'level_50',
      name: 'Maestro del Bot',
      description: 'Alcanza el nivel 50',
      emoji: '🏆',
      reward: 2500,
    },
    {
      id: 'level_100',
      name: 'Leyenda Viviente',
      description: 'Alcanza el nivel 100',
      emoji: '👑',
      reward: 10000,
    },
    {
      id: 'rich_1000',
      name: 'Emprendedor',
      description: 'Acumula $1,000',
      emoji: '💰',
      reward: 200,
    },
    {
      id: 'rich_10000',
      name: 'Millonario',
      description: 'Acumula $10,000',
      emoji: '💎',
      reward: 1000,
    },
    {
      id: 'daily_streak_7',
      name: 'Dedicación Semanal',
      description: 'Reclama daily por 7 días seguidos',
      emoji: '📅',
      reward: 500,
    },
    {
      id: 'daily_streak_30',
      name: 'Compromiso Total',
      description: 'Reclama daily por 30 días seguidos',
      emoji: '🔥',
      reward: 2000,
    },
    {
      id: 'commands_100',
      name: 'Usuario Activo',
      description: 'Usa 100 comandos',
      emoji: '⚡',
      reward: 300,
    },
    {
      id: 'commands_1000',
      name: 'Adicto al Bot',
      description: 'Usa 1,000 comandos',
      emoji: '🚀',
      reward: 1500,
    },
    {
      id: 'collector',
      name: 'Coleccionista',
      description: 'Consigue 10 items diferentes',
      emoji: '🎒',
      reward: 400,
    },
    {
      id: 'winner',
      name: 'Ganador',
      description: 'Gana tu primer juego',
      emoji: '🎮',
      reward: 250,
    },
    {
      id: 'helper',
      name: 'Ayudante Comunitario',
      description: 'Ayuda a 10 usuarios',
      emoji: '🤝',
      reward: 600,
    },
    {
      id: 'explorer',
      name: 'Explorador',
      description: 'Usa todos los comandos al menos una vez',
      emoji: '🗺️',
      reward: 1000,
    },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const targetJid = mentionedJid || ctx.sender.jid;
    const isSelf = targetJid === ctx.sender.jid;

    try {
      const user = await serviceManager.userService.getUser(targetJid);

      const achievements = user.achievements || [];

      const displayAchievements = user.isOwner
        ? this.AVAILABLE_ACHIEVEMENTS.map(a => a.id)
        : achievements;

      const unlockedCount = displayAchievements.length;
      const totalCount = this.AVAILABLE_ACHIEVEMENTS.length;
      const percentage = Math.floor((unlockedCount / totalCount) * 100);

      const progressBar = user.isOwner
        ? '█'.repeat(15)
        : this.createProgressBar(unlockedCount, totalCount, 15);

      const unlocked = this.AVAILABLE_ACHIEVEMENTS.filter(a => displayAchievements.includes(a.id));
      const locked = this.AVAILABLE_ACHIEVEMENTS.filter(a => !displayAchievements.includes(a.id));

      let unlockedList = '';
      unlocked.forEach(achievement => {
        unlockedList += `┃ ${achievement.emoji} ${achievement.name}\n`;
        unlockedList += `┃ └ ${achievement.description}\n`;
      });

      if (unlockedList === '') {
        unlockedList = '┃ Ninguno desbloqueado\n';
      }

      let nextAchievements = '';
      if (user.isOwner) {
        nextAchievements = '┃ 👑 Todos desbloqueados\n';
      } else {
        locked.slice(0, 3).forEach(achievement => {
          nextAchievements += `┃ 🔒 ${achievement.name}\n`;
        });

        if (locked.length === 0) {
          nextAchievements = '┃ 🎉 ¡Todos completados!\n';
        }
      }

      const message = `
┏━━━━━━━━━━━━━━━━━━━━━
┃ 🏆 *LOGROS*
┣━━━━━━━━━━━━━━━━━━━━━
┃
┃ ${user.name}
┃ ${unlockedCount}/${totalCount} (${percentage}%)
┃
┃ ${progressBar}
${user.isOwner ? '┃ 👑 Owner: COMPLETO\n┃' : ''}
┣━━━━━━━━━━━━━━━━━━━━━
┃ ✨ *Desbloqueados*
┣━━━━━━━━━━━━━━━━━━━━━
┃
${unlockedList}┃
┣━━━━━━━━━━━━━━━━━━━━━
┃ ${user.isOwner ? '👑' : '🔒'} *${user.isOwner ? 'Estado' : 'Próximos'}*
┣━━━━━━━━━━━━━━━━━━━━━
┃
${nextAchievements}┗━━━━━━━━━━━━━━━━━━━━━
${user.isOwner ? '\n👑 Todos disponibles' : isSelf && locked.length > 3 ? `\n💡 ${locked.length - 3} más por descubrir` : ''}
      `.trim();

      await ctx.reply(message);
    } catch (error) {
      logError('[AchievementsCommand] Error', error);
      await ctx.reply(' Error al obtener los logros');
    }
  }

  private createProgressBar(current: number, total: number, length: number): string {
    const percentage = Math.min(current / total, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;

    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  static getAchievementInfo(achievementId: string) {
    const cmd = new AchievementsCommand();
    return cmd.AVAILABLE_ACHIEVEMENTS.find(a => a.id === achievementId);
  }

  static async checkAndGrantAchievements(jid: string): Promise<string[]> {
    const user = await serviceManager.userService.getUser(jid);

    if (user.isOwner) {
      return [];
    }

    const currentAchievements = user.achievements || [];
    const newAchievements: string[] = [];

    const levelAchievements = [
      { level: 10, id: 'level_10' },
      { level: 25, id: 'level_25' },
      { level: 50, id: 'level_50' },
      { level: 100, id: 'level_100' },
    ];

    for (const { level, id } of levelAchievements) {
      if (user.level >= level && !currentAchievements.includes(id)) {
        currentAchievements.push(id);
        newAchievements.push(id);
      }
    }

    const moneyAchievements = [
      { money: 1000, id: 'rich_1000' },
      { money: 10000, id: 'rich_10000' },
    ];

    for (const { money, id } of moneyAchievements) {
      if (user.money >= money && !currentAchievements.includes(id)) {
        currentAchievements.push(id);
        newAchievements.push(id);
      }
    }

    const commandAchievements = [
      { commands: 1, id: 'first_command' },
      { commands: 100, id: 'commands_100' },
      { commands: 1000, id: 'commands_1000' },
    ];

    for (const { commands, id } of commandAchievements) {
      if (user.totalCommands >= commands && !currentAchievements.includes(id)) {
        currentAchievements.push(id);
        newAchievements.push(id);
      }
    }

    const inventory = user.inventory || [];
    const uniqueItems = new Set(inventory).size;
    if (uniqueItems >= 10 && !currentAchievements.includes('collector')) {
      currentAchievements.push('collector');
      newAchievements.push('collector');
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, {
        achievements: currentAchievements,
      });
    }

    return newAchievements;
  }
}
