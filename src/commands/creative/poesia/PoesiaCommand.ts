import { Command } from '../../Command.js';
import { poesiaService } from '@/services/creative/PoesiaService.js';
import {
  parsePoesiaArgs,
  HELP_TEXTS,
  ESTILOS_LIST,
  TEMAS_LIST,
} from '@/services/creative/PoesiaParser.js';
import { ContenidoTipo } from '@/services/creative/PoesiaTypes.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { primeService } from '@/services/system/PrimeService.js';
import { isRight } from '@/utils/either.js';

async function ejecutarPoesia(
  ctx: MessageContext,
  tipo: ContenidoTipo,
  rawArgs: string[],
): Promise<void> {
  const args = [...rawArgs];

  if (args[0]?.toLowerCase() === 'help') {
    await ctx.reply(HELP_TEXTS[tipo]);
    return;
  }

  const { opts } = parsePoesiaArgs(tipo, args);

  await ctx.react('✍️');

  const result = await poesiaService.generar(
    opts,
    ctx.sender.jid,
    ctx.sender.pushName ?? 'Alguien',
    ctx.chat.jid,
  );

  if (!isRight(result)) {
    await ctx.react('❌');
    await ctx.reply(
      `❌ ${result.left.message ?? 'No pude generar el contenido. Intenta de nuevo.'}`,
    );
    return;
  }

  await ctx.react('💝');
  const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
  const formattedFooter = footer.replace('>', '> _') + ' — Poesía & Amor_';
  await ctx.reply(poesiaService.formatEntry(result.right.entry, true, formattedFooter));
}

export class PoemaCommand extends Command {
  name = 'poema';
  description = 'Genera un poema sobre cualquier tema';
  category = CommandCategory.FUN;
  aliases = ['poem', 'poesia', 'poesía', 'verso'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!poema [tema] [estilo] [para:nombre]';
  examples = ['!poema amor', '!poema desamor melancólico', '!poema luna para:valeria'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ejecutarPoesia(ctx, ContenidoTipo.POEMA, ctx.args ?? []);
  }
}
export class FrasesCommand extends Command {
  name = 'frases';
  description = 'Genera 5 frases hermosas sobre un tema';
  category = CommandCategory.FUN;
  aliases = ['frase', 'cita', 'quotes'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!frases [tema] [estilo]';
  examples = ['!frases amor', '!frases vida apasionado', '!frases nostalgia'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ejecutarPoesia(ctx, ContenidoTipo.FRASE, ctx.args ?? []);
  }
}

export class PiropopCommand extends Command {
  name = 'piropo';
  description = 'Genera piropos creativos y originales';
  category = CommandCategory.FUN;
  aliases = ['piropos', 'flirt', 'ligar', 'requiebro'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!piropo [estilo] [para:nombre]';
  examples = ['!piropo', '!piropo pícaro', '!piropo tierno para:valeria', '!piropo chistoso'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args?.length ? ctx.args : ['romántico'];
    await ejecutarPoesia(ctx, ContenidoTipo.PIROPO, args);
  }
}

export class DedicatoriaCommand extends Command {
  name = 'dedicatoria';
  description = 'Genera una dedicatoria emotiva y personalizada';
  category = CommandCategory.FUN;
  aliases = ['dedica', 'dedicar', 'mensaje'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!dedicatoria [tema] [estilo] [para:nombre]';
  examples = [
    '!dedicatoria para:Valeria',
    '!dedicatoria cumpleaños para:Alejandra tierno',
    '!dedicatoria aniversario romántico',
  ];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ejecutarPoesia(ctx, ContenidoTipo.DEDICATORIA, ctx.args ?? []);
  }
}

export class HaikuCommand extends Command {
  name = 'haiku';
  description = 'Genera tres haikus sobre un tema';
  category = CommandCategory.FUN;
  aliases = ['haikus', 'hai'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!haiku [tema] [estilo]';
  examples = ['!haiku amor', '!haiku naturaleza místico', '!haiku noche oscuro'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args?.length ? ctx.args : ['amor'];
    await ejecutarPoesia(ctx, ContenidoTipo.HAIKU, args);
  }
}

export class SonetoCommand extends Command {
  name = 'soneto';
  description = 'Genera un soneto de 14 versos';
  category = CommandCategory.FUN;
  aliases = ['sonnet'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!soneto [tema] [estilo] [para:nombre]';
  examples = ['!soneto amor', '!soneto desamor clásico', '!soneto vida épico para:Valeria'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args?.length ? ctx.args : ['amor'];
    await ejecutarPoesia(ctx, ContenidoTipo.SONETO, args);
  }
}

export class CoplaCommand extends Command {
  name = 'copla';
  description = 'Genera coplas populares al estilo latinoamericano';
  category = CommandCategory.FUN;
  aliases = ['coplas', 'trova', 'estrofa'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!copla [tema] [estilo]';
  examples = ['!copla amor', '!copla vida pícaro', '!copla amistad chistoso'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args?.length ? ctx.args : ['amor'];
    await ejecutarPoesia(ctx, ContenidoTipo.COPLA, args);
  }
}

export class AcrosticoCommand extends Command {
  name = 'acrostico';
  description = 'Genera un acróstico con un nombre';
  category = CommandCategory.FUN;
  aliases = ['acrostic', 'acro'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!acrostico [NOMBRE] [tema] [estilo]';
  examples = [
    '!acrostico Valeria',
    '!acrostico Alejandra amor romántico',
    '!acrostico Daniela vida tierno',
  ];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args?.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *acróstico* ˚₊· ͟͟͞͞➳\n\n` +
          `Necesito un nombre para escribirte un verso por cada letra ✩\n\n` +
          `✿ *ejemplos:*\n` +
          `﹒!acrostico Alejandra\n` +
          `﹒!acrostico Daniela amor romántico\n` +
          `﹒!acrostico Valeria vida tierno\n\n` +
          `> _VaniaBot 💝 — versitos & ternura_`,
      );
      return;
    }
    await ejecutarPoesia(ctx, ContenidoTipo.ACROSTICO, ctx.args ?? []);
  }
}

export class CartaCommand extends Command {
  name = 'carta';
  description = 'Genera una carta de amor completa y emotiva';
  category = CommandCategory.FUN;
  aliases = ['cartaamor', 'love-letter', 'cartalove'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!carta [motivo] [estilo] [para:nombre]';
  examples = [
    '!carta para:valeria',
    '!carta despedida melancólico',
    '!carta primer amor romántico para:Alejandra',
  ];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ejecutarPoesia(ctx, ContenidoTipo.CARTA, ctx.args ?? []);
  }
}

export class HistoriaCommand extends Command {
  name = 'historia';
  description = 'Genera una historia corta de amor (microficción)';
  category = CommandCategory.FUN;
  aliases = ['cuento', 'story', 'relato', 'microficcion'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!historia [tema] [estilo]';
  examples = [
    '!historia amor',
    '!historia desamor melancólico',
    '!historia encuentro inesperado romántico',
  ];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args?.length ? ctx.args : ['amor'];
    await ejecutarPoesia(ctx, ContenidoTipo.HISTORIA, args);
  }
}

export class PoesiaMenuCommand extends Command {
  name = 'poesia';
  description = 'Menú del sistema de poesía y contenido creativo';
  category = CommandCategory.FUN;
  aliases = ['poetry', 'amor', 'enamorado', 'creative'];
  cooldown = 3000;
  contexts = [CommandContext.BOTH];
  usage = '!poesia';
  examples = ['!poesia'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *VaniaBot — poesía para el alma* ˚₊· ͟͟͞͞➳\n` +
        `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n\n` +
        `✿ *mis poemitas:*\n` +
        `﹒!poema [tema] [estilo] [para:nombre]\n` +
        `﹒!frases [tema] [estilo]\n` +
        `﹒!piropo [estilo] [para:nombre]\n` +
        `﹒!dedicatoria [tema] [estilo] [para:nombre]\n` +
        `﹒!haiku [tema] [estilo]\n` +
        `﹒!soneto [tema] [estilo]\n` +
        `﹒!copla [tema] [estilo]\n` +
        `﹒!acrostico [NOMBRE] [tema]\n` +
        `﹒!carta [motivo] [estilo] [para:nombre]\n` +
        `﹒!historia [tema] [estilo]\n\n` +
        `✩ *estilos:*\n${ESTILOS_LIST}\n\n` +
        `✩ *temas:*\n${TEMAS_LIST}\n\n` +
        `✿ *otros comanditos:*\n` +
        `﹒!votar [ID?] — votar el último contenido\n` +
        `﹒!poetop — ranking del grupo\n` +
        `﹒!poetop poema — top por tipo\n` +
        `﹒!poetastats — tus estadísticas\n\n` +
        `✿ *ejemplitos:*\n` +
        `_!poema amor romántico para:valeria_\n` +
        `_!piropo pícaro_\n` +
        `_!acrostico Valeria amor_\n` +
        `_!carta despedida melancólico para:Juan_\n\n` +
        `> _VaniaBot 💝 — versitos con amorcito_`,
    );
  }
}

export class VotarPoesiaCommand extends Command {
  name = 'votar';
  description = 'Vota el último poema o contenido del grupo';
  category = CommandCategory.FUN;
  aliases = ['voto', 'like', 'heart'];
  cooldown = 2000;
  contexts = [CommandContext.GROUP];
  usage = '!votar [ID?]';
  examples = ['!votar', '!votar A1B2C3'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const entryId = ctx.args?.[0]?.toUpperCase();
    const result = poesiaService.votar(ctx.chat.jid, ctx.sender.jid, entryId);

    if (!result.success) {
      if (result.alreadyVoted) {
        await ctx.react('😅');
        await ctx.reply(`😅 Ya votaste por ese contenido.`);
      } else {
        await ctx.reply(`❌ ${result.error}`);
      }
      return;
    }

    await ctx.react('❤️');
    await ctx.reply(`❤️ *¡Voto registrado!* — Total: ${result.newVotes} ❤️`);
  }
}

export class PoesiaTopCommand extends Command {
  name = 'poetop';
  description = 'Ranking de los mejores poemas y contenido del grupo';
  category = CommandCategory.FUN;
  aliases = ['poesiatop', 'toppoema', 'toppoesia', 'toppoetico'];
  cooldown = 10000;
  contexts = [CommandContext.GROUP];
  usage = '!poetop [tipo?]';
  examples = ['!poetop', '!poetop poema', '!poetop piropo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  private readonly TIPO_MAP: Record<string, ContenidoTipo> = {
    poema: ContenidoTipo.POEMA,
    frases: ContenidoTipo.FRASE,
    frase: ContenidoTipo.FRASE,
    piropo: ContenidoTipo.PIROPO,
    piropos: ContenidoTipo.PIROPO,
    dedicatoria: ContenidoTipo.DEDICATORIA,
    haiku: ContenidoTipo.HAIKU,
    soneto: ContenidoTipo.SONETO,
    copla: ContenidoTipo.COPLA,
    acrostico: ContenidoTipo.ACROSTICO,
    carta: ContenidoTipo.CARTA,
    historia: ContenidoTipo.HISTORIA,
    cuento: ContenidoTipo.HISTORIA,
  };

  async execute(ctx: MessageContext): Promise<void> {
    const rawTipo = ctx.args?.[0]?.toLowerCase();
    const tipo = rawTipo ? this.TIPO_MAP[rawTipo] : undefined;

    const top = poesiaService.getTop(ctx.chat.jid, 5, tipo);
    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    const formattedFooter = footer.replace('>', '> _') + ' — Poesía & Amor_';
    await ctx.reply(poesiaService.formatTop(top, tipo, formattedFooter));
  }
}

export class PoesiaStatsCommand extends Command {
  name = 'poetastats';
  description = 'Tus estadísticas de poesía en el grupo';
  category = CommandCategory.FUN;
  aliases = ['poestats', 'mipoesia', 'poetastat'];
  cooldown = 5000;
  contexts = [CommandContext.GROUP];
  usage = '!poetastats';
  examples = ['!poetastats'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const stats = poesiaService.getUserStats(ctx.chat.jid, ctx.sender.jid);
    const name = ctx.sender.pushName ?? 'Poeta';

    if (stats.total === 0) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ todavía no me has pedido nada lindo ˚₊· ͟͟͞͞➳\n\n` +
          `Prueba con *!poema*, *!frases*, *!piropo* y más ✿`,
      );
      return;
    }

    const byTipoLines = Object.entries(stats.byTipo)
      .map(([tipo, n]) => `  • ${tipo}: ${n}`)
      .join('\n');

    let msg =
      `📊 *Tu Poesía — ${name}*\n` +
      `━━━━━━━━━━━\n` +
      `✍️ Contenidos creados: ${stats.total}\n` +
      `❤️ Votos recibidos:    ${stats.totalVotes}\n\n`;

    if (byTipoLines) msg += `📂 *Por tipo:*\n${byTipoLines}\n\n`;

    if (stats.topEntry) {
      const preview = stats.topEntry.contenido.split('\n')[0].slice(0, 60) + '...';
      msg +=
        `🏆 *Tu mejor contenido* (${stats.topEntry.votes} ❤️):\n` +
        `_"${preview}"_\n` +
        `🆔 ID: ${stats.topEntry.id}\n\n`;
    }

    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    msg += footer.replace('>', '> _') + '_';
    await ctx.reply(msg);
  }
}
