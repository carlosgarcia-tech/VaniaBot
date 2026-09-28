/**
 * @fileoverview CuevanaCommand.ts - Search and download movies/series
 *
 * Searches and downloads movies and series from Cuevana.
 * Adapted without interactive buttons for newer Baileys versions.
 *
 * @module commands/media/download/CuevanaCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { cuevanaService } from '@/services/download/CuevanaService.js';
import { logError } from '@/utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-cuevana');

export class CuevanaCommand extends Command {
  name = 'cuevana';
  description = 'Busca y descarga películas/series de Cuevana';
  category = CommandCategory.MEDIA;
  aliases = ['cv', 'cuevana', 'serie'];
  usage = '!cv <título>';
  examples = ['!cv avatar', '!cv rick and morty'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private async ensureTmpDir(): Promise<void> {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async execute(ctx: MessageContext): Promise<void> {
    const input = ctx.args.join(' ').trim();

    if (!input) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Cuevana* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!cv <título>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!cv avatar\n` +
          `  ﹒!cv rapidos y furiosos`,
      );
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Buscando en Cuevana: "${input}"...`);

    try {
      const result = await cuevanaService.search(input);

      if (result._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message}`);
        return;
      }

      const text = cuevanaService.formatSearchResults(result.right, input);
      await ctx.reply(text);

      await ctx.react('✅');
    } catch (error) {
      logError('CuevanaCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar en Cuevana');
    }
  }
}

export class CuevanaDLCommand extends Command {
  name = 'cuevanadl';
  description = 'Ver opciones de descarga de una película/serie';
  category = CommandCategory.MEDIA;
  aliases = ['cvdl'];
  usage = '!cvdl <slug> [tipo]';
  examples = ['!cvdl avatar-el-camino-del-agua movie', '!cvdl the-last-of-us series'];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const slug = ctx.args[0]?.trim();
    const type = ctx.args[1]?.trim() || 'movie';

    if (!slug) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Cuevana DL* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!cvdl <slug> [tipo]\n\n` +
          `✩ *tipos:* movie, series\n\n` +
          `Primero usa *!cv <título>* para buscar`,
      );
      return;
    }

    await ctx.react('📥');
    await ctx.reply(`📥 Obteniendo servidores...`);

    try {
      const detail = await cuevanaService.getDetail(slug, type);

      if (detail._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${detail.left.message}`);
        return;
      }

      const { text, options } = cuevanaService.formatDetail(detail.right);
      await ctx.reply(text);

      if (options.length > 0) {
        await ctx.reply(`\n✦ Para descargar usa:\n${options[0]}`);
      }

      await ctx.react('✅');
    } catch (error) {
      logError('CuevanaDLCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al obtener opciones de descarga');
    }
  }
}

export class CuevanaLinkCommand extends Command {
  name = 'cuevanalink';
  description = 'Descarga video de Cuevana';
  category = CommandCategory.MEDIA;
  aliases = ['cvlink'];
  usage = '!cvlink <url>';
  examples = ['!cvlink https://example.com/video.mp4'];
  cooldown = 120000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  private async ensureTmpDir(): Promise<void> {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  }

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args.join(' ').trim();

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *Cuevana Link* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!cvlink <url>\n\n` +
          `Primero usa *!cvdl <slug>* para ver las opciones`,
      );
      return;
    }

    await ctx.react('⬇️');
    await ctx.reply(`⬇️ Descargando video, espera un momento...`);

    try {
      const dlResult = await cuevanaService.getDownload(url);

      if (dlResult._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${dlResult.left.message}`);
        return;
      }

      const downloadData = dlResult.right;
      if (!downloadData.download_url) {
        await ctx.react('❌');
        await ctx.reply(`❌ No se pudo obtener el video. Intenta con otro servidor`);
        return;
      }

      await this.ensureTmpDir();

      const tempPath = path.join(TMP_DIR, `${Date.now()}.mp4`);
      const response = await axios.get(downloadData.download_url, {
        responseType: 'stream',
        timeout: 300000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
        },
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stat = fs.statSync(tempPath);
      const caption = `🎬 *Cuevana*\n${downloadData.title || 'Video descargado'}`;

      if (stat.size > 60 * 1024 * 1024) {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            document: { url: tempPath },
            mimetype: 'video/mp4',
            fileName: `${downloadData.title || 'video'}.mp4`,
            caption: caption,
          },
          { quoted: ctx.message },
        );
      } else {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            video: { url: tempPath },
            caption: caption,
          },
          { quoted: ctx.message },
        );
      }

      fs.unlinkSync(tempPath);
      await ctx.react('✅');
    } catch (error) {
      logError('CuevanaLinkCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al descargar el video');
    }
  }
}
