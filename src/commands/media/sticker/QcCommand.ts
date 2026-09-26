import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { ImageProcessor } from '@/utils/imageProcessor.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import { escapeXml, wrapText } from '@/utils/helpers.js';
import { logError } from '@/utils/logger.js';
import axios from 'axios';

export class QcCommand extends Command {
  name = 'qc';
  description = 'Create a quote sticker with text and profile picture';
  category = CommandCategory.MEDIA;
  aliases = ['quote'];
  usage = '!qc <text>';
  examples = ['!qc Hello World', '!qc @user Your text here'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const targetJid = mentionedJid || ctx.sender.jid;

    let text: string;
    if (ctx.args.length >= 1) {
      text = ctx.args.join(' ');
    } else if (ctx.quoted?.conversation || ctx.quoted?.extendedTextMessage?.text) {
      text = ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || '';
    } else {
      await ctx.reply('Missing text!\n\nUsage: !qc <text>');
      return;
    }

    if (!text) {
      await ctx.reply('Missing text!');
      return;
    }

    const cleanNumber = targetJid.split('@')[0].split(':')[0];
    const mentionRegex = new RegExp(
      `@${cleanNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`,
      'g',
    );
    const cleanText = text.replace(mentionRegex, '').trim();

    if (cleanText.length > 40) {
      await ctx.reply('Text cannot exceed 40 characters');
      return;
    }

    await ctx.react('⏳');

    try {
      let pp = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
      try {
        const pic = await ctx.sock.profilePictureUrl(targetJid, 'image');
        if (pic) pp = pic;
      } catch (error) {
        logError('[QcCommand]', error);
      }

      const nombre = mentionedJid
        ? await contactsCache.getContactName(ctx, mentionedJid)
        : ctx.sender.pushName || (await contactsCache.getContactName(ctx, ctx.sender.jid));

      let imageBuffer: Buffer | null = null;

      try {
        const obj = {
          type: 'quote',
          format: 'png',
          backgroundColor: '#000000',
          width: 512,
          height: 512,
          scale: 2,
          messages: [
            {
              entities: [],
              avatar: true,
              from: { id: 1, name: nombre, photo: { url: pp } },
              text: cleanText,
              replyMessage: {},
            },
          ],
        };
        const res = await axios.post('https://bot.lyo.su/quote/generate', obj, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000,
        });
        imageBuffer = Buffer.from(res.data.result.image, 'base64');
      } catch (error) {
        logError('[QcCommand]', error);
      }

      if (!imageBuffer) {
        imageBuffer = await this.buildLocalQuoteImage(nombre, cleanText, pp);
      }

      const resizedBuffer = await ImageProcessor.resizeContain(imageBuffer, 512, 512);

      const sticker = await StickerHelper.imageToSticker(resizedBuffer);
      await ctx.sock.sendMessage(ctx.chat.jid, { sticker });
      await ctx.react('✅');
    } catch (error: unknown) {
      const message = errorMessage(error);
      await ctx.reply(`❌ Error: ${message}`);
      await ctx.react('❌');
    }
  }

  private async buildLocalQuoteImage(name: string, text: string, ppUrl: string): Promise<Buffer> {
    const W = 512;
    const H = 512;

    let ppDataUri = '';
    try {
      const resp = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 5000 });
      const b64 = Buffer.from(resp.data as ArrayBuffer).toString('base64');
      const mime = (resp.headers['content-type'] as string) || 'image/jpeg';
      ppDataUri = `data:${mime};base64,${b64}`;
    } catch (error) {
      logError('[QcCommand]', error);
    }

    const eName = escapeXml(name);
    const eText = escapeXml(text);

    const AV_CX = W / 2;
    const AV_CY = 115;
    const AV_R = 58;

    const avatarBlock = ppDataUri
      ? `<defs>
          <clipPath id="av">
            <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R}"/>
          </clipPath>
        </defs>
        <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R + 4}" fill="#7C3AED" opacity="0.5"/>
        <image href="${ppDataUri}"
          x="${AV_CX - AV_R}" y="${AV_CY - AV_R}"
          width="${AV_R * 2}" height="${AV_R * 2}"
          clip-path="url(#av)"/>`
      : `<circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R}" fill="#7C3AED"/>
         <text x="${AV_CX}" y="${AV_CY + 20}"
           font-family="Arial" font-size="52" font-weight="bold"
           fill="white" text-anchor="middle">${eName.charAt(0).toUpperCase()}</text>`;

    const NAME_Y = AV_CY + AV_R + 36;
    const SEP_Y = NAME_Y + 20;
    const TEXT_BASE = SEP_Y + 42;
    const LINE_H = 48;

    const lines = wrapText(eText, 19);
    const textRows = lines
      .map(
        (line, i) =>
          `<text x="${W / 2}" y="${TEXT_BASE + i * LINE_H}"
            font-family="Arial, sans-serif" font-size="38"
            fill="white" text-anchor="middle">${line}</text>`,
      )
      .join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#1a1a2e"/>
          <stop offset="100%" stop-color="#0f0f1a"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)" rx="30"/>
      <text x="20" y="78" font-family="Georgia,serif" font-size="96"
        fill="#7C3AED" opacity="0.3">"</text>
      <text x="${W - 38}" y="${H - 14}" font-family="Georgia,serif" font-size="96"
        fill="#7C3AED" opacity="0.3">"</text>
      ${avatarBlock}
      <text x="${W / 2}" y="${NAME_Y}"
        font-family="Arial,sans-serif" font-size="26" font-weight="bold"
        fill="#C084FC" text-anchor="middle">${eName}</text>
      <line x1="80" y1="${SEP_Y}" x2="${W - 80}" y2="${SEP_Y}"
        stroke="#7C3AED" stroke-width="1.5" opacity="0.6"/>
      ${textRows}
      <text x="${W / 2}" y="${H - 16}"
        font-family="Arial,sans-serif" font-size="15"
        fill="#3a3a6a" text-anchor="middle">VaniaBot</text>
    </svg>`;

    return await ImageProcessor.svgToBuffer(svg, W, H);
  }
}
