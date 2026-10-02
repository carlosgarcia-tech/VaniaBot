/**
 * Checks if a string is a valid WhatsApp phone number.
 *
 * @param number - The phone number string to validate.
 * @returns True if the number is valid (10-15 digits after cleaning).
 */
export function isValidWhatsAppNumber(number: string): boolean {
  const cleaned = number.replace(/[^\d]/g, '');
  return /^\d{10,15}$/.test(cleaned);
}

/**
 * Checks if a JID is a group JID.
 *
 * @param jid - The JID string to check.
 * @returns True if the JID ends with '@g.us'.
 */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/**
 * Checks if a JID is a user JID.
 *
 * @param jid - The JID string to check.
 * @returns True if the JID ends with '@s.whatsapp.net'.
 */
export function isUserJid(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net');
}

/**
 * Cleans a phone number by removing non-digit and non-plus characters.
 *
 * @param number - The phone number string.
 * @returns The cleaned phone number.
 */
export function cleanPhoneNumber(number: string): string {
  return number.replace(/[^\d+]/g, '');
}

/**
 * Checks if a string is a valid email address.
 *
 * @param email - The email string to validate.
 * @returns True if the email format is valid.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if a string is a valid URL.
 *
 * @param url - The URL string to validate.
 * @returns True if the URL is valid.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a string contains only numeric characters.
 *
 * @param text - The text to check.
 * @returns True if the text is numeric.
 */
export function isNumeric(text: string): boolean {
  return /^\d+$/.test(text);
}

/**
 * Checks if a string contains only alphanumeric characters.
 *
 * @param text - The text to check.
 * @returns True if the text is alphanumeric.
 */
export function isAlphanumeric(text: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(text);
}

/**
 * Checks if a string has at least a minimum length.
 *
 * @param text - The text to check.
 * @param min - The minimum length.
 * @returns True if the text length is at least min.
 */
export function minLength(text: string, min: number): boolean {
  return text.length >= min;
}

/**
 * Checks if a string has at most a maximum length.
 *
 * @param text - The text to check.
 * @param max - The maximum length.
 * @returns True if the text length is at most max.
 */
export function maxLength(text: string, max: number): boolean {
  return text.length <= max;
}

/**
 * Checks if a number is within a range (inclusive).
 *
 * @param num - The number to check.
 * @param min - The minimum value.
 * @param max - The maximum value.
 * @returns True if the number is within the range.
 */
export function inRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/**
 * Checks if an object has all required properties defined.
 *
 * @param obj - The object to check.
 * @param props - Array of required property keys.
 * @returns True if all properties exist and are not undefined.
 */
export function hasRequiredProps<T extends object>(obj: T, props: (keyof T)[]): boolean {
  return props.every(prop => prop in obj && obj[prop] !== undefined);
}

/**
 * Checks if a string is a valid date in YYYY-MM-DD format.
 *
 * @param date - The date string to validate.
 * @returns True if the date is valid.
 */
export function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Checks if a string is a valid time in HH:MM format (24-hour).
 *
 * @param time - The time string to validate.
 * @returns True if the time is valid.
 */
export function isValidTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * Sanitizes input by removing potentially dangerous characters.
 *
 * @param input - The input string.
 * @returns The sanitized string.
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, '').replace(/['"]/g, '').trim();
}

/**
 * Checks if an array is non-empty.
 *
 * @param arr - The array to check.
 * @returns True if the array exists and has elements.
 */
export function isNonEmptyArray<T>(arr: T[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Checks if a value is one of the allowed options.
 *
 * @param value - The value to check.
 * @param options - Array of allowed values.
 * @returns True if the value is in the options array.
 */
export function isOneOf<T>(value: T, options: T[]): boolean {
  return options.includes(value);
}

/**
 * Checks if a string contains only alphabetic characters.
 *
 * @param text - The text to check.
 * @returns True if the text is alphabetic.
 */
export function isAlpha(text: string): boolean {
  return /^[a-zA-Z]+$/.test(text);
}

/**
 * Checks if a string is a valid hex color code.
 *
 * @param hex - The hex string to validate.
 * @returns True if the hex is valid (6 characters, optional # prefix).
 */
export function isValidHex(hex: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Checks if a value is an integer.
 *
 * @param value - The number to check.
 * @returns True if the value is an integer.
 */
export function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

/**
 * Checks if a number is positive.
 *
 * @param value - The number to check.
 * @returns True if the value is greater than 0.
 */
export function isPositive(value: number): boolean {
  return value > 0;
}

/**
 * Checks if a string contains special characters (non-alphanumeric, non-space).
 *
 * @param text - The text to check.
 * @returns True if the text contains special characters.
 */
export function hasSpecialChars(text: string): boolean {
  return /[^a-zA-Z0-9\s]/.test(text);
}

/**
 * Checks if a string is a valid username (alphanumeric, underscore, hyphen, 3-20 chars).
 *
 * @param username - The username to validate.
 * @returns True if the username is valid.
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

/**
 * Checks if a value is a plain object (not array, not null).
 *
 * @param value - The value to check.
 * @returns True if the value is a plain object.
 */
export function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if a string is valid JSON.
 *
 * @param str - The string to check.
 * @returns True if the string is valid JSON.
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a password meets strength requirements (8+ chars, uppercase, lowercase, digit).
 *
 * @param password - The password to validate.
 * @returns True if the password is strong.
 */
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  );
}

/**
 * Checks if text contains any profanity from a list of bad words.
 *
 * @param text - The text to check.
 * @param badWords - Array of profane words.
 * @returns True if profanity is detected.
 */
export function containsProfanity(text: string, badWords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return badWords.some(word => lowerText.includes(word.toLowerCase()));
}

/**
 * Checks if a URL is a WhatsApp group invite link.
 *
 * @param url - The URL to check.
 * @returns True if the URL is a WhatsApp group link.
 */
export function isWhatsAppLink(url: string): boolean {
  return /chat\.whatsapp\.com\//.test(url);
}

/**
 * Checks if a URL belongs to a specific domain.
 *
 * @param url - The URL to check.
 * @param domain - The domain to match.
 * @returns True if the URL hostname includes the domain.
 */
export function isDomainLink(url: string, domain: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes(domain);
  } catch {
    return false;
  }
}

export interface BetValidationResult {
  valid: boolean;
  error?: string;
}

export interface TransferValidationResult {
  valid: boolean;
  error?: string;
}

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
 * Validates a bet amount against user balance and configuration.
 *
 * @param amount - The bet amount.
 * @param userBalance - The user's current balance.
 * @param config - Optional validation configuration.
 * @param isVip - Whether the user is VIP.
 * @returns Validation result with validity and optional error message.
 */
export function validateBetAmount(
  amount: number,
  userBalance: number,
  config: ValidationConfig = DEFAULT_CONFIG,
  isVip: boolean = false,
): BetValidationResult {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  const minBet = config.minBet ?? DEFAULT_CONFIG.minBet;
  const maxBet = isVip
    ? (config.vipMaxBet ?? DEFAULT_CONFIG.vipMaxBet)
    : (config.maxBet ?? DEFAULT_CONFIG.maxBet);

  if (amount < minBet) {
    return { valid: false, error: `Minimum bet: $${minBet}` };
  }

  if (amount > maxBet) {
    return { valid: false, error: `Maximum bet: $${maxBet}` };
  }

  if (amount > userBalance) {
    return {
      valid: false,
      error: `Insufficient balance. Balance: $${userBalance.toLocaleString()}`,
    };
  }

  return { valid: true };
}

/**
 * Validates a transfer amount against sender balance and configuration.
 *
 * @param amount - The transfer amount.
 * @param senderBalance - The sender's current balance.
 * @param recipientJid - The recipient's JID.
 * @param senderJid - The sender's JID.
 * @param config - Optional validation configuration.
 * @returns Validation result with validity and optional error message.
 */
export function validateTransferAmount(
  amount: number,
  senderBalance: number,
  recipientJid: string,
  senderJid: string,
  config: ValidationConfig = DEFAULT_CONFIG,
): TransferValidationResult {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  const isOwner = config.isOwner ?? false;
  const minTransfer = config.minTransfer ?? DEFAULT_CONFIG.minTransfer;
  const maxTransfer = config.maxTransfer ?? DEFAULT_CONFIG.maxTransfer;

  if (!isOwner && amount < minTransfer) {
    return { valid: false, error: `Minimum transfer: $${minTransfer}` };
  }

  if (!isOwner && amount > maxTransfer) {
    return { valid: false, error: `Maximum transfer: $${maxTransfer}` };
  }

  if (senderJid === recipientJid || recipientJid.includes(senderJid.split('@')[0])) {
    return { valid: false, error: 'Cannot transfer to yourself' };
  }

  if (!isOwner && amount > senderBalance) {
    return {
      valid: false,
      error: `Insufficient balance. Balance: $${senderBalance.toLocaleString()}`,
    };
  }

  return { valid: true };
}

/**
 * Validates work cooldown.
 *
 * @param lastWork - The timestamp of last work (milliseconds).
 * @param cooldownMs - The cooldown period in milliseconds (default: 1 hour).
 * @returns Validation result with allowed status and remaining time.
 */
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

/**
 * Validates daily cooldown.
 *
 * @param lastDaily - The timestamp of last daily claim (milliseconds).
 * @returns Validation result with allowed status and remaining time.
 */
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

/**
 * Validates weekly cooldown.
 *
 * @param lastWeekly - The timestamp of last weekly claim (milliseconds).
 * @returns Validation result with allowed status and remaining time.
 */
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

/**
 * Sanitizes text input by removing dangerous characters and limiting length.
 *
 * @param input - The input text.
 * @param maxLength - Maximum allowed length (default: 500).
 * @returns The sanitized text.
 */
export function sanitizeTextInput(input: string, maxLength: number = 500): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates if a JID is a valid mention target (user or group).
 *
 * @param jid - The JID to validate.
 * @returns True if the JID is a valid user or group JID.
 */
export function validateMention(jid: string): boolean {
  return isUserJid(jid) || isGroupJid(jid);
}