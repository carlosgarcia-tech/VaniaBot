/**
 * Rulesvv2Command.ts
 *
 * utility command `rules vv2` — Reglas VV2
 * Usage: !rules vv2
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { sendAssetImage } from '@/utils/assetHelper.js';

/** Command handler for `!rules vv2`: Reglas VV2. */
export class RulesVV2Command extends Command {
  name = 'rules vv2';
  description = 'Reglas VV2';
  category = CommandCategory.UTILITY;
  aliases = ['rules vv2'];
  usage = '!rules vv2';
  examples = ['!rules vv2'];

  async execute(ctx: MessageContext): Promise<void> {
    await sendAssetImage(ctx, 'vv2Rules.png', 'No se encontró la imagen de reglas VV2.');
  }
}

export default RulesVV2Command;
