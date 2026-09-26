import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { VANIA_TOGGLE_COMMANDS } from '@/config/index.js';

export class VaniaToggleMiddleware extends Middleware {
  name = 'vania-toggle';

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup) {
      await next();
      return;
    }

    if (VANIA_TOGGLE_COMMANDS.includes(ctx.command)) {
      await next();
      return;
    }

    const allowed = await serviceManager.vaniaToggleService.isAllowedForSubbot(
      ctx.chat.jid,
      ctx.botId,
      ctx.command,
    );
    if (!allowed) {
      return;
    }

    await next();
  }
}
