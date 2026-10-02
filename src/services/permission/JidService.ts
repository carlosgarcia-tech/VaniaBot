import type { WASocket } from 'baileys';

/**
 * Normalizes a JID by removing the device suffix from the user part.
 *
 * @param jid - The JID to normalize.
 * @returns The normalized JID.
 */
export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  const [user, server] = jid.split('@');
  const phone = user.split(':')[0];
  return `${phone}@${server}`;
}

/**
 * Gets the bot's normalized JID from the socket.
 *
 * @param sock - The WhatsApp socket.
 * @returns The bot's normalized JID.
 */
export function getBotJid(sock: WASocket): string {
  return normalizeJid(sock.user?.id ?? '');
}

/**
 * Gets the bot's LID (Linked Device ID) from the socket.
 *
 * @param sock - The WhatsApp socket.
 * @returns The bot's LID, or null if not available.
 */
export function getBotLid(sock: WASocket): string | null {
  const lid = (sock.user as { lid?: string } | undefined)?.lid;
  if (!lid) return null;
  return normalizeJid(lid);
}

/**
 * Gets the bot's phone number from the socket.
 *
 * @param sock - The WhatsApp socket.
 * @returns The bot's phone number.
 */
export function getBotPhone(sock: WASocket): string {
  return (sock.user?.id ?? '').split(':')[0].split('@')[0];
}

/**
 * Checks if a JID is a Linked Device ID.
 *
 * @param jid - The JID to check.
 * @returns True if the JID ends with '@lid'.
 */
export function isLidJid(jid: string): boolean {
  return jid.endsWith('@lid');
}

/**
 * Extracts the phone number from a JID.
 *
 * @param jid - The JID to extract from.
 * @returns The phone number.
 */
export function extractPhone(jid: string): string {
  return jid.split('@')[0].split(':')[0];
}