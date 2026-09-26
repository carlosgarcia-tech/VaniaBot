import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { ImageProcessor } from '@/utils/imageProcessor.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import { escapeXml, wrapText } from '@/utils/helpers.js';
import path from 'path';
import fs from 'fs';

export class PatCommand extends Command {
  name = 'pat';
  description = 'Create a Patrick meme sticker';
  category = CommandCategory.MEDIA;
  aliases = ['patrick'];
  usage = '!pat <text>';
  examples = ['!pat Hello 🤣', '!pat This is funny'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply('⚠️ Escribe algo después de .pat\nEjemplo: *!pat Hola 🤣*');
      return;
    }

    const text = ctx.args.slice(0, 20).join(' ');
    await ctx.react('⏳');

    try {
      const randomNum = Math.floor(Math.random() * 4) + 1;
      const filename = `pat${randomNum}.jpg`;

      const imageBuffer = findAssetFile(filename);

      if (!imageBuffer) {
        await ctx.reply(`❌ No se encontró la imagen ${filename}`);
        await ctx.react('❌');
        return;
      }

      const tempPath = path.join(process.cwd(), 'temp', `pat_${Date.now()}_${randomNum}.jpg`);

      if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
        fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true });
      }

      fs.writeFileSync(tempPath, imageBuffer);

      const { width, height } = await ImageProcessor.loadImage(tempPath);

      const fontSize = 95;
      const textColor = '#FFFFFF';
      const shadowColor = '#000000';
      const shadowOffset = 4;
      const x = width / 2;
      const y = height - 100;
      const maxCharsPerLine = 20;
      const lines = wrapText(text, maxCharsPerLine);
      const lineHeight = fontSize + 10;
      const startY = y - ((lines.length - 1) * lineHeight) / 2;

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
      lines.forEach((line, index) => {
        const currentY = startY + index * lineHeight;
        const escaped = escapeXml(line);
        svgContent += `
          <text x="${x - shadowOffset}" y="${currentY}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x + shadowOffset}" y="${currentY}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x}" y="${currentY - shadowOffset}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x}" y="${currentY + shadowOffset}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${shadowColor}" text-anchor="middle">${escaped}</text>
          <text x="${x}" y="${currentY}" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle">${escaped}</text>
        `;
      });
      svgContent += `</svg>`;

      const buffer = await ImageProcessor.compositeText(tempPath, svgContent, width, height);

      fs.unlinkSync(tempPath);

      const sticker = await StickerHelper.imageToSticker(buffer);
      await ctx.sock.sendMessage(ctx.chat.jid, { sticker });
      await ctx.react('✅');
    } catch (error: unknown) {
      const message = errorMessage(error);
      await ctx.reply(`❌ Error: ${message}`);
      await ctx.react('❌');
    }
  }
}
