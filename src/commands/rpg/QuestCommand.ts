import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { questService } from '@/services/rpg/QuestService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class QuestCommand extends Command {
  name = 'quest';
  description = 'Muestra las misiones disponibles';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['quest', 'misionrpg', 'missions'];
  usage = '!quest [info | daily | main | side]';
  examples = ['!quest', '!quest daily', '!quest main', '!quest info nombre'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0) {
      await this.listAllQuests(ctx);
      return;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'list':
      case 'disponibles':
        await this.listAllQuests(ctx);
        break;
      case 'daily':
      case 'diarias':
        await this.listDailyQuests(ctx);
        break;
      case 'main':
      case 'principales':
        await this.listMainQuests(ctx);
        break;
      case 'side':
      case 'secundarias':
        await this.listSideQuests(ctx);
        break;
      case 'info':
      case 'detalles':
        await this.questInfo(ctx, args.slice(1).join(' '));
        break;
      default:
        await this.listAllQuests(ctx);
    }
  }

  private async listAllQuests(ctx: MessageContext): Promise<void> {
    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);
      const message = questService.formatQuestList(user.level || 1);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar quests');
    }
  }

  private async listDailyQuests(ctx: MessageContext): Promise<void> {
    try {
      const quests = questService.getDailyQuests();

      let message = '📜 *MISIONES DIARIAS*\n\n';

      for (const quest of quests) {
        message += `• *${quest.name}*\n`;
        message += `  ${quest.description}\n`;
        message += `  🏆 XP: ${quest.rewards.xp} | 💰 $${quest.rewards.money}\n\n`;
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar quests diarias');
    }
  }

  private async listMainQuests(ctx: MessageContext): Promise<void> {
    try {
      const quests = questService.getMainQuests();

      let message = '📖 *MISIONES PRINCIPALES*\n\n';

      for (const quest of quests) {
        message += `• *${quest.name}*\n`;
        message += `  ${quest.description}\n`;
        message += `  🏆 XP: ${quest.rewards.xp} | 💰 $${quest.rewards.money}\n`;
        message += `  📊 Nivel: ${quest.requiredLevel}\n\n`;
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar quests principales');
    }
  }

  private async listSideQuests(ctx: MessageContext): Promise<void> {
    try {
      const quests = questService.getSideQuests();

      let message = '📋 *MISIONES SECUNDARIAS*\n\n';

      for (const quest of quests) {
        message += `• *${quest.name}*\n`;
        message += `  ${quest.description}\n`;
        message += `  🏆 XP: ${quest.rewards.xp} | 💰 $${quest.rewards.money}\n`;
        message += `  📊 Nivel: ${quest.requiredLevel}\n\n`;
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar quests secundarias');
    }
  }

  private async questInfo(ctx: MessageContext, questName: string): Promise<void> {
    if (!questName) {
      await ctx.reply(
        '❌ Especifica el nombre de la quest\n💡 *Ejemplo:* !quest info slime_extermination',
      );
      return;
    }

    try {
      const quest = questService.getQuestByName(questName);

      if (!quest) {
        await ctx.reply('❌ Quest no encontrada');
        return;
      }

      const message = questService.formatQuestDetails(quest);
      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener detalles de la quest');
    }
  }
}
