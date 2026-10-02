import type { WASocket, BaileysEventMap } from 'baileys';
import type { MessageContext } from './MessageContext.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { antiDeleteService } from '@/services/system/AntiDeleteService.js';
import { antiCallService } from '@/services/system/AntiCallService.js';
import { welcomeService } from '@/services/system/WelcomeService.js';
import { cacheManager } from '@/core/CacheManager.js';
import { PermissionService } from '@/services/PermissionService.js';
import { getBotJid } from '@/services/permission/JidService.js';
import { antiArabService } from '@/services/moderation/AntiArabService.js';
import { logger, logError } from '@/utils/logger.js';
import { env } from '@/config/env.js';
import { formatTimeRemaining } from '@/utils/helpers.js';

type GroupParticipantsUpdate = BaileysEventMap['group-participants.update'];

/**
 * Handles various WhatsApp client events such as incoming calls,
 * message deletions, and group participant updates.
 */
export class ClientEventHandlers {
  /**
   * Handles incoming WhatsApp calls.
   * Rejects calls if anti-call service is enabled and the caller should be blocked.
   *
   * @param sock - The WhatsApp socket.
   * @param calls - Array of incoming call events.
   * @returns A promise that resolves when all calls are handled.
   */
  async handleIncomingCalls(sock: WASocket, calls: BaileysEventMap['call']): Promise<void> {
    if (!antiCallService.isEnabled()) return;
    for (const call of calls) {
      const callId = call.id;
      const caller = call.from;
      const isVideo = call.isVideo;
      const isGroup = call.isGroup;
      if (antiCallService.shouldBlock(caller)) continue;
      try {
        logger.info(
          `Rejecting call ${callId} from ${caller} (video: ${isVideo}, group: ${isGroup})`,
        );
        await sock.rejectCall(callId, caller);
        const callerName = caller.split('@')[0];
        const ownerMsg =
          `Call Rejected\n\n` +
          `From: @${callerName}\n` +
          `Type: ${isVideo ? 'Video' : 'Voice'}\n` +
          `Group: ${isGroup ? 'Yes' : 'No'}\n` +
          `Time: ${new Date().toLocaleString()}`;
        try {
          await sock.sendMessage(env.OWNER_JID, {
            text: ownerMsg,
            mentions: [caller],
          });
        } catch {
          logger.debug('Could not send anti-call notification to owner');
        }
      } catch (err) {
        logger.debug('Error rejecting call:', err);
      }
    }
  }

  /**
   * Handles message deletion events.
   * Notifies the owner when a message is deleted by someone else,
   * and sends the deleted message content if available.
   *
   * @param sock - The WhatsApp socket.
   * @param update - The message deletion event.
   * @returns A promise that resolves when handling is complete.
   */
  async handleMessageDeletion(
    sock: WASocket,
    update: BaileysEventMap['messages.delete'],
  ): Promise<void> {
    try {
      const botJid = sock.user?.id || '';
      const botNumber = botJid.split(':')[0];
      const keys = 'keys' in update ? update.keys : [];
      for (const key of keys) {
        const messageId = key.id;
        if (!messageId) continue;
        const deletedBy = key.participant || key.remoteJid || '';
        if (deletedBy.includes(botNumber)) continue;
        const original = antiDeleteService.getMessage(messageId);
        if (!original) continue;
        const notification = antiDeleteService.formatDeletedMessageNotification(
          deletedBy,
          original,
          sock,
        );
        try {
          await sock.sendMessage(env.OWNER_JID, {
            text: notification,
            mentions: [deletedBy, original.sender],
          });
          if (original.mediaBuffer && original.mediaType) {
            const mediaOptions: Record<string, unknown> = {
              caption: `Deleted media: ${original.mediaType}\nFrom: @${original.sender.split('@')[0]}`,
              mentions: [original.sender],
            };
            if (original.mediaType === 'image') {
              await sock.sendMessage(env.OWNER_JID, {
                image: original.mediaBuffer,
                ...mediaOptions,
              });
            } else if (original.mediaType === 'video') {
              await sock.sendMessage(env.OWNER_JID, {
                video: original.mediaBuffer,
                ...mediaOptions,
              });
            } else if (original.mediaType === 'sticker') {
              await sock.sendMessage(env.OWNER_JID, {
                sticker: original.mediaBuffer,
                ...mediaOptions,
              });
            } else if (original.mediaType === 'audio') {
              await sock.sendMessage(env.OWNER_JID, {
                audio: original.mediaBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                ...mediaOptions,
              });
            }
          }
        } catch (err) {
          logger.debug('Error sending anti-delete notification:', err);
        }
        antiDeleteService.deleteMessage(messageId);
      }
    } catch (err) {
      logError('handleMessageDeletion', err);
    }
  }

  /**
   * Handles group participant updates (add/remove).
   * Invalidates cache, handles welcome messages, and runs anti-arab checks.
   *
   * @param sock - The WhatsApp socket.
   * @param update - The group participants update event.
   * @returns A promise that resolves when handling is complete.
   */
  async handleGroupUpdate(sock: WASocket, update: GroupParticipantsUpdate): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;
    try {
      cacheManager.invalidateGroupMetadata(groupJid);
      await serviceManager.groupService.getGroup(groupJid);
      const botJid = getBotJid(sock);
      const botPhone = botJid.split('@')[0];

      const isBotAffected = participants.some(p => {
        const participantId = p.id || p;
        const participantIdStr =
          typeof participantId === 'string' ? participantId : participantId.id || '';
        const pPhone = participantIdStr.split('@')[0];
        return pPhone === botPhone || participantIdStr === botJid;
      });

      if (isBotAffected) {
        cacheManager.invalidatePermissions(groupJid);
      }

      if (action === 'add') {
        for (const participant of participants) {
          const participantId =
            typeof participant === 'string' ? participant : participant.id || '';
          if (participantId) {
            welcomeService
              .handleNewParticipant(sock, groupJid, participantId)
              .catch(err => logError('handleNewParticipant', err));
          }
        }
      }

      if (action === 'remove') {
        for (const participant of participants) {
          const participantId =
            typeof participant === 'string' ? participant : participant.id || '';
          if (participantId) {
            welcomeService
              .handleParticipantLeft(sock, groupJid, participantId, 'main')
              .catch(err => logError('handleParticipantLeft', err));
          }
        }
      }

      await this.handleAntiArab(sock, groupJid, action, participants);
    } catch (error) {
      logError('handleGroupUpdate', error);
    }
  }

  /**
   * Handles anti-arab moderation for newly added participants.
   * Kicks users with blocked country prefixes from the group.
   *
   * @param sock - The WhatsApp socket.
   * @param groupJid - The group JID.
   * @param action - The participant action ('add' or 'remove').
   * @param participants - The array of participants.
   * @returns A promise that resolves when handling is complete.
   */
  private async handleAntiArab(
    sock: WASocket,
    groupJid: string,
    action: string,
    participants: BaileysEventMap['group-participants.update']['participants'],
  ): Promise<void> {
    if (action !== 'add') return;
    if (!antiArabService.isEnabled(groupJid)) return;

    const botNumber = (sock.user?.id || '').split('@')[0].replace(/[^\d]/g, '');

    for (const participant of participants) {
      const participantId = typeof participant === 'string' ? participant : participant.id || '';
      if (!participantId) continue;

      const number = participantId.replace(/@.*$/, '').replace(/[^\d]/g, '');
      if (!number || number === botNumber) continue;

      if (antiArabService.shouldBlockNumber(number)) {
        try {
          await sock.groupParticipantsUpdate(groupJid, [participantId], 'remove');
          logger.info(`AntiArab: User ${number} removed from group ${groupJid}`);
        } catch (error) {
          logger.error(`AntiArab: Error removing user ${number}`, error);
        }
      }
    }
  }

  /**
   * Notifies group admins when a muted user attempts to send a message.
   *
   * @param ctx - The message context.
   * @returns A promise that resolves when notifications are sent.
   */
  async notifyAdminsMute(ctx: MessageContext): Promise<void> {
    try {
      const admins = await PermissionService.getGroupAdmins(ctx.sock, ctx.chat.jid);
      const botJid = ctx.sock.user?.id;
      const adminJids = admins.filter(admin => admin !== botJid);
      if (adminJids.length === 0) return;
      const muteInfo = await serviceManager.moderationService.getMuteInfo(
        ctx.chat.jid,
        ctx.sender.jid,
      );
      const timeRemaining = await serviceManager.moderationService.getMuteTimeRemaining(
        ctx.chat.jid,
        ctx.sender.jid,
      );
      const timeText = formatTimeRemaining(timeRemaining);
      await Promise.allSettled(
        adminJids.map(adminJid =>
          ctx.sock
            .sendMessage(adminJid, {
              text:
                `Mute Alert\n\n` +
                `User *${ctx.sender.pushName || 'Unknown'}* is muted but attempted to send a message.\n\n` +
                `Reason: ${muteInfo?.reason || 'Not specified'}\n` +
                `Time remaining: ${timeText}\n` +
                `Message: ${ctx.text.slice(0, 100)}${ctx.text.length > 100 ? '...' : ''}\n\n` +
                `Note: Bot needs to be admin to auto-delete muted messages.`,
            })
            .catch(error => {
              logger.debug(`[MUTE] Error notifying admin ${adminJid}:`, error);
            }),
        ),
      );
    } catch (error) {
      logError('[MUTE] Error notifyAdmins', error);
    }
  }
}

export const clientEventHandlers = new ClientEventHandlers();