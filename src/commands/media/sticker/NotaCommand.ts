import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { ImageProcessor } from '@/utils/imageProcessor.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import { escapeXml, wrapText } from '@/utils/helpers.js';
import path from 'path';
import fs from 'fs';

export class NotaCommand extends Command {
  name = 'nota';
  description = 'Create a note sticker with text';
  category = CommandCategory.MEDIA;
  aliases = ['note'];
  usage = '!nota <text>';
  examples = ['!nota Hello World', '!nota Remember this'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply('⚠️ Escribe algo después de .nota\nEjemplo: *!nota Hola*');
      return;
    }

    const text = ctx.args.slice(0, 20).join(' ');
    await ctx.react('⏳');

    try {
      const imageBuffer = findAssetFile('nota.jpg');

      if (!imageBuffer) {
        await ctx.reply('❌ No se encontró la imagen de fondo para la nota.');
        await ctx.react('❌');
        return;
      }

      const tempPath = path.join(process.cwd(), 'temp', `nota_${Date.now()}.jpg`);

      if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
        fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true });
      }

      fs.writeFileSync(tempPath, imageBuffer);

      const { width, height } = await ImageProcessor.loadImage(tempPath);

      const fontSize = 99;
      const textColor = '#1a1a1a';
      const x = width / 2;
      const centerY = height / 2;
      const maxCharsPerLine = 15;
      const lines = wrapText(text, maxCharsPerLine);
      const lineHeight = fontSize + 15;
      const totalHeight = lines.length * lineHeight;
      const startY = centerY - totalHeight / 2 + fontSize / 2;

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
      lines.forEach((line, index) => {
        const currentY = startY + index * lineHeight;
        svgContent += `
          <text 
            x="${x}" 
            y="${currentY}" 
            font-family="Comic Sans MS, cursive, Arial, sans-serif" 
            font-size="${fontSize}" 
            font-weight="bold" 
            fill="${textColor}" 
            text-anchor="middle"
          >${escapeXml(line)}</text>
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
