/**
 * ToGifAudCommand.ts
 *
 * media command `togifaud` — Convertir video a GIF
 * Usage: !togifaud (responde a video)
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { downloadMediaMessage, type WAMessage } from 'baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '@/utils/logger.js';

const execAsync = promisify(exec);
const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-togif');

/** Command handler for `!togifaud`: Convertir video a GIF. */
export class ToGifAudCommand extends Command {
  name = 'togifaud';
  description = 'Convertir video a GIF';
  category = CommandCategory.MEDIA;
  aliases = ['togif'];
  usage = '!togifaud (responde a video)';
  examples = ['!togifaud'];
  cooldown = 30_000;

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;

    if (!quotedMsg || !quotedMsg.videoMessage) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta el video* ˚₊· ͟͟͞͞➳\n\n` + `✿ Responde a un *video* con *!togifaud*`,
      );
      return;
    }

    const mime = quotedMsg.videoMessage.mimetype || '';
    if (!mime.includes('video')) {
      await ctx.reply(`˚₊· ͟͟͞͞➳ *no es video* ˚₊· ͟͟͞͞➳\n\n` + `✿ Necesito que respondas a un *video*.`);
      return;
    }

    await ctx.react('⏳');

    try {
      if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
      }

      const messageToDownload: WAMessage = {
        key: {
          id: quotedMsgId || '',
          remoteJid: quotedParticipant || ctx.chat.jid,
          fromMe: false,
        },
        message: {
          videoMessage: quotedMsg.videoMessage,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const mediaBuffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;

      const inputFile = path.join(TMP_DIR, `input_${Date.now()}.mp4`);
      const outputFile = path.join(TMP_DIR, `output_${Date.now()}.gif`);

      fs.writeFileSync(inputFile, mediaBuffer);

      const ffmpegCommand = `ffmpeg -i "${inputFile}" -vf "fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${outputFile}"`;

      await execAsync(ffmpegCommand);

      const outputBuffer = fs.readFileSync(outputFile);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: outputBuffer,
        gifPlayback: true,
        caption: 'Aquí está 🐢',
      });

      fs.unlinkSync(inputFile);
      fs.unlinkSync(outputFile);

      await ctx.react('✅');
    } catch (error) {
      logger.error('[ToGifAudCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(`˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude convertir el video a GIF.`);
    }
  }
}
