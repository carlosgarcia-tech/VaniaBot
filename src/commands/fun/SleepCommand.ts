/**
 * SleepCommand.ts
 *
 * fun command `sleep` — Dormir
 * Usage: !sleep [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

const SLEEP_VIDEOS = [
  'https://telegra.ph/file/0684477ff198a678d4821.mp4',
  'https://telegra.ph/file/583b7a7322fd6722751b5.mp4',
  'https://telegra.ph/file/e6ff46f4796c57f2235bd.mp4',
  'https://telegra.ph/file/06b4469cd5974cf4e28ff.mp4',
  'https://telegra.ph/file/9213f74b91f8a96c43922.mp4',
  'https://telegra.ph/file/b93da0c01981f17c05858.mp4',
  'https://telegra.ph/file/8e0b0fe1d653d6956608a.mp4',
  'https://telegra.ph/file/3b091f28e5f52bc774449.mp4',
  'https://telegra.ph/file/7c795529b38d1a93395f6.mp4',
  'https://telegra.ph/file/6b8e6cc26de052d4018ba.mp4',
];

/** Command handler for `!sleep`: Dormir. */
export class SleepCommand extends Command {
  name = 'sleep';
  description = 'Dormir';
  category = CommandCategory.FUN;
  aliases = ['dormir'];
  usage = '!sleep [@usuario]';
  examples = ['!sleep', '!sleep @usuario'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const quotedSender = ctx.contextInfo?.quotedMessage ? ctx.quotedParticipant : null;

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

    await ctx.react('😴');

    let message: string;
    if (targetJid === ctx.sender.jid) {
      message = `${senderName} está tomando una siesta`;
    } else {
      message = `${senderName} está durmiendo con @${targetJid.split('@')[0]}`;
    }

    const video = SLEEP_VIDEOS[Math.floor(Math.random() * SLEEP_VIDEOS.length)];

    await ctx.sock.sendMessage(ctx.chat.jid, {
      video: { url: video },
      gifPlayback: true,
      caption: message,
      mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
    });
  }
}
