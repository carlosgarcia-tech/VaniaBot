import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import type { Poll } from '@/services/system/PersistenceService.js';
import { persistenceService } from '@/services/system/PersistenceService.js';
import { formatTime } from '@/utils/helpers.js';

export class PollCommand extends Command {
  name = 'encuesta';
  description = 'Crea y gestiona encuestas con múltiples opciones.';
  category = CommandCategory.UTILITY;
  // Sin alias 'votar': es el name de VotarPoesiaCommand (votar poemas).
  aliases = ['poll', 'votacion'];
  usage = '!encuesta "Pregunta" "Op1" "Op2" "Op3..."';
  examples = [
    '!encuesta "¿Cuál es tu color favorito?" "Rojo" "Azul" "Verde" "Amarillo"',
    '!encuesta "¿Qué comemos hoy?" "Pizza" "Tacos" "Sushi"',
    '!encuesta votar 1',
    '!encuesta resultado',
    '!encuesta cerrar',
  ];
  cooldown = 3000;
  contexts = [CommandContext.BOTH];

  private buildResultsText(poll: Poll, showBar = true): string {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);

    const optionLines = poll.options.map((opt, i) => {
      const count = opt.votes.length;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const bar = showBar ? this.buildBar(pct) : '';
      return (
        `${i + 1}️⃣ *${opt.label}*\n` + `   ${bar} ${pct}% — ${count} voto${count !== 1 ? 's' : ''}`
      );
    });

    return optionLines.join('\n\n');
  }

  private buildBar(pct: number): string {
    const filled = Math.round(pct / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  private parseQuotedArgs(input: string): string[] {
    const result: string[] = [];
    const regex = /"([^"]+)"/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
      result.push(match[1].trim());
    }
    return result;
  }

  async execute(ctx: MessageContext): Promise<void> {
    const sub = ctx.args[0]?.toLowerCase();

    if (sub === 'votar' || sub === 'voto' || sub === 'v') {
      await this.handleVote(ctx);
      return;
    }

    if (['resultado', 'resultados', 'result', 'r', 'ver'].includes(sub)) {
      await this.handleResults(ctx);
      return;
    }

    if (['cerrar', 'close', 'finalizar', 'fin', 'end'].includes(sub)) {
      await this.handleClose(ctx);
      return;
    }

    if (['cancelar', 'cancel', 'borrar', 'delete'].includes(sub)) {
      await this.handleCancel(ctx);
      return;
    }

    if (!ctx.args.length || sub === 'ayuda' || sub === 'help') {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *encuestas — VaniaBot* ˚₊· ͟͟͞͞➳\n` +
          `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n\n` +
          `✿ *para crear:*\n` +
          `  ﹒!encuesta "Pregunta" "Op1" "Op2" "Op3"...\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!encuesta "¿Qué comemos?" "Pizza" "Tacos" "Sushi"\n\n` +
          `♡ *qué más puedo hacer:*\n` +
          `  ﹒!encuesta votar <número>\n` +
          `  ﹒!encuesta resultado\n` +
          `  ﹒!encuesta cerrar\n` +
          `  ﹒!encuesta cancelar\n\n` +
          `✨ *cositas extra:*\n` +
          `  ﹒pon \`multi\` al final para permitir múltiples votos por persona\n` +
          `  ﹒pon \`Xm\` o \`Xh\` para cierre automático\n` +
          `  ﹒ejemplo: !encuesta "¿Color?" "Rojo" "Azul" 30m ✨`,
      );
      return;
    }

    await this.handleCreate(ctx);
  }

  private async handleCreate(ctx: MessageContext): Promise<void> {
    const raw = ctx.args.join(' ');
    const quoted = this.parseQuotedArgs(raw);

    if (quoted.length < 2) {
      await ctx.reply(
        `❌ Formato incorrecto.\n\n` +
          `*Uso:* !encuesta "Pregunta" "Opción1" "Opción2" ...\n` +
          `*Mínimo:* 1 pregunta + 2 opciones\n` +
          `*Máximo:* 10 opciones\n\n` +
          `Recuerda usar *comillas* para cada texto.`,
      );
      return;
    }

    if (quoted.length > 11) {
      await ctx.reply('❌ Máximo 10 opciones por encuesta.');
      return;
    }

    const existing = persistenceService.getPoll(ctx.chat.jid);
    if (existing && !existing.closed) {
      await ctx.reply(
        `❌ Ya hay una encuesta activa en este chat.\n` +
          `Ciérrala primero con *!encuesta cerrar*\n` +
          `o cancélala con *!encuesta cancelar*.`,
      );
      return;
    }

    const question = quoted[0];
    const optionLabels = quoted.slice(1);

    const unique = new Set(optionLabels.map(o => o.toLowerCase()));
    if (unique.size !== optionLabels.length) {
      await ctx.reply('❌ Las opciones no pueden repetirse.');
      return;
    }

    const rawWithoutQuoted = raw
      .replace(/"[^"]+"/g, '')
      .trim()
      .toLowerCase();
    const allowMultiple = rawWithoutQuoted.includes('multi');

    let endsAt: number | undefined;
    const timeMatch = rawWithoutQuoted.match(/(\d+)(m|h)/);
    if (timeMatch) {
      const val = parseInt(timeMatch[1]);
      const unit = timeMatch[2];
      const ms = unit === 'h' ? val * 3_600_000 : val * 60_000;
      endsAt = Date.now() + ms;
    }

    const poll: Poll = {
      id: persistenceService.generateId(),
      chatJid: ctx.chat.jid,
      creatorJid: ctx.sender.jid,
      question,
      options: optionLabels.map(label => ({ label, votes: [] })),
      allowMultiple,
      createdAt: Date.now(),
      endsAt,
      closed: false,
    };

    persistenceService.addPoll(ctx.chat.jid, poll);

    const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const optLines = poll.options.map((opt, i) => `${numbers[i]} ${opt.label}`).join('\n');

    const flags = [];
    if (allowMultiple) flags.push('✅ Múltiples votos permitidos');
    if (endsAt) flags.push(`⏰ Cierra en ${formatTime(endsAt - Date.now())}`);

    const msg =
      `📊 *Nueva encuesta*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `❓ *${question}*\n\n` +
      `${optLines}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      (flags.length ? flags.join('\n') + '\n' : '') +
      `\n*Para votar:* !encuesta votar <número>\n` +
      `*Resultados:* !encuesta resultado`;

    await ctx.reply(msg);
  }

  private async handleVote(ctx: MessageContext): Promise<void> {
    const poll = persistenceService.getPoll(ctx.chat.jid);

    if (!poll || poll.closed) {
      await ctx.reply('❌ No hay ninguna encuesta activa en este chat.');
      return;
    }

    const voteArg = ctx.args[1];
    if (!voteArg) {
      const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const optLines = poll.options.map((opt, i) => `${numbers[i]} ${opt.label}`).join('\n');

      await ctx.reply(
        `📊 *${poll.question}*\n\n` + `${optLines}\n\n` + `*Uso:* !encuesta votar <número>`,
      );
      return;
    }

    const voteIndex = parseInt(voteArg) - 1;
    if (isNaN(voteIndex) || voteIndex < 0 || voteIndex >= poll.options.length) {
      await ctx.reply(`❌ Número inválido. Elige entre *1* y *${poll.options.length}*.`);
      return;
    }

    const userJid = ctx.sender.jid;
    const chosenOption = poll.options[voteIndex];

    if (!poll.allowMultiple) {
      const alreadyVotedIndex = poll.options.findIndex(o => o.votes.includes(userJid));

      if (alreadyVotedIndex !== -1) {
        if (alreadyVotedIndex === voteIndex) {
          poll.options[alreadyVotedIndex].votes = poll.options[alreadyVotedIndex].votes.filter(
            v => v !== userJid,
          );
          persistenceService.updatePoll(ctx.chat.jid, poll);
          await ctx.react('↩️');
          await ctx.reply(`↩️ Retiraste tu voto de *"${chosenOption.label}"*.`);
          return;
        }
        poll.options[alreadyVotedIndex].votes = poll.options[alreadyVotedIndex].votes.filter(
          v => v !== userJid,
        );
        poll.options[voteIndex].votes.push(userJid);
        persistenceService.updatePoll(ctx.chat.jid, poll);
        await ctx.react('🔄');
        await ctx.reply(
          `🔄 Cambiaste tu voto a *"${chosenOption.label}"*.\n` +
            `_(Voto anterior: "${poll.options[alreadyVotedIndex].label}")_`,
        );
        return;
      }
    } else {
      if (chosenOption.votes.includes(userJid)) {
        chosenOption.votes = chosenOption.votes.filter(v => v !== userJid);
        persistenceService.updatePoll(ctx.chat.jid, poll);
        await ctx.react('↩️');
        await ctx.reply(`↩️ Retiraste tu voto de *"${chosenOption.label}"*.`);
        return;
      }
    }

    chosenOption.votes.push(userJid);
    persistenceService.updatePoll(ctx.chat.jid, poll);
    const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0);

    await ctx.react('✅');
    await ctx.reply(
      `✅ *@${ctx.sender.jid.split('@')[0]}* votó por *"${chosenOption.label}"*\n` +
        `📊 Total de votos: ${totalVotes}`,
    );
  }

  private async handleResults(ctx: MessageContext): Promise<void> {
    const poll = persistenceService.getPoll(ctx.chat.jid);

    if (!poll) {
      await ctx.reply('❌ No hay ninguna encuesta activa en este chat.');
      return;
    }

    const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0);
    const status = poll.closed ? '🔒 *Cerrada*' : '🟢 *En curso*';

    const msg =
      `📊 *Resultados — ${poll.question}*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${this.buildResultsText(poll)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📌 *Total de votos:* ${totalVotes}\n` +
      `${status}` +
      (poll.endsAt && !poll.closed
        ? `\n⏰ *Cierra en:* ${formatTime(poll.endsAt - Date.now())}`
        : '');

    await ctx.reply(msg);
  }

  private async handleClose(ctx: MessageContext): Promise<void> {
    const poll = persistenceService.getPoll(ctx.chat.jid);

    if (!poll || poll.closed) {
      await ctx.reply('❌ No hay ninguna encuesta activa para cerrar.');
      return;
    }

    const canClose = poll.creatorJid === ctx.sender.jid || ctx.sender.isAdmin || ctx.sender.isOwner;

    if (!canClose) {
      await ctx.reply('❌ Solo el creador de la encuesta o un admin puede cerrarla.');
      return;
    }

    poll.closed = true;
    persistenceService.updatePoll(ctx.chat.jid, poll);

    const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0);
    const sorted = [...poll.options].sort((a, b) => b.votes.length - a.votes.length);
    const winner = sorted[0];
    const isDraw = sorted.length > 1 && sorted[0].votes.length === sorted[1].votes.length;

    const msg =
      `🔒 *Encuesta cerrada*\n\n` +
      `❓ *${poll.question}*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${this.buildResultsText(poll)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📌 *Total de votos:* ${totalVotes}\n` +
      (totalVotes > 0
        ? isDraw
          ? `🤝 *Empate entre las primeras opciones*`
          : `🏆 *Ganador:* ${winner.label} con ${winner.votes.length} voto${winner.votes.length !== 1 ? 's' : ''}`
        : `_(sin votos)_`);

    await ctx.reply(msg);
  }

  private async handleCancel(ctx: MessageContext): Promise<void> {
    const poll = persistenceService.getPoll(ctx.chat.jid);

    if (!poll) {
      await ctx.reply('❌ No hay ninguna encuesta activa para cancelar.');
      return;
    }

    const canCancel =
      poll.creatorJid === ctx.sender.jid || ctx.sender.isAdmin || ctx.sender.isOwner;

    if (!canCancel) {
      await ctx.reply('❌ Solo el creador de la encuesta o un admin puede cancelarla.');
      return;
    }

    persistenceService.removePoll(ctx.chat.jid);
    await ctx.react('🗑️');
    await ctx.reply('🗑️ Encuesta cancelada y eliminada.');
  }
}
