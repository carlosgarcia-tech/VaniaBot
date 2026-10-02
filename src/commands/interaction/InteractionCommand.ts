/**
 * InteractionCommand.ts
 *
 * VaniaBot commands module exposing `agarrarnalgasCommand`, `chuparpataCommand`, `follarCommand`, `grabboobsCommand`.
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

interface InteractionDef {
  name: string;
  description: string;
  aliases: string[];
  usage: string;
  examples: string[];
  react: string;
  videos: string[];
  selfMessage: string;
  targetMessage: string;
  nsfw?: boolean;
}

const COMMANDS: InteractionDef[] = [
  {
    name: 'agarrarnalgas',
    description: 'Interacción +18',
    aliases: ['agarrarnalgas'],
    usage: '!agarrarnalgas [@usuario]',
    examples: ['!agarrarnalgas @usuario'],
    react: '🍑',
    videos: [
      'https://files.catbox.moe/yjulgu.mp4',
      'https://files.catbox.moe/erm82k.mp4',
      'https://files.catbox.moe/9m1nkp.mp4',
      'https://files.catbox.moe/rzijb5.mp4',
    ],
    selfMessage: 'está agarrando nalgas por ahí',
    targetMessage: 'está agarrando las nalgas de',
    nsfw: true,
  },
  {
    name: 'chuparpata',
    description: 'Interacción +18',
    aliases: ['chuparpata', 'chupaepatas'],
    usage: '!chuparpata [@usuario]',
    examples: ['!chuparpata @usuario'],
    react: '👣',
    videos: [
      'https://files.catbox.moe/zuwr3w.mp4',
      'https://files.catbox.moe/vkllyl.mp4',
      'https://files.catbox.moe/es3aji.mp4',
    ],
    selfMessage: 'está chupando patas por ahí',
    targetMessage: 'está chupando la pata de',
    nsfw: true,
  },
  {
    name: 'follar',
    description: 'Interacción +18',
    aliases: ['follar'],
    usage: '!follar [@usuario]',
    examples: ['!follar @usuario'],
    react: '🥵',
    videos: [
      'https://files.catbox.moe/7ito13.mp4',
      'https://files.catbox.moe/6to3zj.mp4',
      'https://files.catbox.moe/8j94sh.mp4',
      'https://files.catbox.moe/ylfpb7.mp4',
      'https://files.catbox.moe/kccjc7.mp4',
      'https://files.catbox.moe/lt9e1u.mp4',
    ],
    selfMessage: 'está follando ricamente',
    targetMessage: 'folló durísimo a',
    nsfw: true,
  },
  {
    name: 'grabboobs',
    description: 'Interacción +18',
    aliases: ['agarrartetas', 'grabboobs'],
    usage: '!grabboobs [@usuario]',
    examples: ['!grabboobs @usuario'],
    react: '🔥',
    videos: [
      'https://telegra.ph/file/e6bf14b93dfe22c4972d0.mp4',
      'https://telegra.ph/file/075db3ebba7126d2f0d95.mp4',
      'https://telegra.ph/file/37c21753892b5d843b9ce.mp4',
      'https://telegra.ph/file/04bbf490e29158f03e348.mp4',
      'https://telegra.ph/file/82d32821f3b57b62359f2.mp4',
      'https://telegra.ph/file/36149496affe5d02c8965.mp4',
      'https://telegra.ph/file/61d85d10baf2e3b9a4cde.mp4',
      'https://telegra.ph/file/538c95e4f1c481bcc3cce.mp4',
      'https://telegra.ph/file/e999ef6e67a1a75a515d6.mp4',
    ],
    selfMessage: 'está agarrando unas tetas',
    targetMessage: 'le está agarrando las tetas a',
    nsfw: true,
  },
  {
    name: 'hug',
    description: 'Abrazar a alguien',
    aliases: ['abrazar'],
    usage: '!hug [@usuario]',
    examples: ['!hug', '!hug @usuario'],
    react: '🫂',
    videos: [
      'https://telegra.ph/file/6a3aa01fabb95e3558eec.mp4',
      'https://telegra.ph/file/0e5b24907be34da0cbe84.mp4',
      'https://telegra.ph/file/6bc3cd10684f036e541ed.mp4',
      'https://telegra.ph/file/3e443a3363a90906220d8.mp4',
      'https://telegra.ph/file/56d886660696365f9696b.mp4',
      'https://telegra.ph/file/3eeadd9d69653803b33c6.mp4',
      'https://telegra.ph/file/436624e53c5f041bfd597.mp4',
      'https://telegra.ph/file/5866f0929bf0c8fe6a909.mp4',
    ],
    selfMessage: 'se abrazó a sí mismo',
    targetMessage: 'le dio un fuerte abrazo a',
  },
  {
    name: 'cry',
    description: 'Llorar',
    aliases: ['llorar'],
    usage: '!cry [@usuario]',
    examples: ['!cry', '!cry @usuario'],
    react: '😭',
    videos: [
      'https://qu.ax/gRjHK.mp4',
      'https://qu.ax/VjjCJ.mp4',
      'https://qu.ax/ltieQ.mp4',
      'https://qu.ax/oryVi.mp4',
      'https://qu.ax/YprzU.mp4',
      'https://qu.ax/nxaUW.mp4',
      'https://qu.ax/woSGV.mp4',
      'https://qu.ax/WkmA.mp4',
    ],
    selfMessage: 'está llorando',
    targetMessage: 'está llorando por',
  },
  {
    name: 'reirse',
    description: 'Reírse',
    aliases: ['laugh'],
    usage: '!reirse [@usuario]',
    examples: ['!reirse', '!reirse @usuario'],
    react: '😹',
    videos: [
      'https://telegra.ph/file/5fa4fd7f4306aa7b2e17a.mp4',
      'https://telegra.ph/file/b299115a77fadb7594ca0.mp4',
      'https://telegra.ph/file/9938a8c2e54317d6b8250.mp4',
      'https://telegra.ph/file/e6c7b3f7d482ae42db9a7.mp4',
      'https://telegra.ph/file/a61b52737df7459580129.mp4',
      'https://telegra.ph/file/f34e1d5c8f17bd2739a51.mp4',
      'https://telegra.ph/file/c345ed1ca18a53655f857.mp4',
      'https://telegra.ph/file/4eec929f54bc4d83293a3.mp4',
      'https://telegra.ph/file/856e38b2303046990531c.mp4',
    ],
    selfMessage: 'se está riendo',
    targetMessage: 'se está riendo de',
  },
];

const COMMANDS_MAP = new Map(COMMANDS.map(c => [c.name, c]));
function getInteractionCommand(name: string): InteractionDef {
  const cmd = COMMANDS_MAP.get(name);
  if (!cmd) throw new Error(`Interaction command '${name}' not found`);
  return cmd;
}

function createInteractionCommand(def: InteractionDef): Command {
  class DynamicInteractionCommand extends Command {
    name = def.name;
    description = def.description;
    category = CommandCategory.FUN;
    aliases = def.aliases;
    usage = def.usage;
    examples = def.examples;
    cooldown = 10_000;
    contexts = [CommandContext.GROUP];

    async execute(ctx: MessageContext): Promise<void> {
      if (def.nsfw) {
        try {
          const group = await serviceManager.groupService.getGroup(ctx.chat.jid);
          if (!group.nsfw) {
            await ctx.reply(
              `˚₊· ͟͟͞͞➳ *nsfw desactivado* ˚₊· ͟͟͞͞➳\n\n` +
                `❌ Los comandos +18 están desactivados en este grupo.`,
            );
            return;
          }
        } catch {
          await ctx.reply(`❌ No pude verificar el estado de NSFW.`);
          return;
        }
      }

      const mentionedJid = ctx.mentionedJid;
      const quotedSender = ctx.contextInfo?.quotedMessage ? ctx.quotedParticipant : null;

      const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
      const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

      await ctx.react(def.react);

      const message =
        targetJid === ctx.sender.jid
          ? `${senderName} ${def.selfMessage}`
          : `${senderName} ${def.targetMessage} @${targetJid.split('@')[0]}`;

      const video = def.videos[Math.floor(Math.random() * def.videos.length)];

      await ctx.sock.sendMessage(ctx.chat.jid, {
        video: { url: video },
        gifPlayback: true,
        caption: message,
        mentions: targetJid !== ctx.sender.jid ? [targetJid] : undefined,
      });
    }
  }

  return new DynamicInteractionCommand();
}

export const agarrarnalgasCommand = createInteractionCommand(
  getInteractionCommand('agarrarnalgas'),
);
export const chuparpataCommand = createInteractionCommand(getInteractionCommand('chuparpata'));
export const follarCommand = createInteractionCommand(getInteractionCommand('follar'));
export const grabboobsCommand = createInteractionCommand(getInteractionCommand('grabboobs'));
export const hugCommand = createInteractionCommand(getInteractionCommand('hug'));
export const cryCommand = createInteractionCommand(getInteractionCommand('cry'));
export const reirseCommand = createInteractionCommand(getInteractionCommand('reirse'));
