/**
 * prefix.ts
 *
 * Single source of truth for command-prefix matching.
 *
 * The bot accepts the configured prefix plus '.' and '!' as command
 * prefixes. When several prefixes match (e.g. '..' and '.'), the longest
 * one wins so multi-char prefixes are not swallowed by shorter ones.
 *
 * Previously duplicated (and drifting) in MessageContext.parseCommand and
 * MainMessagePipeline.handleMessage.
 *
 * @author **Carlos G** ⭐
 */

import { config } from '@/config/index.js';

/** Deduplicated prefix list, longest first, ready for `startsWith` checks. */
export const COMMAND_PREFIXES: readonly string[] = [config.prefix, '.', '!']
  .filter((p, i, arr): p is string => Boolean(p) && arr.indexOf(p) === i)
  .sort((a, b) => b.length - a.length);

/**
 * Returns the longest prefix that `text` starts with, or undefined when the
 * text is not a command.
 */
export function matchCommandPrefix(text: string): string | undefined {
  return COMMAND_PREFIXES.find(p => text.startsWith(p));
}
