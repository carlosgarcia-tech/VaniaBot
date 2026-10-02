/**
 * InsultCommand.ts
 *
 * fun command `insult` — Insulta a un usuario de forma graciosa
 * Usage: !insult [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const SPANISH_INULTS = [
  'Eres tan inútil como un calcetín en un pie de madera.',
  'Llamarte inteligente sería Insultar a los idiotas.',
  'Eres como el cielo, cuando te vas es un día hermoso.',
  'Traes tanta alegría como un funcionario público en lunes.',
  'Si la ignorancia se pagara, serías rico.',
  'Eres más inútil que un teclado sin teclas.',
  'Tu inteligencia es como un espejo roto: no refleja nada.',
  'Meizas más ruido que un matangazo en una fábrica vacía.',
  'Eres tan útil como un paraguas en un tornado.',
  'Tu nivel de radiación intelectual es impresionante.',
  'Mas vale callarte que decir más tonterías.',
  'Eres el error de la naturaleza.',
  'Pareces un Windows update: lento y molesto.',
  'Tu cerebro debe estar en mantenimiento.',
  'Eres más falso que un billete de tres pesos.',
  'No seas mediocre, sé mediocre bien.',
  'Tu existecia es un placebo del universo.',
  'Eres más aburrido que ver pintura secarse.',
  'Si fueras un error, serías de sintaxis.',
  'Pareces ese pixel muerto en la pantalla.',
];

const ENGLISH_INULTS = [
  "You're about as useful as a screen door on a submarine.",
  "I'd call you a smartass, but that would be an insult to smart people.",
  "You're like a cloud. When you disappear, it's a beautiful day.",
  'You bring everyone so much joy... when you leave the room.',
  "If laziness was an Olympic sport, you'd come in fourth.",
  "You're the human equivalent of a spam email.",
  "Your secret is safe with me. I won't even tell myself.",
  "I'd explain it to you but I left my crayons at home.",
  "You're proof that evolution can go in reverse.",
  "I'm not saying I hate you, but I wouldn't peel an orange for you.",
  'You have the perfect face for radio.',
  'You are like a software update: always late and unnecessary.',
  "My psychiatrist says I have a fear of intelligent people. I told him you're not a threat.",
  "You're the reason the gene pool needs a lifeguard.",
  'Light travels faster than sound, which is why you seemed bright until you spoke.',
];

/** Command handler for `!insult`: Insulta a un usuario de forma graciosa. */
export class InsultCommand extends Command {
  name = 'insult';
  description = 'Insulta a un usuario de forma graciosa';
  category = CommandCategory.FUN;
  aliases = ['insultme', 'burn', 'insultar', 'burla'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!insult [@usuario]';
  examples = ['!insult', '!insult @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const quotedSender = ctx.contextInfo?.quotedMessage ? ctx.quotedParticipant : null;

    const targetJid = mentionedJid || quotedSender || ctx.sender.jid;
    const targetName = targetJid.split('@')[0];
    const targetTag = `@${targetName}`;
    const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

    const allInsults = [...SPANISH_INULTS, ...ENGLISH_INULTS];
    const insult = allInsults[Math.floor(Math.random() * allInsults.length)];

    const isSelf = targetJid === ctx.sender.jid;
    let message: string;

    if (isSelf) {
      message = `*${senderName}* se insultó a sí mismo:\n\n"${insult}"`;
    } else {
      message = `*${senderName}* le dice a *${targetTag}:\n\n"${insult}"`;
    }

    await ctx.react('🔥');
    await ctx.reply(message);
  }
}
