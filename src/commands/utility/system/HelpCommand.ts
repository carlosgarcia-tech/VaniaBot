import { Command } from '../../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { commandRegistry } from '@/core/CommandRegistry.js';
import { pluginLoader } from '@/core/PluginLoader.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';
import { logError, logger } from '@/utils/logger.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import axios from 'axios';

const charset: Record<string, string> = {
  a: 'ᴀ',
  b: 'ʙ',
  c: 'ᴄ',
  d: 'ᴅ',
  e: 'ᴇ',
  f: 'ꜰ',
  g: 'ɢ',
  h: 'ʜ',
  i: 'ɪ',
  j: 'ᴊ',
  k: 'ᴋ',
  l: 'ʟ',
  m: 'ᴍ',
  n: 'ɴ',
  o: 'ᴏ',
  p: 'ᴘ',
  q: 'ǫ',
  r: 'ʀ',
  s: 'ꜱ',
  t: 'ᴛ',
  u: 'ᴜ',
  v: 'ᴠ',
  w: 'ᴡ',
  x: 'x',
  y: 'ʏ',
  z: 'ᴢ',
};

const toSmallCaps = (text: string): string =>
  text.toLowerCase().replace(/[a-z]/g, c => charset[c] ?? c);

export class HelpCommand extends Command {
  name = 'help';
  description = 'Muestra lista de comandos disponibles';
  category = CommandCategory.UTILITY;
  aliases = ['ayuda', 'menu', 'comandos'];
  usage = '!help [comando]';
  examples = ['!help', '!help profile', '!menu'];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.react('💝');
    } catch (error) {
      logger.debug('[HelpCommand] React failed:', error);
    }

    if (ctx.args.length > 0) {
      await this.showCommandHelp(ctx, ctx.args[0]);
      return;
    }

    await this.showFullMenu(ctx);
  }

  private async showCommandHelp(ctx: MessageContext, commandName: string): Promise<void> {
    const command = commandRegistry.get(commandName.toLowerCase());
    if (!command) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, "${commandName}" no está en mi lista* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ prueba con *!help* para ver lo que sé hacer ✩`,
      );
      return;
    }

    let helpText = `⧼⋆꙳• *AYUDA DE COMANDO* ⋆꙳•⧽\n\n`;
    helpText += `📌 *Comando:* ${command.name}\n`;
    helpText += `📝 *Descripción:* ${command.description}\n`;
    if (command.aliases?.length) helpText += `🔄 *Alias:* ${command.aliases.join(', ')}\n`;
    if (command.usage) helpText += `\n💡 *Uso:*\n   ${command.usage}\n`;
    if (command.examples?.length) {
      helpText += `\n✨ *Ejemplos:*\n`;
      command.examples.forEach(ex => (helpText += `   • ${ex}\n`));
    }
    if (command.cooldown) helpText += `\n⏱️ *Cooldown:* ${command.cooldown / 1000}s\n`;
    helpText += `\n⌬ 𝗩𝗔𝗡𝗜𝗔 𝗕𝗢𝗧 💝`;

    await ctx.reply(helpText);
  }

  private async showFullMenu(ctx: MessageContext): Promise<void> {
    const registeredCommands = commandRegistry.getAll();
    if (registeredCommands.length < pluginLoader.getCommandCount().total) {
      const allLoaded = await pluginLoader.getAllCommands();
      for (const cmd of allLoaded) {
        if (!commandRegistry.get(cmd.name)) {
          commandRegistry.register(cmd);
        }
      }
    }

    const allCommands = commandRegistry.getAll();
    const isPrime = ctx.chat.isGroup ? await primeService.isPrimeEnabled(ctx.chat.jid) : false;
    const botName =
      ctx.chat.isGroup && isPrime
        ? await primeService.getGroupName(ctx.sock, ctx.chat.jid)
        : 'VANIA';

    let userData, progress;
    try {
      userData = await serviceManager.userService.getUser(ctx.sender.jid);
      progress = await serviceManager.levelService.getLevelProgress(ctx.sender.jid);
    } catch {
      userData = { level: 0, xp: 0, name: ctx.sender.pushName || 'Usuario' };
      progress = { currentXP: 0, requiredXP: 100 };
    }

    const commandsByCategory = new Map<CommandCategory, typeof allCommands>();
    allCommands.forEach(cmd => {
      if (!commandsByCategory.has(cmd.category)) {
        commandsByCategory.set(cmd.category, []);
      }
      const list = commandsByCategory.get(cmd.category);
      if (list) list.push(cmd);
    });

    const uptime = this.getUptime();
    const readmore = String.fromCharCode(8206).repeat(4001);

    let menu = `⧼⋆꙳• *REGISTRO ${botName}* ⋆꙳•⧽\n\n`;
    menu += `> 💝 ɴᴏᴍʙʀᴇ   » ${userData.name}\n`;
    menu += `> ⚙️ ɴɪᴠᴇʟ     » ${userData.level}\n`;
    menu += `> ⚡ ᴇxᴘ        » ${progress.currentXP} / ${progress.requiredXP}\n`;
    menu += `> 🌐 ᴍᴏᴅᴏ      » ${isPrime ? 'Prime' : 'Público'}\n`;
    menu += `> ⏳ ᴀᴄᴛɪᴠᴏ   » ${uptime}\n`;
    menu += `> 👥 ᴜꜱᴜᴀʀɪᴏꜱ » 1\n\n`;
    menu += `🤖 » 𝐌𝐄𝐍𝐔 ${botName} 𝐁𝐎𝐓 «\n`;
    menu += `👑 » 𝗢𝗽𝗲𝗿𝗮𝗱𝗼𝗿𝐚: ${isPrime ? botName : '𝐕𝐚𝐧𝐢𝐚'} «\n${readmore}\n`;

    const categoryOrder = [
      CommandCategory.UTILITY,
      CommandCategory.FUN,
      CommandCategory.ANIME,
      CommandCategory.CREATIVE,
      CommandCategory.SUBBOT,
      CommandCategory.ECONOMY,
      CommandCategory.MODERATION,
      CommandCategory.GROUP,
      CommandCategory.MEDIA,
      CommandCategory.GAME,
      CommandCategory.RPG,
      CommandCategory.FREEFIRE,
      CommandCategory.INFORMATION,
      CommandCategory.ADMIN,
      CommandCategory.OWNER,
    ];
    const categoryIcons: Record<CommandCategory, string> = {
      [CommandCategory.UTILITY]: '🔧',
      [CommandCategory.FUN]: '🎉',
      [CommandCategory.ANIME]: '🐾',
      [CommandCategory.CREATIVE]: '🎭',
      [CommandCategory.SUBBOT]: '🌸',
      [CommandCategory.ECONOMY]: '💰',
      [CommandCategory.MODERATION]: '🛡️',
      [CommandCategory.GROUP]: '👥',
      [CommandCategory.MEDIA]: '🎨',
      [CommandCategory.GAME]: '🎮',
      [CommandCategory.RPG]: '⚔️',
      [CommandCategory.FREEFIRE]: '🎯',
      [CommandCategory.INFORMATION]: '📚',
      [CommandCategory.ADMIN]: '⚙️',
      [CommandCategory.OWNER]: '♛',
    };
    const categoryNames: Record<CommandCategory, string> = {
      [CommandCategory.UTILITY]: toSmallCaps('utilidad'),
      [CommandCategory.FUN]: toSmallCaps('diversión'),
      [CommandCategory.ANIME]: toSmallCaps('anime'),
      [CommandCategory.CREATIVE]: toSmallCaps('creativo'),
      [CommandCategory.SUBBOT]: toSmallCaps('subbots'),
      [CommandCategory.ECONOMY]: toSmallCaps('economía'),
      [CommandCategory.MODERATION]: toSmallCaps('moderación'),
      [CommandCategory.GROUP]: toSmallCaps('grupos'),
      [CommandCategory.MEDIA]: toSmallCaps('multimedia'),
      [CommandCategory.GAME]: toSmallCaps('juegos'),
      [CommandCategory.RPG]: toSmallCaps('rpg'),
      [CommandCategory.FREEFIRE]: toSmallCaps('free fire'),
      [CommandCategory.INFORMATION]: toSmallCaps('información'),
      [CommandCategory.ADMIN]: toSmallCaps('administración'),
      [CommandCategory.OWNER]: toSmallCaps('owner'),
    };

    categoryOrder.forEach(category => {
      const commands = commandsByCategory.get(category);
      if (!commands?.length) return;
      const visible = commands.filter(cmd => {
        if (cmd.permissions?.user?.includes(PermissionLevel.OWNER)) return ctx.sender.isOwner;
        if (cmd.permissions?.user?.includes(PermissionLevel.ADMIN))
          return ctx.sender.isAdmin || ctx.sender.isOwner;
        return true;
      });
      if (!visible.length) return;
      menu += `\n⧼⋆꙳•〔 ${categoryIcons[category]} ${categoryNames[category]} 〕⋆꙳•⧽\n`;
      visible.forEach(cmd => (menu += `> 💝 !${cmd.name}\n`));
      menu += `╰⋆꙳•❅‧*₊⋆꙳︎‧*❆₊⋆╯\n`;
    });

    menu += `\n⌬ ${botName} 𝗕𝗢𝗧 💝 - Sistema ejecutado con éxito.`;

    await this.sendSimpleMenu(ctx, menu, isPrime);
  }

  private async sendSimpleMenu(ctx: MessageContext, text: string, isPrime: boolean): Promise<void> {
    try {
      let imageBuffer: Buffer | null = null;

      if (ctx.chat.isGroup && isPrime) {
        const groupPicUrl = await primeService.getGroupPicUrl(ctx.sock, ctx.chat.jid);
        if (groupPicUrl) {
          try {
            const response = await axios.get(groupPicUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(response.data);
          } catch {
            imageBuffer = null;
          }
        }
      }

      if (!imageBuffer) {
        imageBuffer = findAssetFile('logo.png');
      }

      if (imageBuffer) {
        await ctx.sock.sendMessage(
          ctx.chat.jid,
          { image: imageBuffer, caption: text },
          { quoted: ctx.message },
        );
      } else {
        await ctx.sock.sendMessage(ctx.chat.jid, { text }, { quoted: ctx.message });
      }
    } catch (error) {
      logError('Error enviando menú:', error);
      await ctx.sock.sendMessage(ctx.chat.jid, { text }, { quoted: ctx.message });
    }
  }

  private getUptime(): string {
    const uptime = process.uptime() * 1000;
    const h = Math.floor(uptime / 3600000);
    const m = Math.floor((uptime % 3600000) / 60000);
    const s = Math.floor((uptime % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

export default HelpCommand;
