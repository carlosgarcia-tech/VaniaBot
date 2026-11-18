/**
 * MailService.ts
 *
 * mail.tm client (verified alive 17-nov-2026) restoring the temporary-email
 * commands that died with Delirius (`!mailcreate`, `!mailmessages`).
 *
 * Accounts persist address→password in data/temp/mail-accounts.json so a
 * later `!mailmessages <email>` can log in again — mail.tm JWTs expire and
 * only the creator of the address knows the password.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { JsonFileStore } from '@/utils/JsonFileStore.js';

const BASE = 'https://api.mail.tm';
const TIMEOUT_MS = 15000;
const USER_AGENT = 'OrbitBot/7.4 (WhatsApp bot)';

interface MailAccount {
  address: string;
  password: string;
}

/** address → password (plaintext: only used to re-login this mail.tm). */
const accountsStore = new JsonFileStore<Record<string, string>>({
  filePath: './data/temp/mail-accounts.json',
  defaults: () => ({}),
});

async function mailFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`mail.tm error: ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class MailService {
  /** Creates a mail.tm account and persists its credentials. */
  async createAccount(): Promise<MailAccount> {
    const domains = await mailFetch(`${BASE}/domains`, { method: 'GET' }).then(r => r.json());
    // mail.tm devuelve hydra:member con Accept ld+json y array plano con JSON.
    const list = Array.isArray(domains)
      ? (domains as Array<{ domain?: string }>)
      : ((domains as { 'hydra:member'?: Array<{ domain?: string }> })['hydra:member'] ?? []);
    const domain = list[0]?.domain;
    if (!domain) {
      throw new Error('mail.tm: sin dominios disponibles');
    }

    const random = `orbitbot${Date.now()}${Math.floor(Math.random() * 100)}`;
    const password = `Orb!${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const address = `${random}@${domain}`;

    await mailFetch(`${BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    }).then(r => r.json());

    accountsStore.save({ ...accountsStore.load(), [address]: password });
    return { address, password };
  }

  /** Lists messages for a previously-created address (fresh JWT each time). */
  async listMessages(address: string): Promise<Array<{ id: string; intro?: string }>> {
    const password = accountsStore.load()[address];
    if (!password) {
      throw new Error(`Dirección '${address}' no encontrada (crea una con !mailcreate)`);
    }

    const tokenResponse = (await mailFetch(`${BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    }).then(r => r.json())) as { token?: string };
    if (!tokenResponse.token) {
      throw new Error('mail.tm: token inválido');
    }
    const token = tokenResponse.token;

    const data = await mailFetch(`${BASE}/messages?page=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    return ((data as { 'hydra:member'?: Array<{ id: string; intro?: string }> })['hydra:member'] ??
      []) as Array<{ id: string; intro?: string }>;
  }
}

export const mailService = new MailService();
