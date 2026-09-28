import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { StickerService } from '@/services/media/StickerService.js';

export class TakeCommand extends Command {
  name = 'take';
  description = 'Change sticker pack name and author';
  category = CommandCategory.MEDIA;
  aliases = ['tomar', 'robarsticker'];
  usage = '!take <packname>|<author>';
  examples = ['!take VaniaBot|Carlos', '!take MyPack|MyName'];
  cooldown = 3000;

  private stickerService: StickerService;

  constructor() {
    super();
    this.stickerService = new StickerService();
  }

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;

    if (!quotedMsg || !quotedMsg.stickerMessage) {
      await ctx.reply('⚠️ *Reply to a sticker!*');
      return;
    }

    const text = ctx.args.join(' ');
    const [packname = 'VaniaBot', ...authorParts] = text.split('|');
    const author = authorParts.join('|') || 'VaniaBot';

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

      const sticker = await this.stickerService.addExif(buffer, packname.trim(), author.trim());

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: sticker });
      await ctx.react('✅');
    } catch (error) {
      logError('[TakeCommand] Error', error);
      await ctx.reply('❌ Could not modify sticker');
      await ctx.react('❌');
    }
  }
}
