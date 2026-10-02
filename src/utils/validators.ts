/**
 * validators.ts
 *
 * Reusable input validation for command arguments.
 *
 * Two groups live here:
 * - Small type/format predicates (`isNumeric`, `isValidUrl`, ...) used to guard
 *   command arguments before doing any work.
 * - Economy-specific validators that return a user-ready error message
 *   alongside the verdict, so commands can reply directly with `error`.
 *
 * Note: several of these back WhatsApp's own formatting (see extractMentions in
 * helpers.ts), so changes here can affect message rendering.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

/** True for a 10-15 digit phone number, ignoring formatting characters. */
export function isValidWhatsAppNumber(number: string): boolean {
  const cleaned = number.replace(/[^\d]/g, '');
  return /^\d{10,15}$/.test(cleaned);
}

/** True for a group JID (`@g.us` suffix). */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/** True for a user JID (`@s.whatsapp.net` suffix). */
export function isUserJid(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net');
}

/** Strips formatting, keeping digits and a leading plus sign. */
export function cleanPhoneNumber(number: string): string {
  return number.replace(/[^\d+]/g, '');
}

/** Minimal email shape check (no deliverability validation). */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/** True when the string parses as an absolute URL. */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** True for digits only (no sign or decimal point). */
export function isNumeric(text: string): boolean {
  return /^\d+$/.test(text);
}

/** True for letters and digits only. */
export function isAlphanumeric(text: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(text);
}

export function minLength(text: string, min: number): boolean {
  return text.length >= min;
}

export function maxLength(text: string, max: number): boolean {
  return text.length <= max;
}

/** Inclusive range check. */
export function inRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/** True when every listed property is present and defined on the object. */
export function hasRequiredProps<T extends object>(obj: T, props: (keyof T)[]): boolean {
  return props.every(prop => prop in obj && obj[prop] !== undefined);
}

/** True for a real YYYY-MM-DD calendar date. */
export function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/** True for a 24-hour HH:MM time. */
export function isValidTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/** Removes angle brackets and quotes, then trims. */
export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, '').replace(/['"]/g, '').trim();
}

export function isNonEmptyArray<T>(arr: T[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

export function isOneOf<T>(value: T, options: T[]): boolean {
  return options.includes(value);
}

/** True for letters only. */
export function isAlpha(text: string): boolean {
  return /^[a-zA-Z]+$/.test(text);
}

/** True for a six-digit hex colour, with or without the leading `#`. */
export function isValidHex(hex: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

export function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

/** Strictly greater than zero (zero is not positive here). */
export function isPositive(value: number): boolean {
  return value > 0;
}

/** True when the text contains anything outside letters, digits and spaces. */
export function hasSpecialChars(text: string): boolean {
  return /[^a-zA-Z0-9\s]/.test(text);
}

/** 3-20 characters of letters, digits, underscore or hyphen. */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

/** Type guard for plain objects (excludes arrays and null). */
export function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the string is parseable JSON. */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/** At least 8 characters with an uppercase, a lowercase and a digit. */
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  );
}

/** Substring match against a blocklist, case-insensitive. */
export function containsProfanity(text: string, badWords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return badWords.some(word => lowerText.includes(word.toLowerCase()));
}

export function isWhatsAppLink(url: string): boolean {
  return /chat\.whatsapp\.com\//.test(url);
}

/** True when the URL's hostname contains `domain`. */
export function isDomainLink(url: string, domain: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes(domain);
  } catch {
    return false;
  }
}

/** Verdict plus a user-ready message; `error` is set only when invalid. */
export interface BetValidationResult {
  valid: boolean;
  error?: string;
}

export interface TransferValidationResult {
  valid: boolean;
  error?: string;
}

/** Limits applied by the economy validators; falls back to DEFAULT_CONFIG. */
export interface ValidationConfig {
  minBet?: number;
  maxBet?: number;
  vipMaxBet?: number;
  minTransfer?: number;
  maxTransfer?: number;
  isOwner?: boolean;
}

const DEFAULT_CONFIG: Required<ValidationConfig> = {
  minBet: 50,
  maxBet: 100000,
  vipMaxBet: 500000,
  minTransfer: 1,
  maxTransfer: 1000000,
  isOwner: false,
};

/**
 * Validates a bet: positive, within the min/max range for the user's tier, and
 * covered by their balance. VIP users are checked against the higher ceiling.
 */
export function validateBetAmount(
  amount: number,
  userBalance: number,
  config: ValidationConfig = DEFAULT_CONFIG,
  isVip: boolean = false,
): BetValidationResult {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: '❌ Monto inválido' };
  }

  const minBet = config.minBet ?? DEFAULT_CONFIG.minBet;
  const maxBet = isVip
    ? (config.vipMaxBet ?? DEFAULT_CONFIG.vipMaxBet)
    : (config.maxBet ?? DEFAULT_CONFIG.maxBet);

  if (amount < minBet) {
    return { valid: false, error: `❌ Apuesta mínima: $${minBet}` };
  }

  if (amount > maxBet) {
    return { valid: false, error: `❌ Apuesta máxima: $${maxBet}` };
  }

  if (amount > userBalance) {
    return {
      valid: false,
      error: `❌ Saldo insuficiente. Balance: $${userBalance.toLocaleString()}`,
    };
  }

  return { valid: true };
}

/**
 * Validates a transfer: amount range (owners are exempt from limits), not a
 * self-transfer, and covered by the sender's balance.
 *
 * The self-transfer check compares both full JIDs and the bare phone number,
 * because a user may reference themselves by a different identifier form.
 */
export function validateTransferAmount(
  amount: number,
  senderBalance: number,
  recipientJid: string,
  senderJid: string,
  config: ValidationConfig = DEFAULT_CONFIG,
): TransferValidationResult {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: '❌ Monto inválido' };
  }

  const isOwner = config.isOwner ?? false;
  const minTransfer = config.minTransfer ?? DEFAULT_CONFIG.minTransfer;
  const maxTransfer = config.maxTransfer ?? DEFAULT_CONFIG.maxTransfer;

  if (!isOwner && amount < minTransfer) {
    return { valid: false, error: `❌ Transferencia mínima: $${minTransfer}` };
  }

  if (!isOwner && amount > maxTransfer) {
    return { valid: false, error: `❌ Transferencia máxima: $${maxTransfer}` };
  }

  if (senderJid === recipientJid || recipientJid.includes(senderJid.split('@')[0])) {
    return { valid: false, error: '❌ No puedes transferirte a ti mismo' };
  }

  if (!isOwner && amount > senderBalance) {
    return {
      valid: false,
      error: `❌ Saldo insuficiente. Balance: $${senderBalance.toLocaleString()}`,
    };
  }

  return { valid: true };
}

/** Checks a timestamped cooldown, returning the remaining time when blocked. */
export function validateWorkCooldown(
  lastWork: number | undefined,
  cooldownMs: number = 60 * 60 * 1000,
): {
  allowed: boolean;
  remainingMs?: number;
} {
  if (!lastWork) return { allowed: true };

  const elapsed = Date.now() - lastWork;
  const remaining = cooldownMs - elapsed;

  if (remaining > 0) {
    return { allowed: false, remainingMs: remaining };
  }

  return { allowed: true };
}

/** Checks the 24-hour daily-reward cooldown. */
export function validateDailyCooldown(lastDaily: number | undefined): {
  allowed: boolean;
  remainingMs?: number;
} {
  if (!lastDaily) return { allowed: true };

  const cooldownMs = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - lastDaily;
  const remaining = cooldownMs - elapsed;

  if (remaining > 0) {
    return { allowed: false, remainingMs: remaining };
  }

  return { allowed: true };
}

/** Checks the 7-day weekly-reward cooldown. */
export function validateWeeklyCooldown(lastWeekly: number | undefined): {
  allowed: boolean;
  remainingMs?: number;
} {
  if (!lastWeekly) return { allowed: true };

  const cooldownMs = 7 * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - lastWeekly;
  const remaining = cooldownMs - elapsed;

  if (remaining > 0) {
    return { allowed: false, remainingMs: remaining };
  }

  return { allowed: true };
}

/** Removes angle brackets and quotes, collapses whitespace and truncates. */
export function sanitizeTextInput(input: string, maxLength: number = 500): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** True when the JID is one that can legally be mentioned in a reply. */
export function validateMention(jid: string): boolean {
  return isUserJid(jid) || isGroupJid(jid);
}
