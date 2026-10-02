/**
 * AiMentionHandler.ts
 *
 * Handles AI chat when the bot is mentioned in a message.
 * Processes mentions and routes them to the AI service for contextual responses.
 * Includes logic for solo-admin mode and permission checking.
 */

import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import type { MessageContext } from '@/types/index.js';
import { getContextInfo } from '@/utils/getContextInfo.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { PermissionService } from '@/services/PermissionService.js';
import { detectPromptInjection } from '@/utils/promptInjection.js';

/**
 * Handles mention events for AI chat.
 * Checks if the bot was mentioned and routes to AI service if valid.
 *
 * @param ctx - The message context.
 * @param botJid - The bot's JID.
 * @returns A promise that resolves to true if the mention was handled.
 */
export async function handleMention(ctx: MessageContext, botJid: string): Promise<boolean> {
  const rawText: string = ctx.text ?? '';
  const message = ctx.message.message;

  if (ctx.message.key.fromMe) {
    return false;
  }

  const messageParticipant = ctx.message.key.participant;
  if (messageParticipant) {
    const botUserId = ctx.sock.user?.id?.split('@')[0].split(':')[0];
    const participantClean = messageParticipant.split('@')[0].split(':')[0];
    if (participantClean === botUserId) {
      return false;
    }
  }

  const mentionedJids: string[] = getContextInfo(message)?.mentionedJid ?? [];

  const sockUser = ctx.sock.user as { id?: string; lid?: string } | undefined;
  const botLid: string | undefined = sockUser?.lid;
  const botNumber = botJid.split('@')[0].split(':')[0];

  const mentionedByJid = mentionedJids.some((jid: string) => {
    const jidClean = jid.split('@')[0].split(':')[0];
    if (jidClean === botNumber) return true;
    if (botLid) {
      const lidClean = botLid.split('@')[0].split(':')[0];
      if (jidClean === lidClean) return true;
    }
    return false;
  });

  if (!mentionedByJid) return false;

  if (ctx.chat.isGroup) {
    const onlyAdmin = await serviceManager.groupService.getOnlyAdmin(ctx.chat.jid);

    if (onlyAdmin) {
      const isOwner = PermissionService.isOwner(ctx.sender.jid);

      if (!isOwner) {
        await ctx.loadSenderPermissions();
        if (!ctx.sender.isAdmin) {
          return false;
        }
      }
    }
  }

  const cleanText = rawText
    .replace(/@\d+/g, '')
    .replace(/@vania/gi, '')
    .replace(/\bvania\b/gi, '')
    .replace(/[,:\s]+$/, '')
    .trim();

  if (!cleanText) {
    await ctx.reply(`Did you call me? Tell me what you need or use *!ai <message>* to chat.`);
    return true;
  }

  const injectionCheck = detectPromptInjection(cleanText);
  if (injectionCheck.blocked) {
    await ctx.react('🚫');
    await ctx.reply(`Message blocked for security reasons.`);
    return true;
  }

  await ctx.react('🤔');

  const response = await aiService.chat(ctx.chat.jid, ctx.sender.jid, cleanText);

  if (!isRight(response)) {
    await ctx.react('❌');
    await ctx.reply(`Error: ${response.left.message}`);
    return true;
  }

  await ctx.react('✅');
  await ctx.reply(response.right ?? '');
  return true;
}