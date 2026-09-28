import { Command } from '../../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const AMOR_TIPOS = ['mensaje', 'carta', 'poesia', 'piropo', 'dedicatoria'] as const;
type AmorTipo = (typeof AMOR_TIPOS)[number];

const EMOJIS: Record<AmorTipo, string> = {
  mensaje: '💕',
  carta: '💌',
  poesia: '🌹',
  piropo: '😏',
  dedicatoria: '🎵',
};

export class AmorCommand extends Command {
  name = 'amor';
  description = 'Genera mensajes de amor románticos';
  category = CommandCategory.FUN;
  aliases = ['romance', 'romantico', 'enamorar'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!amor [tipo] [para:nombre]';
  examples = ['!amor', '!amor mensaje', '!amor carta para:María', '!amor piropo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    let tipo: AmorTipo = 'mensaje';

    const tipoArg = args[0]?.toLowerCase();
    if (tipoArg && AMOR_TIPOS.includes(tipoArg as AmorTipo)) {
      tipo = tipoArg as AmorTipo;
    }

    const paraMatch = args.find((arg: string) => arg.startsWith('para:'));
    let paraNombre = '';
    if (paraMatch) {
      paraNombre = paraMatch.replace('para:', '').trim();
    }

    const tema = args.filter((arg: string) => !arg.startsWith('para:')).join(' ') || 'amor';

    await ctx.react(EMOJIS[tipo]);

    try {
      const prompt = this.buildPrompt(tipo, tema, paraNombre);
      const response = await aiService.chat(prompt, ctx.sender.jid, ctx.chat.jid);

      if (!isRight(response)) {
        await ctx.react('❌');
        await ctx.reply('No pude generar el mensaje. Intenta de nuevo.');
        return;
      }

      const header = paraNombre ? `💕 *Para: ${paraNombre}* 💕\n\n` : '💕 *Mensaje de Amor* 💕\n\n';

      await ctx.reply(header + response.right.trim());
      await ctx.react('💝');
    } catch {
      await ctx.react('❌');
      await ctx.reply('Ocurrió un error generando el mensaje. Intenta de nuevo.');
    }
  }

  private buildPrompt(tipo: AmorTipo, tema: string, para: string): string {
    const paraStr = para ? ` para ${para}` : '';

    switch (tipo) {
      case 'mensaje':
        return `Genera un mensaje de amor${paraStr} corto y dulce sobre "${tema}". 
        Debe ser romántico pero no cursi. Máximo 2-3 oraciones.`;

      case 'carta':
        return `Escribe una carta de amor${paraStr} breve y emotiva sobre "${tema}".
        Debe sonar auténtica y profunda. 1 párrafo.`;

      case 'poesia':
        return `Escribe un poema corto de amor${paraStr} sobre "${tema}".
        Puede tener rima o verso libre. 4-8 versos.`;

      case 'piropo':
        return `Genera un piropo${paraStr} originale y gracioso sobre "${tema}".
        Debe ser encantador y divertido. 1-2 oraciones.`;

      case 'dedicatoria':
        return `Escribe una dedicatoria de canción${paraStr} sobre "${tema}".
        Debe ser romántica y emotiva.`;

      default:
        return `Genera un mensaje de amor${paraStr} sobre "${tema}".`;
    }
  }
}

export class ShipCommand extends Command {
  name = 'ship';
  description = 'Calcula la compatibilidad amorosa entre dos personas';
  category = CommandCategory.FUN;
  aliases = ['compatibilidad', 'match'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!ship @persona1 @persona2';
  examples = ['!ship @usuario1 @usuario2'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const mentioned = ctx.contextInfo?.mentionedJid;
    if (!mentioned || mentioned.length < 2) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *shippeo* ˚₊· ͟͟͞͞➳\n\n` +
          `Menciona a dos personas y veo qué tan bien se llevan ✿\n\n` +
          `✩ ejemplo ✩\n` +
          `${ctx.args?.[0] || '!ship'} @persona1 @persona2`,
      );
      return;
    }

    const nombre1 = mentioned[0].split('@')[0];
    const nombre2 = mentioned[1].split('@')[0];

    await ctx.react('💕');

    const { final, breakdown } = this.calculateShip(nombre1, nombre2);
    const hearts = this.getHearts(final);
    const message = this.getShipMessage(final, nombre1, nombre2, breakdown);

    await ctx.reply(hearts + '\n\n' + message);
    await ctx.react('💝');
  }

  private calculateShip(
    name1: string,
    name2: string,
  ): { final: number; breakdown: Record<string, number> } {
    const lenDiff = Math.abs(name1.length - name2.length);
    const lengthScore = Math.round(Math.max(0, 100 - lenDiff * 10));

    const set1 = new Set(name1.toLowerCase());
    const set2 = new Set(name2.toLowerCase());
    const shared = [...set1].filter(c => set2.has(c)).length;
    const letterScore = Math.round((shared / Math.max(set1.size, set2.size)) * 100);

    const initialScore =
      name1[0]?.toLowerCase() === name2[0]?.toLowerCase()
        ? 100
        : Math.abs(name1.charCodeAt(0) - name2.charCodeAt(0)) < 5
          ? 70
          : 40;

    const charSum = (s: string) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const energyScore = (charSum(name1) * charSum(name2)) % 101;

    const final = Math.max(
      5,
      Math.min(
        99,
        Math.round(
          lengthScore * 0.2 + letterScore * 0.3 + initialScore * 0.15 + energyScore * 0.35,
        ),
      ),
    );

    return {
      final,
      breakdown: { lengthScore, letterScore, initialScore, energyScore },
    };
  }

  private getHearts(percentage: number): string {
    if (percentage >= 90) return '💘💘💘💘💘';
    if (percentage >= 70) return '💘💘💘💘';
    if (percentage >= 50) return '💘💘💘';
    if (percentage >= 30) return '💘💘';
    return '💘';
  }

  private getShipMessage(
    percentage: number,
    name1: string,
    name2: string,
    breakdown: Record<string, number>,
  ): string {
    const breakdown_text =
      `\n\n✦ afinidad de nombres: ${breakdown.lengthScore}%\n` +
      `✦ letras en común: ${breakdown.letterScore}%\n` +
      `✦ vibra inicial: ${breakdown.initialScore}%\n` +
      `✦ energía combinada: ${breakdown.energyScore}%`;

    if (percentage >= 90) {
      return (
        `˚₊· ͟͟͞͞➳ *¡${name1} y ${name2} son almas gemelas!* ˚₊· ͟͟͞͞➳\n\n` +
        `✩ compatibilidad: ${percentage}%\n\n` +
        `🌸 ¡amor eterno! Son perfectitos juntos 🌸` +
        breakdown_text
      );
    }
    if (percentage >= 70) {
      return (
        `˚₊· ͟͟͞͞➳ *¡${name1} y ${name2} hacen una pareja increíble!* ˚₊· ͟͟͞͞➳\n\n` +
        `✩ compatibilidad: ${percentage}%\n\n` +
        `🌸 tienen mucha química. ¡anímate! 🌸` +
        breakdown_text
      );
    }
    if (percentage >= 50) {
      return (
        `˚₊· ͟͟͞͞➳ *${name1} y ${name2} tienen potencial* ˚₊· ͟͟͞͞➳\n\n` +
        `✩ compatibilidad: ${percentage}%\n\n` +
        `🌸 el amor está en el aire. ¡quién sabe qué puede pasar! 🌸` +
        breakdown_text
      );
    }
    if (percentage >= 30) {
      return (
        `˚₊· ͟͟͞͞➳ *amor no correspondido...* ˚₊· ͟͟͞͞➳\n\n` +
        `✩ compatibilidad: ${percentage}%\n\n` +
        `🌸 hay más amistad que romance... pero quién sabe, el amor puede nacer 🌸` +
        breakdown_text
      );
    }
    return (
      `˚₊· ͟͟͞͞➳ *${name1} y ${name2}...* ˚₊· ͟͟͞͞➳\n\n` +
      `✩ compatibilidad: ${percentage}%\n\n` +
      `🌸 tal vez es mejor quedarse como amigos. ¡el mar está lleno de peces! 🌸` +
      breakdown_text
    );
  }
}
