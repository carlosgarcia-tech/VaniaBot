/**
 * TakeCommand.ts
 *
 * media command `take` — Change sticker pack name and author
 * Usage: !take <text>  |  !take <packname>|<author>
 *
 * Behavior:
 *  - `!wm Carlos`          → pack = "Carlos", author = "" (vacío, aparece una sola vez)
 *  - `!wm Carlos|Garcia`   → pack = "Carlos", author = "Garcia"
 *  - `!wm`                 → pack = "OrbitBot", author = "OrbitBot"
 *
 * The text is used EXACTLY as provided (any Unicode: emojis, math alphanumerics,
 * combining marks, RTL scripts, decorative symbols). No normalization, no
 * length-based slicing, no stripping of special characters.
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { StickerService } from '@/services/media/StickerService.js';

const DEFAULT_PACK = 'OrbitBot';
const DEFAULT_AUTHOR = 'OrbitBot';
const SEPARATOR = '|';

/** Command handler for `!take`: Change sticker pack name and author. */
export class TakeCommand extends Command {
  name = 'take';
  description = 'Change sticker pack name and author';
  category = CommandCategory.MEDIA;
  aliases = ['wm', 'robarsticker', 'tomar'];
  usage = '!take <text> | !take <packname>|<author>';
  examples = [
    '!wm Carlos',
    '!wm ٠࣪⭑ 𝓒𝓪𝓻𝓵𝓸𝓼 𝓖 ˖᯽',
    '!take OrbitBot|Carlos',
    '!wm Carlos|Garcia',
  ];
  cooldown = 3000;

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  /**
   * Parses the user text into pack name and author.
   * - empty text            → defaults
   * - text without `|`      → text goes only to pack, author stays empty
   * - text with `|`         → before = pack, after (rest) = author
   * Only leading/trailing whitespace is trimmed; inner content is untouched.
   */
  private parseText(raw: string): { packname: string; author: string } {
    const text = raw.trim();

    if (!text) {
      return { packname: DEFAULT_PACK, author: DEFAULT_AUTHOR };
    }

    // Sin "|": el texto va SOLO al packname, el autor queda vacío
    if (!text.includes(SEPARATOR)) {
      return { packname: text, author: '' };
    }

    const [packPart = '', ...authorParts] = text.split(SEPARATOR);
    const packname = packPart.trim();
    const author = authorParts.join(SEPARATOR).trim();

    // "!wm |" or "!wm  | " → nothing useful provided, use defaults
    if (!packname && !author) {
      return { packname: DEFAULT_PACK, author: DEFAULT_AUTHOR };
    }

    return { packname, author };
  }

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;

    if (!quotedMsg || !quotedMsg.stickerMessage) {
      await ctx.reply('⚠️ *Reply to a sticker!*');
      return;
    }

    const { packname, author } = this.parseText(ctx.args.join(' '));

    await ctx.react('⏳');

    try {
      const messageToDownload: WAMessage = {
        key: {
          id: quotedMsgId || '',
          remoteJid: quotedParticipant || ctx.chat.jid,
          fromMe: false,
        },
        message: {
          stickerMessage: quotedMsg.stickerMessage,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const buffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;

      const sticker = await this.stickerService.addExif(buffer, packname, author);

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: sticker });
      await ctx.react('✅');
    } catch (error) {
      logError('[TakeCommand] Error', error);
      await ctx.reply('❌ Could not modify sticker');
      await ctx.react('❌');
    }
  }
}