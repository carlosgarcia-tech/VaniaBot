/**
 * AiMentionHandler.ts
 *
 * Handles AI chat when the bot is mentioned in a message.
 * Processes mentions and routes them to the AI service for contextual responses.
 * Includes logic for solo-admin mode and permission checking.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
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
 *
 * Returns true when the message was consumed (the caller must stop processing
 * it), false when the bot was not actually addressed or was addressed by
 * someone without permission to use it.
 *
 * Filtering order matters: self-mentions are rejected first, then the mention is
 * matched against both the bot's phone number and its LID (WhatsApp may tag the
 * bot by either identifier), then group admin-only mode is enforced, and only
 * then is the prompt sanitised and forwarded.
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

  // A mention can carry the bot's phone number or its LID; both must be
  // compared after stripping the device suffix (":12") and domain.
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

  // Strip the mention itself so the model receives only the user's actual
  // question, then trim the punctuation left behind by the removal.
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

  // Reject jailbreak attempts before they reach the model.
  const injectionCheck = detectPromptInjection(cleanText);
  if (injectionCheck.blocked) {
    await ctx.react('🚫');
    await ctx.reply(`❌ Message blocked for security reasons.`);
    return true;
  }

  await ctx.react('🤔');

  const response = await aiService.chat(ctx.chat.jid, ctx.sender.jid, cleanText);

  if (!isRight(response)) {
    await ctx.react('❌');
    await ctx.reply(`❌ ${response.left.message}`);
    return true;
  }

  await ctx.react('✅');
  await ctx.reply(response.right ?? '');
  return true;
}
