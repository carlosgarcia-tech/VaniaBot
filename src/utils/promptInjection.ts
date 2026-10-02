/**
 * promptInjection.ts
 *
 * VaniaBot utils module exposing `InjectionCheckResult`, `detectPromptInjection`, `BLOCKED_PROMPT_PATTERNS`, `BLOCKED_CONTENT_PATTERNS`.
 *
 * @author **Carlos G**
 */

/**
 * promptInjection.ts
 *
 * Detector for prompt injection and malicious payloads, run before user text
 * is forwarded to the language model.
 *
 * Deliberately a pure module (no Baileys, config or service imports) so it can
 * be unit tested in isolation: the patterns live in one place instead of being
 * duplicated across tests.
 *
 * Two independent checks are applied:
 * 1. Prompt injection — attempts to override the system prompt or persona.
 * 2. Malicious content — code/SQL/script payloads the bot has no reason to run.
 * Plus two encoding tricks: null bytes and excessive invisible Unicode.
 */

export const BLOCKED_PROMPT_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|orders?|commands?|directions?)/i,
  /disregard\s+(all\s+)?(your\s+)?(system\s+)?(prompt|instructions?|constraints?)/i,
  /forget\s+(all\s+)?(your\s+)?(previous|prior|system)\s+(instructions?|prompt|rules?)/i,
  /\b(you\s+are\s+now|act\s+as|pretend\s+you\s+are)\b/i,
  /\b(jailbreak|bypass|unfilter|devmode|developer\s+mode)\b/i,
  /\b(DAN|STAN|Jailbreak)\b/i,
  /\{(system\s*prompt|base64|decode|exec|eval)\}/i,
  /<\|(system|version|end)\|>/i,
  /\[\s*(\*|system)\s*\]/i,
  /new\s+system:\s*/i,
  /end\s+(of\s+)?(your\s+)?(system\s+)?(prompt|instructions?)/i,
  /override\s+(your\s+)?(safety|content\s+policy)/i,
  /ignore\s+all\s+previous\s+rules?/i,
  /you\s+have\s+no\s+(restrictions?|limitations?|safety)/i,
  /\$system\$|\$user\$|\$assistant\$/i,
  /@(?:sudo|admin|root|exec|shell)/i,
  /\x00|\x1b|\u200b|\u202e/,
];

/** Code/SQL/script payloads with no legitimate use in a chat bot. */
export const BLOCKED_CONTENT_PATTERNS = [
  /<\?php|\$\w+\s*=/i,
  /import\s+(os|sys|subprocess)/i,
  /require\s*\(|exec\s*\(|eval\s*\(/i,
  /SELECT\s+.+\s+FROM\s+/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM\s+/i,
  /<\s*script/i,
  /javascript:/i,
  /data:text\/html/i,
];

/** Outcome of a scan; `reason` is only set when `blocked` is true. */
export interface InjectionCheckResult {
  blocked: boolean;
  reason?: 'prompt_injection' | 'malicious_content' | 'null_byte_injection' | 'unicode_overload';
}

const NULL_BYTE = /\x00/g;
/** Zero-width, bidi-control and line/paragraph-separator characters. */
const UNICODE_OVERLOAD_RANGE = /[\u200b-\u200f\u2028-\u202f]/g;
/** Tolerates a few invisible characters, blocks a deliberate obfuscation flood. */
const UNICODE_OVERLOAD_LIMIT = 50;

/**
 * Scans text for injection attempts and malicious payloads.
 * Returns on the first match, so the reason reflects the earliest rule hit.
 */
export function detectPromptInjection(text: string): InjectionCheckResult {
  for (const pattern of BLOCKED_PROMPT_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: 'prompt_injection' };
    }
  }

  for (const pattern of BLOCKED_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: 'malicious_content' };
    }
  }

  if ((text.match(NULL_BYTE) || []).length > 0) {
    return { blocked: true, reason: 'null_byte_injection' };
  }

  if ((text.match(UNICODE_OVERLOAD_RANGE) || []).length > UNICODE_OVERLOAD_LIMIT) {
    return { blocked: true, reason: 'unicode_overload' };
  }

  return { blocked: false };
}
