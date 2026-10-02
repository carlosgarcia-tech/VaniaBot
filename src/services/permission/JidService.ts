import type { WASocket } from 'baileys';

export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  const [user, server] = jid.split('@');
  const phone = user.split(':')[0];
  return `${phone}@${server}`;
}

export function getBotJid(sock: WASocket): string {
  return normalizeJid(sock.user?.id ?? '');
}

export function getBotLid(sock: WASocket): string | null {
  const lid = (sock.user as { lid?: string } | undefined)?.lid;
  if (!lid) return null;
  return normalizeJid(lid);
}

export function getBotPhone(sock: WASocket): string {
  return (sock.user?.id ?? '').split(':')[0].split('@')[0];
}

export function isLidJid(jid: string): boolean {
  return jid.endsWith('@lid');
}

export function extractPhone(jid: string): string {
  return jid.split('@')[0].split(':')[0];
}
