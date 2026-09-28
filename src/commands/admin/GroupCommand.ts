import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import type { GroupParticipant, WASocket } from 'baileys';
import { cacheManager } from '@/core/CacheManager.js';

type GroupSocket = WASocket & {
  groupUpdateSubject(jid: string, subject: string): Promise<void>;
  groupUpdateDescription(jid: string, description: string): Promise<void>;
  updateProfilePicture(jid: string, img: Buffer): Promise<void>;
  deleteProfilePicture(jid: string): Promise<void>;
  groupRevokeInvite(jid: string): Promise<string>;
};

export class GroupCommand extends Command {
  name = 'group';
  description = 'Administrar configuración del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['grupo', 'grupoconfig'];
  usage = '.group [lock/unlock/info/settings]';
  examples = ['.group lock', '.group unlock', '.group info', '.group settings'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action) {
      await this.showHelp(ctx);
      return;
    }

    switch (action) {
      case 'lock':
      case 'cerrar':
        await this.lockGroup(ctx);
        break;
      case 'unlock':
      case 'abrir':
        await this.unlockGroup(ctx);
        break;
      case 'info':
        await this.groupInfo(ctx);
        break;
      case 'settings':
      case 'config':
        await this.groupSettings(ctx);
        break;
      default:
        await ctx.reply(`Acción desconocida: ${action}\nAcciones: lock, unlock, info, settings`);
    }
  }

  private async lockGroup(ctx: MessageContext): Promise<void> {
    try {
      await ctx.sock.groupSettingUpdate(ctx.chat.jid, 'locked');
      await ctx.reply('🔒 *Grupo cerrado*\nAhora solo los administradores pueden escribir.');
    } catch {
      await ctx.reply('❌ Error al cerrar el grupo');
    }
  }

  private async unlockGroup(ctx: MessageContext): Promise<void> {
    try {
      await ctx.sock.groupSettingUpdate(ctx.chat.jid, 'unlocked');
      await ctx.reply('🔓 *Grupo abierto*\nTodos los miembros pueden escribir.');
    } catch {
      await ctx.reply('❌ Error al abrir el grupo');
    }
  }

  private async groupInfo(ctx: MessageContext): Promise<void> {
    try {
      const metadata = await cacheManager.getGroupMetadataSafe(ctx.sock, ctx.chat.jid);

      const creationDate = metadata.creation
        ? new Date(metadata.creation * 1000).toLocaleDateString()
        : 'Desconocida';
      const owner = metadata.owner?.split('@')[0] || 'Desconocido';
      const memberCount = metadata.participants.length;
      const adminCount = metadata.participants.filter((p: GroupParticipant) => p.admin).length;

      let message = `*📋 Información del Grupo*\n\n`;
      message += `*Nombre:* ${metadata.subject}\n`;
      message += `*Descripción:* ${metadata.desc || 'Sin descripción'}\n`;
      message += `*Creado:* ${creationDate}\n`;
      message += `*Dueño:* @${owner}\n`;
      message += `*Miembros:* ${memberCount}\n`;
      message += `*Admins:* ${adminCount}\n`;
      message += `*Código:* ${metadata.id.split('@')[0]}`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener información del grupo');
    }
  }

  private async groupSettings(ctx: MessageContext): Promise<void> {
    try {
      const metadata = await cacheManager.getGroupMetadataSafe(ctx.sock, ctx.chat.jid);

      let message = `*⚙️ Configuración del Grupo*\n\n`;
      message += `*Nombre:* ${metadata.subject}\n`;
      message += `*Miembros:* ${metadata.participants.length}\n`;
      message += `*Código:* ${metadata.id.split('@')[0]}\n\n`;
      message += `_Usa .group lock/unlock para cambiar el estado_`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener configuración');
    }
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    let message = `*⚙️ Comandos de Grupo*\n\n`;
    message += `*• .group lock* - Cerrar grupo (solo admins escriben)\n`;
    message += `*• .group unlock* - Abrir grupo\n`;
    message += `*• .group info* - Ver información del grupo\n`;
    message += `*• .group settings* - Ver configuración actual\n`;

    await ctx.reply(message);
  }
}

export class RevokeCommand extends Command {
  name = 'revoke';
  description = 'Revocar enlace de invitación y generar uno nuevo';
  category = CommandCategory.ADMIN;
  aliases = ['resetlink', 'revokelink', 'nuevolink'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const newCode = await (ctx.sock as GroupSocket).groupRevokeInvite(ctx.chat.jid);

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *enlace actualizado* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ el enlace anterior ha sido invalidado ✿\n\n` +
          `🔗 *Nuevo enlace:*\n` +
          `https://chat.whatsapp.com/${newCode}\n\n` +
          `⚠️ Comparte el nuevo enlace con los miembros`,
      );
    } catch {
      await ctx.reply('❌ Error al revocar el enlace. Asegúrate de que soy admin.');
    }
  }
}

export class TagadminCommand extends Command {
  name = 'tagadmin';
  description = 'Mencionar solo a los administradores';
  category = CommandCategory.ADMIN;
  aliases = ['admins', 'admin'];
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const metadata = await cacheManager.getGroupMetadataSafe(ctx.sock, ctx.chat.jid);
      const admins = metadata.participants.filter((p: GroupParticipant) => p.admin);

      if (admins.length === 0) {
        await ctx.reply('No hay administradores en el grupo.');
        return;
      }

      const adminMentions = admins
        .map((a: GroupParticipant) => `@${a.id.split('@')[0]}`)
        .join(', ');
      const message = ctx.args.join(' ') || `📢 ¡Administradores!: ${adminMentions}`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener administradores');
    }
  }
}

export class SetnameCommand extends Command {
  name = 'setname';
  description = 'Cambiar el nombre del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['setgroupname', 'gruponombre', 'setgn', 'setgname'];
  usage = '!setname <nombre>';
  examples = ['!setname Nuevo Nombre del Grupo'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const newName = ctx.args.join(' ').trim();

    if (!newName) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *setname* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ cambia el nombre del grupo ✿\n\n` +
          `\`!setname <nombre>\`\n\n` +
          `✩ ejemplo:\n` +
          `  ﹒!setname Mi Grupo Awesome`,
      );
      return;
    }

    if (newName.length < 1) {
      await ctx.reply('❌ El nombre no puede estar vacío.');
      return;
    }

    if (newName.length > 100) {
      await ctx.reply('❌ El nombre es muy largo. Máximo 100 caracteres.');
      return;
    }

    try {
      await (ctx.sock as GroupSocket).groupUpdateSubject(ctx.chat.jid, newName);

      await ctx.reply(`˚₊· ͟͟͞͞➳ *nombre actualizado* ˚₊· ͟͟͞͞➳\n\n` + `✿ "${newName}" ✿`);
    } catch {
      await ctx.reply('❌ Error al cambiar el nombre. Asegúrate de que soy admin.');
    }
  }
}

export class SetdescCommand extends Command {
  name = 'setdesc';
  description = 'Cambiar la descripción del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['setdescription', 'setabout', 'descripcion', 'setgdesc'];
  usage = '!setdesc <descripción>';
  examples = ['!setdesc Bienvenidos al grupo'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const newDesc = ctx.args.join(' ').trim();

    if (!newDesc) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *setdesc* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ cambia la descripción del grupo ✿\n\n` +
          `\`!setdesc <descripción>\`\n\n` +
          `✩ ejemplo:\n` +
          `  ﹒!setdesc Bienvenidos a este gran grupo`,
      );
      return;
    }

    if (newDesc.length > 500) {
      await ctx.reply('❌ La descripción es muy larga. Máximo 500 caracteres.');
      return;
    }

    try {
      await (ctx.sock as GroupSocket).groupUpdateDescription(ctx.chat.jid, newDesc);

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *descripción actualizada* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ "${newDesc.substring(0, 50)}${newDesc.length > 50 ? '...' : ''}" ✿`,
      );
    } catch {
      await ctx.reply('❌ Error al cambiar la descripción. Asegúrate de que soy admin.');
    }
  }
}

export class SetpicCommand extends Command {
  name = 'setpic';
  description = 'Cambiar la foto del grupo (responde a imagen)';
  category = CommandCategory.ADMIN;
  aliases = ['setphoto', 'setgrouppic', 'fotogrupo', 'setgpp'];
  usage = '!setpic (responde a una imagen)';
  examples = ['!setpic (responde a una imagen con el comando)'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const quoted = ctx.quoted;
    const imageMessage = quoted?.imageMessage || quoted?.stickerMessage;

    if (!imageMessage) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *setpic* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ cambia la foto del grupo ✿\n\n` +
          `📸 Responde a una imagen con el comando:\n` +
          `\`!setpic\`\n\n` +
          `✩ También puedes responder a un sticker`,
      );
      return;
    }

    try {
      const { downloadContentFromMessage } = await import('baileys');
      const stream = await downloadContentFromMessage(imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      await (ctx.sock as GroupSocket).updateProfilePicture(ctx.chat.jid, buffer);

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *foto actualizada* ˚₊· ͟͟͞͞➳\n\n` + `✿ la foto del grupo ha sido cambiada ✿`,
      );
    } catch {
      await ctx.reply(
        '❌ Error al cambiar la foto. Asegúrate de que soy admin y la imagen es válida.',
      );
    }
  }
}

export class DelpicCommand extends Command {
  name = 'delpic';
  description = 'Eliminar la foto del grupo';
  category = CommandCategory.ADMIN;
  aliases = ['deletepic', 'removepic', 'eliminarfoto', 'delgpp'];
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await (ctx.sock as GroupSocket).deleteProfilePicture(ctx.chat.jid);

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *foto eliminada* ˚₊· ͟͟͞͞➳\n\n` + `✿ la foto del grupo ha sido eliminada ✿`,
      );
    } catch {
      await ctx.reply('❌ Error al eliminar la foto. Asegúrate de que soy admin.');
    }
  }
}
