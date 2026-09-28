import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import {
  ConverterService,
  type OverlayPosition,
  type BackgroundRemoval,
  type WatermarkMode,
} from '@/services/media/ConverterService.js';
import { getContextInfo } from '@/utils/getContextInfo.js';
import { logError } from '@/utils/logger.js';

const converterService = new ConverterService();

const POSITION_MAP: Record<string, OverlayPosition> = {
  br: 'br',
  'abajo-derecha': 'br',
  'inferior-derecho': 'br',
  bl: 'bl',
  'abajo-izquierda': 'bl',
  'inferior-izquierdo': 'bl',
  tr: 'tr',
  'arriba-derecha': 'tr',
  'superior-derecho': 'tr',
  tl: 'tl',
  'arriba-izquierda': 'tl',
  'superior-izquierdo': 'tl',
  center: 'center',
  centro: 'center',
  medio: 'center',
};

export class WatermarkCommand extends Command {
  name = 'watermark';
  description =
    'Marca una imagen con un logo (watermark). Responde a la imagen y adjunta el logo en el caption.';
  category = CommandCategory.MEDIA;
  aliases = ['wm', 'marcadeagua', 'marcar'];
  usage =
    '!watermark [posición|tile] [opacidad%] [filasxcolumnas] [nobg] (responde a imagen + adjunta logo en caption)';
  examples = [
    '!watermark',
    '!watermark center',
    '!watermark tl 60',
    '!watermark tile',
    '!watermark tile 4x4 25',
  ];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const contextInfo = getContextInfo(ctx.message.message);
    const quotedMsg = contextInfo?.quotedMessage;
    const quotedImage = quotedMsg?.imageMessage;
    const quotedSticker = quotedMsg?.stickerMessage;
    const hasQuoted = !!(quotedImage || quotedSticker);

    const directImage = ctx.message.message?.imageMessage;
    const directSticker = ctx.message.message?.stickerMessage;
    const hasDirect = !!(directImage || directSticker);

    if (!hasQuoted) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *watermark* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  1. Responde a la imagen que quieres marcar\n` +
          `  2. Adjunta el logo en el caption con *!watermark*\n\n` +
          `✩ *posición:* br (default), bl, tr, tl, center\n` +
          `  ﹒!watermark tl   → esquina superior izquierda\n\n` +
          `✩ *tile/mosaico:* repite el logo por toda la imagen\n` +
          `  ﹒!watermark tile   → grilla 3x3 default\n` +
          `  ﹒!watermark tile 4x4 25   → grilla 4x4 al 25% opacidad\n\n` +
          `✩ *opacidad:* agrega un número 1-100 (default 85, 35 en tile)\n` +
          `  ﹒!watermark tl 50   → 50% de opacidad\n\n` +
          `✩ *fondo del logo:* se remueve automático si es blanco o negro sólido\n` +
          `  ﹒!watermark br nobg   → desactiva la remoción de fondo`,
      );
      return;
    }

    if (!hasDirect) {
      await ctx.reply(
        '❌ Adjunta el logo como imagen junto al comando *!watermark* en el caption.',
      );
      return;
    }

    let position: OverlayPosition = 'br';
    let mode: WatermarkMode = 'single';
    let opacity: number | undefined;
    let removeBackground: BackgroundRemoval = 'auto';
    let tileRows: number | undefined;
    let tileCols: number | undefined;

    for (const rawArg of ctx.args) {
      const arg = rawArg.toLowerCase().replace('%', '');

      if (POSITION_MAP[arg]) {
        position = POSITION_MAP[arg];
        continue;
      }

      if (arg === 'tile' || arg === 'spam' || arg === 'mosaico' || arg === 'repetir') {
        mode = 'tile';
        continue;
      }

      if (arg === 'nobg' || arg === 'sinfondo' || arg === 'confondo') {
        removeBackground = 'none';
        continue;
      }

      const gridMatch = arg.match(/^(\d+)x(\d+)$/);
      if (gridMatch) {
        tileRows = Math.min(10, Math.max(1, parseInt(gridMatch[1], 10)));
        tileCols = Math.min(10, Math.max(1, parseInt(gridMatch[2], 10)));
        continue;
      }

      const num = Number(arg);
      if (!isNaN(num) && num > 0 && num <= 100) {
        opacity = num / 100;
        continue;
      }
    }

    await ctx.react('⏳');

    try {
      const quotedMsgId = contextInfo?.stanzaId;
      const quotedParticipant = contextInfo?.participant;

      const bgMessage: WAMessage = {
        key: {
          id: quotedMsgId || '',
          remoteJid: quotedParticipant || ctx.chat.jid,
          fromMe: false,
        },
        message: {
          imageMessage: quotedImage || undefined,
          stickerMessage: quotedSticker || undefined,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const logoMessage: WAMessage = {
        key: {
          id: ctx.message.key?.id || '',
          remoteJid: ctx.message.key?.remoteJid || ctx.chat.jid,
          fromMe: ctx.message.key?.fromMe || false,
        },
        message: {
          imageMessage: directImage || undefined,
          stickerMessage: directSticker || undefined,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const [background, logo] = await Promise.all([
        downloadMediaMessage(bgMessage, 'buffer', {}) as Promise<Buffer>,
        downloadMediaMessage(logoMessage, 'buffer', {}) as Promise<Buffer>,
      ]);

      const result = await converterService.overlayImage(background, logo, {
        position,
        padding: 10,
        opacity,
        removeBackground,
        mode,
        tileRows,
        tileCols,
      });

      const opacityLabel =
        opacity !== undefined ? `${Math.round(opacity * 100)}%` : mode === 'tile' ? '35%' : '85%';

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: result,
        caption:
          `🖼️ *Imagen marcada con watermark*\n━━━━━━━━━━━━━━\n` +
          (mode === 'tile'
            ? `🔲 Modo: mosaico (${tileRows ?? 3}x${tileCols ?? 3})\n`
            : `📍 Posición: ${position}\n`) +
          `🎚️ Opacidad: ${opacityLabel}`,
      });

      await ctx.react('✅');
    } catch (error) {
      logError('[WatermarkCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al aplicar el watermark. Intenta de nuevo.');
    }
  }
}
