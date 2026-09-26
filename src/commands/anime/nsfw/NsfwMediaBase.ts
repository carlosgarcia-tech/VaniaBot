/**
 * NsfwMediaBase.ts
 *
 * Shared fetch → send-media → react flow for the anime/nsfw commands.
 * Subclasses only declare metadata and describe how to obtain the media
 * URL; the base class handles UX (reactions, usage errors) and failure
 * handling (log + ❌ + friendly message), consolidating the boilerplate
 * previously copy-pasted across every command in this directory.
 *
 * @author **Carlos G** ⭐
 */

import { Command } from '../../Command.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export abstract class NsfwMediaBase extends Command {
  category = CommandCategory.ANIME;
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER], bot: [] };
  // Gated behind the persisted NSFW toggle instead of being hard-disabled.
  nsfw = true;

  /** Emoji reacted while the request is in flight. */
  protected abstract readonly searchEmoji: string;

  /** Emoji reacted when the usage message is shown (defaults to ✍️). */
  protected get usageEmoji(): string {
    return '✍️';
  }

  /** Fetches the media URL for this command, or null when nothing found. */
  protected abstract fetchMedia(ctx: MessageContext): Promise<string | null>;

  /** Content sent to the chat once the media URL is resolved. */
  protected abstract buildMessage(
    mediaUrl: string,
    ctx: MessageContext,
  ): { image: { url: string } } | { video: { url: string } };

  /** Usage message shown when the command has no arguments. */
  protected usageMessage(): string {
    const usage = this.usage ?? `!${this.name}`;
    const examples = this.examples?.length ? `\n_Ejemplo: ${this.examples[0]}_` : '';
    return `${this.usageEmoji} *Uso:* ${usage}${examples}`;
  }

  /** Friendly error message for this command. */
  protected errorMessage(): string {
    return '❌ No pude realizar la búsqueda. Intenta de nuevo.';
  }

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (this.requiresQuery() && !query) {
      await ctx.reply(this.usageMessage());
      return;
    }

    await ctx.react(this.searchEmoji);

    try {
      const mediaUrl = await this.fetchMedia(ctx);

      if (!mediaUrl) {
        await ctx.reply('❌ No se encontraron resultados.');
        return;
      }

      await ctx.sock.sendMessage(ctx.chat.jid, this.buildMessage(mediaUrl, ctx));
      await ctx.react('✅');
    } catch (error) {
      logError(`[${this.constructor.name}]`, error);
      await ctx.react('❌');
      await ctx.reply(this.errorMessage());
    }
  }

  /** Whether this command needs arguments to run. */
  protected requiresQuery(): boolean {
    return true;
  }
}
