/**
 * promptInjection.ts
 *
 * Detector de prompt injection y contenido malicioso usado antes de enviar
 * texto del usuario al modelo de IA. Es un módulo puro (sin dependencias de
 * Baileys, config ni servicios) para poder testearse de forma aislada: los
 * patrones viven en un solo sitio y no se duplican en los tests.
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

export interface InjectionCheckResult {
  blocked: boolean;
  reason?: 'prompt_injection' | 'malicious_content' | 'null_byte_injection' | 'unicode_overload';
}

const NULL_BYTE = /\x00/g;
const UNICODE_OVERLOAD_RANGE = /[\u200b-\u200f\u2028-\u202f]/g;
const UNICODE_OVERLOAD_LIMIT = 50;

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
