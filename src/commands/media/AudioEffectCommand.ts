/**
 * AudioEffectCommand.ts
 *
 * media command `audiofx` — Aplicar efectos de audio
 * Usage: !<efecto> responde a un audio
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
const getRandom = (ext: string) => `${Math.floor(Math.random() * 10000)}${ext}`;
const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-audio');

const EFFECTS: Record<string, { filter: string; description: string }> = {
  bass: { filter: '-af equalizer=f=94:width_type=o:width=2:g=30', description: 'Bass' },
  deep: { filter: '-af atempo=4/4,asetrate=44500*2/3', description: 'Deep' },
  fast: { filter: '-filter:a "atempo=1.63,asetrate=44100"', description: 'Fast' },
  slow: { filter: '-filter:a "atempo=0.7,asetrate=44100"', description: 'Slow' },
  nightcore: { filter: '-af atempo=1.06,asetrate=44100*1.25', description: 'Nightcore' },
  robot: {
    filter:
      "-filter_complex \"afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75\"",
    description: 'Robot',
  },
  tupai: { filter: '-filter:a "atempo=0.5,asetrate=65100"', description: 'Tupai/Chipmunk' },
  reverse: { filter: '-filter_complex "areverse"', description: 'Reverse' },
  earrape: { filter: '-af volume=12', description: 'Earrape' },
  blown: { filter: '-af acrusher=.1:1:64:0:log', description: 'Blown' },
  fat: { filter: '-filter:a "atempo=1.6,asetrate=22100"', description: 'Fat' },
};

/** Command handler for `!audiofx`: Aplicar efectos de audio. */
export class AudioEffectCommand extends Command {
  name = 'audiofx';
  description = 'Aplicar efectos de audio';
  category = CommandCategory.MEDIA;
  aliases = Object.keys(EFFECTS);
  usage = '!<efecto> responde a un audio';
  examples = Object.keys(EFFECTS).map(e => `!${e} (responde a audio)`);
  cooldown = 30_000;

  async execute(ctx: MessageContext): Promise<void> {
    const commandName = ctx.command.toLowerCase();
    const effect = EFFECTS[commandName];

    if (!effect) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *efectos disponibles* ˚₊· ͟͟͞͞➳\n\n` +
          Object.keys(EFFECTS)
            .map(e => `✿ *!${e}*`)
            .join('\n') +
          `\n\n✩ Responde a un audio con el comando.`,
      );
      return;
    }

    const quotedMsg = ctx.quoted;
    const quotedMsgId = ctx.quotedMessageId;
    const quotedParticipant = ctx.quotedParticipant;

    if (!quotedMsg || !quotedMsg.audioMessage) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta el audio* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ Responde a un *audio/nota de voz* con *!${commandName}*`,
      );
      return;
    }

    const mime = quotedMsg.audioMessage.mimetype ?? '';
    if (!mime.includes('audio')) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *no es audio* ˚₊· ͟͟͞͞➳\n\n` + `✿ Necesito que respondas a un *audio/nota de voz*.`,
      );
      return;
    }

    await ctx.react('⏳');

    const inputFile = path.join(TMP_DIR, `input_${getRandom('.mp3')}`);
    const outputFile = path.join(TMP_DIR, `output_${getRandom('.ogg')}`);

    try {
      fs.mkdirSync(TMP_DIR, { recursive: true });

      const messageToDownload: WAMessage = {
        key: {
          id: quotedMsgId || '',
          remoteJid: quotedParticipant || ctx.chat.jid,
          fromMe: false,
        },
        message: {
          audioMessage: quotedMsg.audioMessage,
        },
        messageTimestamp: Date.now(),
        pushName: '',
        status: 0,
      };

      const mediaBuffer = (await downloadMediaMessage(messageToDownload, 'buffer', {})) as Buffer;

      fs.writeFileSync(inputFile, mediaBuffer);

      const ffmpegCommand = `ffmpeg -y -i "${inputFile}" ${effect.filter} -c:a libopus -b:a 64k "${outputFile}"`;
      logger.info(`[AudioEffectCommand] Running: ${ffmpegCommand}`);

      const { stderr } = await execAsync(ffmpegCommand);
      if (stderr) logger.debug(`[AudioEffectCommand] ffmpeg stderr: ${stderr}`);

      const outputBuffer = fs.readFileSync(outputFile);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        audio: outputBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      });

      await ctx.react('✅');
    } catch (error) {
      logger.error('[AudioEffectCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude aplicar el efecto. Intenta con otro audio.`,
      );
    } finally {
      for (const f of [inputFile, outputFile]) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch {
          /* ignorar */
        }
      }
    }
  }
}
