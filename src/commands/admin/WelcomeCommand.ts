/**
 * WelcomeCommand.ts
 *
 * admin command `welcome` — Configura mensajes de bienvenida
 * Usage: !welcome [on/off/set/test/reset/pic/nopic]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { welcomeService } from '@/services/system/WelcomeService.js';

/** Command handler for `!welcome`: Configura mensajes de bienvenida. */
export class WelcomeCommand extends Command {
  name = 'welcome';
  description = 'Configura mensajes de bienvenida';
  category = CommandCategory.ADMIN;
  aliases = ['bienvenida'];
  usage = '!welcome [on/off/set/test/reset/pic/nopic]';
  examples = [
    '!welcome',
    '!welcome on',
    '!welcome off',
    '!welcome set Hola @user!',
    '!welcome test',
    '!welcome reset',
  ];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action) {
      await this.showConfig(ctx);
      return;
    }

    switch (action) {
      case 'on':
      case 'activar':
        await welcomeService.enableWelcome(ctx.chat.jid);
        await ctx.reply('Bienvenida activada con mensaje por defecto');
        break;

      case 'off':
      case 'desactivar':
        await welcomeService.disableWelcome(ctx.chat.jid);
        await ctx.reply('🔕 Bienvenida desactivada');
        break;

      case 'set':
      case 'establecer': {
        const message = ctx.args.slice(1).join(' ');
        if (!message) {
          await ctx.reply(
            '˚₊· ͟͟͞͞➳ oops, falta el mensajito ˚₊· ͟͟͞͞➳\n\n' +
              '✿ así me gusta ✿\n' +
              '`!welcome set qué onda @user, bienvenid@ a @group`\n\n' +
              '✩ mis variables ✩\n' +
              '`@user` ﹒`@group` ﹒`@desc` ﹒`@count` ﹒`@fact`',
          );
          return;
        }
        await welcomeService.setWelcomeMessage(ctx.chat.jid, message);
        await ctx.reply('✅ Mensaje de bienvenida guardado');
        break;
      }

      case 'test':
      case 'probar':
        await welcomeService.handleNewParticipant(ctx.sock, ctx.chat.jid, ctx.sender.jid);
        break;

      case 'reset':
      case 'restablecer':
        await welcomeService.resetMessages(ctx.chat.jid);
        await ctx.reply('Mensajes restablecidos a los valores por defecto');
        break;

      case 'nopic': {
        const config = await welcomeService.getConfig(ctx.chat.jid);
        const msgNoPic = config.welcome.message || welcomeService.getDefaultWelcome();
        await welcomeService.enableWelcome(ctx.chat.jid, msgNoPic, false);
        await ctx.reply('Foto de perfil desactivada en bienvenidas');
        break;
      }

      case 'pic': {
        const cfg = await welcomeService.getConfig(ctx.chat.jid);
        const msgWithPic = cfg.welcome.message || welcomeService.getDefaultWelcome();
        await welcomeService.enableWelcome(ctx.chat.jid, msgWithPic, true);
        await ctx.reply('Foto de perfil activada en bienvenidas');
        break;
      }

      default:
        await ctx.reply(
          '*: ̗̀➛ hmm, no sé eso ̖́-*\n\n' +
            '✿ comanditos\n' +
            '`on` → activar bienvenida\n' +
            '`off` → desactivar bienvenida\n' +
            '`set` → cambiar mensaje\n' +
            '`test` → probar bienvenida\n' +
            '`reset` → volver al defecto\n' +
            '`pic` → activar foto\n' +
            '`nopic` → quitar foto\n\n' +
            '✿ variables\n' +
            '`@user` ✩ `@group` ✩ `@desc` ✩ `@count` ✩ `@fact`',
        );
    }
  }

  private async showConfig(ctx: MessageContext): Promise<void> {
    const config = await welcomeService.getConfig(ctx.chat.jid);
    const welcomeMsg = config.welcome.message || welcomeService.getDefaultWelcome();

    const text = `
✧･ﾟ:*  𝘾𝙊𝙉𝙁𝙄𝙂 𝘽𝙄𝙀𝙉𝙑𝙀𝙉𝙄𝘿𝘼  *:･ﾟ✧

Estado : ${config.welcome.enabled ? '✅ activado' : '❌ desactivado'}
Foto   : ${config.welcome.useProfilePic ? '✅ sí' : '❌ no'}

Mensaje actual:
${welcomeMsg}

Comandos:
!welcome on / off
!welcome set [texto]
!welcome test
!welcome reset
!welcome pic / nopic

Variables: @user  @group  @desc  @count  @fact
    `.trim();

    await ctx.reply(text);
  }
}
