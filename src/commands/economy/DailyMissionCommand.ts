import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { dailyMissionService } from '@/services/rpg/DailyMissionService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

export class DailyMissionCommand extends Command {
  name = 'misiones';
  description = 'Misiones diarias con recompensas';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['mission', 'mision', 'misiones'];
  usage = '!misiones [reclamar id]';
  examples = ['!misiones', '!misiones reclamar trabajador'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const action = args[0]?.toLowerCase();

    if (action === 'reclamar' || action === 'claim') {
      const missionId = args[1];
      if (!missionId) {
        await ctx.reply(
          '❌ Especifica el ID de la misión\n\n💡 Usa !misiones para ver las misiones disponibles',
        );
        return;
      }
      await this.claimReward(ctx, missionId);
      return;
    }

    await this.showMissions(ctx);
  }

  private async showMissions(ctx: MessageContext): Promise<void> {
    await serviceManager.userService.getUser(ctx.sender.jid);
    const { missions, missionsData } = await dailyMissionService.getUserMissionStatus(
      ctx.sender.jid,
    );

    let message = `📋 *MISIONES DIARIAS*\n\n`;
    message += `✨ Usa !misiones reclamar [id] para reclamar\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (let i = 0; i < missions.length; i++) {
      const mission = missionsData[i];
      const progress = missions[i];

      if (!mission) continue;

      const status = progress.claimed ? '✅' : progress.completed ? '🎉' : '⏳';

      const progressBar = this.createProgressBar(progress.progress, mission.target, 10);

      message += `${status} *${mission.emoji} ${mission.name}*\n`;
      message += `   ${mission.description}\n`;
      message += `   📊 ${progressBar} ${progress.progress}/${mission.target}\n`;
      message += `   💰 $${mission.reward} | ✨ ${mission.xpReward} XP\n`;
      message += `   ID: \`${mission.id}\`\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💡 *ejemplo:* !misiones reclamar trabajador`;

    await ctx.reply(message);
  }

  private async claimReward(ctx: MessageContext, missionId: string): Promise<void> {
    const result = await dailyMissionService.claimReward(ctx.sender.jid, missionId);

    if (result.success) {
      await ctx.reply(result.message);
      await ctx.react('🎉');
    } else {
      await ctx.reply(result.message);
    }
  }

  private createProgressBar(current: number, total: number, length: number): string {
    const percentage = Math.min(current / total, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
