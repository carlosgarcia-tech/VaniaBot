/**
 * @fileoverview NotifyCommand.ts - Group notification command
 *
 * Sends notifications to all group members by mentioning them.
 * Supports text messages, images, videos, stickers, audio, and documents.
 * Can quote/reply to messages and add extra text.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-03
 * @module commands/utility/system/NotifyCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { proto, WAMessage } from 'baileys';
import { downloadMediaMessage } from 'baileys';
import { cacheManager } from '@/core/CacheManager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { getContextInfo } from '@/utils/getContextInfo.js';
import { logError, logger } from '@/utils/logger.js';

/** Timeout for downloading media (10 seconds) */
const DOWNLOAD_TIMEOUT = 10000;

export class NotifyCommand extends Command {
  name = 'notify';
  description = 'Notifica a todos mencionando un mensaje referenciado o texto.';
  category = CommandCategory.UTILITY;
  aliases = ['n'];
  usage = '!n [texto] | responde a un mensaje con !n [texto adicional]';
  examples = [
    '!n Reunión importante a las 3 PM',
    '!n (respondiendo un texto)',
    '!n Miren esto jajaja (respondiendo sticker/imagen/video)',
  ];
  contexts = [CommandContext.GROUP];
  cooldown = 5000;

  private getQuotedType(quoted: proto.IMessage): string {
    if (!quoted) return 'none';
    if (quoted.conversation || quoted.extendedTextMessage) return 'text';
    if (quoted.imageMessage) return 'image';
    if (quoted.videoMessage) return 'video';
    if (quoted.stickerMessage) return 'sticker';
    if (quoted.audioMessage) return 'audio';
    if (quoted.documentMessage) return 'document';
    return 'unknown';
  }

  private getQuotedMessageInfo(ctx: MessageContext): WAMessage | null {
    try {
      const contextInfo = getContextInfo(ctx.message.message);

      if (!contextInfo?.quotedMessage || !contextInfo.stanzaId) return null;

      return {
        key: {
          remoteJid: ctx.chat.jid,
          fromMe: contextInfo.participant === ctx.sock.user?.id,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant,
        },
        message: contextInfo.quotedMessage,
      } as WAMessage;
    } catch {
      return null;
    }
  }

  private async downloadWithTimeout(msg: WAMessage): Promise<Buffer | null> {
    try {
      const buffer = await Promise.race([
        downloadMediaMessage(msg, 'buffer', {}) as Promise<Buffer>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Download timeout')), DOWNLOAD_TIMEOUT),
        ),
      ]);
      return buffer as Buffer;
    } catch (error) {
      logger.debug('[NotifyCommand] Media download failed/timed out:', error);
      return null;
    }
  }

  private async getParticipants(ctx: MessageContext): Promise<string[]> {
    const cachedParticipants = cacheManager.getGroupParticipants(ctx.chat.jid);
    if (cachedParticipants) return cachedParticipants;

    const cachedMetadata = cacheManager.getGroupMetadata(ctx.chat.jid);
    const groupMetadata = cachedMetadata ?? (await ctx.sock.groupMetadata(ctx.chat.jid));

    const participants = groupMetadata.participants.map(p => p.id);

    if (!cachedMetadata) {
      cacheManager.setGroupMetadata(ctx.chat.jid, groupMetadata);
    }
    cacheManager.setGroupParticipants(ctx.chat.jid, participants);

    return participants;
  }

  private buildCaption(extraText: string, originalCaption: string, footer: string): string {
    if (extraText && originalCaption) {
      return `${extraText}\n\n${originalCaption}${footer}`;
    } else if (extraText) {
      return `${extraText}${footer}`;
    } else if (originalCaption) {
      return `${originalCaption}${footer}`;
    }
    return footer.trim();
  }

  private getRawExtraText(ctx: MessageContext): string {
    const msgObj = ctx.message.message;
    const conversation = msgObj?.conversation;
    const extendedText = msgObj?.extendedTextMessage?.text;
    const rawText = conversation || extendedText || '';
    const commandMatch = rawText.match(/^[^\s]+\s*/);
    const result = commandMatch ? rawText.slice(commandMatch[0].length).trim() : rawText.trim();
    return result;
  }

  async execute(ctx: MessageContext): Promise<void> {
    const extraText = this.getRawExtraText(ctx);

    const footer =
      '\n\n' + (await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup));

    try {
      const participants = await this.getParticipants(ctx);

      if (!ctx.quoted) {
        if (!extraText) {
          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *oops, escríbeme algo* ˚₊· ͟͟͞͞➳\n\n` +
              `✿ *!n* <texto>\n` +
              `✩ o responde a un mensaje con *!n* ✩`,
          );
          return;
        }

        const finalMsg = `${extraText}${footer}`;

        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { text: finalMsg, mentions: participants },
          { quoted: ctx.message },
        );
        return;
      }

      const type = this.getQuotedType(ctx.quoted);

      if (type === 'text') {
        const quotedText = ctx.quoted.conversation || ctx.quoted.extendedTextMessage?.text || '';

        if (!quotedText && !extraText) {
          await ctx.react('❌');
          await ctx.reply('❌ No se pudo obtener el texto referenciado.');
          return;
        }

        const parts: string[] = [];
        if (extraText) parts.push(extraText);
        if (quotedText) parts.push(quotedText);

        const finalText = parts.join('\n\n') + footer;
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { text: finalText, mentions: participants },
          { quoted: ctx.message },
        );
        return;
      }

      const quotedMsgInfo = this.getQuotedMessageInfo(ctx);

      if (!quotedMsgInfo) {
        await ctx.react('❌');
        await ctx.reply('❌ No se pudo obtener el mensaje referenciado.');
        return;
      }

      if (type === 'sticker') {
        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (!buffer) {
          await ctx.react('❌');
          await ctx.reply('❌ Timeout al descargar el sticker.');
          return;
        }

        await ctx.sock.sendMessage(ctx.chat.jid, {
          sticker: buffer,
          mentions: participants,
          mimetype: ctx.quoted.stickerMessage?.mimetype || 'image/webp',
        });
        return;
      }

      if (type === 'image') {
        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (!buffer) {
          await ctx.react('❌');
          await ctx.reply('❌ Timeout al descargar la imagen.');
          return;
        }

        const originalCaption = ctx.quoted.imageMessage?.caption || '';
        const caption = this.buildCaption(extraText, originalCaption, footer);

        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: buffer,
          caption,
          mentions: participants,
          mimetype: ctx.quoted.imageMessage?.mimetype || 'image/jpeg',
        });
        return;
      }

      if (type === 'video') {
        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (!buffer) {
          await ctx.react('❌');
          await ctx.reply('❌ Timeout al descargar el video.');
          return;
        }

        const originalCaption = ctx.quoted.videoMessage?.caption || '';
        const caption = this.buildCaption(extraText, originalCaption, footer);

        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: buffer,
          caption,
          mentions: participants,
          mimetype: ctx.quoted.videoMessage?.mimetype || 'video/mp4',
          gifPlayback: ctx.quoted.videoMessage?.gifPlayback || false,
        });
        return;
      }

      if (type === 'audio') {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
          });
        }

        const buffer = await this.downloadWithTimeout(quotedMsgInfo);
        if (buffer) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            audio: buffer,
            mentions: participants,
            mimetype: ctx.quoted.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
            ptt: ctx.quoted.audioMessage?.ptt || false,
          });
        }
        return;
      }

      if (type === 'document') {
        if (extraText) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            text: `${extraText}${footer}`,
            mentions: participants,
          });
        }

        if (quotedMsgInfo?.message) {
          await ctx.sock.relayMessage(ctx.chat.jid, quotedMsgInfo.message, {
            messageId: ctx.sock.generateMessageTag(),
          });
        }
        return;
      }
    } catch (_error) {
      await ctx.react('❌').catch((error: unknown) => logError('[NotifyCommand]', error));
      await ctx
        .reply('❌ Error al enviar la notificación.')
        .catch((error: unknown) => logError('[NotifyCommand]', error));
    }
  }
}
