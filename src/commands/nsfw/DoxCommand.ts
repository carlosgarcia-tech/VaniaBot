/**
 * DoxCommand.ts
 *
 * fun command `doxear` — Doxxeo falso (simulación)
 * Usage: !doxear @usuario
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const pickRandom = (list: string[]): string => list[Math.floor(Math.random() * list.length)];

const generateFakeIP = (): string => {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
};

const generateFakeMAC = (): string => {
  const hex = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 6; i++) {
    if (i > 0) mac += ':';
    mac += hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
  }
  return mac;
};

const ISP_NAMES = ['Ucom Universal', 'Telecom', 'Claro', 'Movistar', 'AT&T', 'Verizon', 'T-Mobile'];
const ROUTER_VENDORS = ['ERICSSON', 'TP-LINK', 'NETGEAR', 'CISCO', 'ASUS', 'D-LINK'];
const DEVICE_VENDORS = ['WIN32-X', 'Linux', 'MacOS', 'Android', 'iOS'];

/** Command handler for `!doxear`: Doxxeo falso (simulación). */
export class DoxCommand extends Command {
  name = 'doxear';
  description = 'Doxxeo falso (simulación)';
  category = CommandCategory.FUN;
  aliases = ['doxear', 'doxxeo', 'doxeo'];
  usage = '!doxear @usuario';
  examples = ['!doxear @usuario'];
  cooldown = 15_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
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

    const mentionedJid = ctx.mentionedJid;
    const quotedSender = ctx.contextInfo?.quotedMessage ? ctx.quotedParticipant : null;

    const targetJid = mentionedJid || quotedSender;

    if (!targetJid) {
      await ctx.reply(`˚₊· ͟͟͞͞➳ *falta el usuario* ˚₊· ͟͟͞͞➳\n\n` + `✿ *!doxear* @usuario`);
      return;
    }

    const targetName = `@${targetJid.split('@')[0]}`;

    await ctx.react('🔍');
    await ctx.reply(`🚩 *Iniciando doxxeo...*`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const fakeIP = generateFakeIP();
    const fakeMAC = generateFakeMAC();

    const doxxeo = `╭━━━〔 🚩 DOXXEO COMPLETADO 〕━━━⬣
┃
┃ 👤 *Usuario:* ${targetName}
┃
┃ ⚠️ *INFORMACIÓN SIMULADA*
┃ (Datos ficticios generados)
┃
┃ 🌐 *IP:* ${fakeIP}
┃ 🔌 *Puerto:* ${pickRandom(['8080', '443', '80', '22', '3000'])}
┃ 📍 *Ubicación:* Fake City, Fake Country
┃
┃ 🖥️ *MAC:* ${fakeMAC}
┃ 📡 *ISP:* ${pickRandom(ISP_NAMES)}
┃ 🏠 *Router:* ${pickRandom(ROUTER_VENDORS)}
┃ 📱 *Dispositivo:* ${pickRandom(DEVICE_VENDORS)}
┃
┃ 🔓 *Puertos Abiertos:*
┃    TCP: 443, 80, 8080
┃    UDP: 53, 123
┃
┃ ⚠️ *NOTA IMPORTANTE:*
┃ Esta información es COMPLETAMENTE FALSA
┃ No compartir datos reales sin consentimiento
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

    await ctx.reply(doxxeo);
    await ctx.react('✅');
  }
}
