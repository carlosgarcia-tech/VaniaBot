/**
 * PoesiaService.ts
 *
 * VaniaBot services module exposing `PoesiaService`, `TIPO_EMOJI`, `TIPO_LABEL`, `poesiaService`.
 *
 * @author **Carlos G**
 */

import { randomUUID } from 'crypto';
import { aiService } from '@/services/external/AIService.js';
import { isRight, left, right } from '@/utils/either.js';
import { buildPrompt, MAX_TOKENS } from './PoesiaPrompts.js';
import {
  ContenidoTipo,
  type ContenidoEntry,
  type GenerarOpts,
  type GenerarResult,
  type VotoResult,
  type TopEntry,
} from './PoesiaTypes.js';

interface CacheSlot {
  entry: ContenidoEntry;
  expiresAt: number;
}

const CACHE_TTL = 10 * 60 * 1000;

const USER_COOLDOWN = 30 * 1000;

const MAX_ENTRIES_PER_GROUP = 100;

function shortId(): string {
  return randomUUID().split('-')[0].toUpperCase();
}

export const TIPO_EMOJI: Record<ContenidoTipo, string> = {
  [ContenidoTipo.POEMA]: '🌹',
  [ContenidoTipo.FRASE]: '✨',
  [ContenidoTipo.PIROPO]: '😏',
  [ContenidoTipo.DEDICATORIA]: '💌',
  [ContenidoTipo.HAIKU]: '🍃',
  [ContenidoTipo.SONETO]: '📜',
  [ContenidoTipo.COPLA]: '🎶',
  [ContenidoTipo.ACROSTICO]: '🔤',
  [ContenidoTipo.CARTA]: '💌',
  [ContenidoTipo.HISTORIA]: '📖',
};

export const TIPO_LABEL: Record<ContenidoTipo, string> = {
  [ContenidoTipo.POEMA]: 'Poema',
  [ContenidoTipo.FRASE]: 'Frases',
  [ContenidoTipo.PIROPO]: 'Piropos',
  [ContenidoTipo.DEDICATORIA]: 'Dedicatoria',
  [ContenidoTipo.HAIKU]: 'Haiku',
  [ContenidoTipo.SONETO]: 'Soneto',
  [ContenidoTipo.COPLA]: 'Coplas',
  [ContenidoTipo.ACROSTICO]: 'Acróstico',
  [ContenidoTipo.CARTA]: 'Carta de amor',
  [ContenidoTipo.HISTORIA]: 'Historia',
};

export class PoesiaService {
  private cache = new Map<string, CacheSlot>();

  private cooldowns = new Map<string, number>();

  private entries = new Map<string, ContenidoEntry[]>();

  async generar(
    opts: GenerarOpts,
    autorJid: string,
    autorName: string,
    groupId: string,
  ): Promise<GenerarResult> {
    const lastGen = this.cooldowns.get(autorJid) ?? 0;
    const remaining = USER_COOLDOWN - (Date.now() - lastGen);
    if (remaining > 0) {
      return left({
        message: `Espera ${Math.ceil(remaining / 1000)}s antes de pedir otro contenido.`,
      });
    }

    const cacheKey = `${opts.tipo}::${opts.tema ?? ''}::${opts.estilo ?? ''}::${opts.dedicado ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt && !opts.dedicado && !opts.contexto) {
      const cloned: ContenidoEntry = {
        ...cached.entry,
        id: shortId(),
        autor: autorJid,
        autorName,
        groupId,
        votes: 0,
        voters: [],
        createdAt: Date.now(),
      };
      this._saveEntry(groupId, cloned);
      this.cooldowns.set(autorJid, Date.now());
      return right({ entry: cloned, cached: true });
    }

    const prompt = buildPrompt(opts);
    const maxTok = MAX_TOKENS[opts.tipo] ?? 600;
    const response = await aiService.generate(prompt, maxTok);

    if (!isRight(response)) {
      return left({
        message: response.left.message ?? 'No pude generar el contenido. Intenta de nuevo.',
      });
    }

    const entry: ContenidoEntry = {
      id: shortId(),
      tipo: opts.tipo,
      estilo: opts.estilo,
      tema: opts.tema,
      dedicado: opts.dedicado,
      contenido: response.right.trim(),
      autor: autorJid,
      autorName,
      groupId,
      votes: 0,
      voters: [],
      createdAt: Date.now(),
    };
    if (!opts.dedicado && !opts.contexto) {
      this.cache.set(cacheKey, { entry, expiresAt: Date.now() + CACHE_TTL });
    }

    this._saveEntry(groupId, entry);
    this.cooldowns.set(autorJid, Date.now());

    return right({ entry, cached: false });
  }

  votar(groupId: string, voterJid: string, entryId?: string): VotoResult {
    const entries = this.entries.get(groupId) ?? [];

    const entry = entryId
      ? entries.find(e => e.id === entryId)
      : [...entries].reverse().find(e => e.autor !== voterJid);

    if (!entry) {
      return {
        success: false,
        error: 'No encontré qué votar. Usa *!votar [ID]* o vota después de un contenido.',
      };
    }

    if (entry.voters.includes(voterJid)) {
      return {
        success: false,
        alreadyVoted: true,
        error: 'Ya votaste por este contenido.',
      };
    }

    if (entry.autor === voterJid) {
      return {
        success: false,
        error: 'No puedes votar tu propio contenido 😅',
      };
    }

    entry.votes++;
    entry.voters.push(voterJid);

    return { success: true, newVotes: entry.votes };
  }

  getTop(groupId: string, limit = 5, tipo?: ContenidoTipo): TopEntry[] {
    const entries = this.entries.get(groupId) ?? [];

    const filtered = tipo ? entries.filter(e => e.tipo === tipo) : entries;

    return filtered
      .filter(e => e.votes > 0)
      .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((entry, i) => ({ entry, rank: i + 1 }));
  }

  getLastEntry(groupId: string): ContenidoEntry | null {
    const entries = this.entries.get(groupId) ?? [];
    return entries[entries.length - 1] ?? null;
  }

  getById(groupId: string, id: string): ContenidoEntry | null {
    return (this.entries.get(groupId) ?? []).find(e => e.id === id) ?? null;
  }

  getUserStats(
    groupId: string,
    jid: string,
  ): {
    total: number;
    totalVotes: number;
    byTipo: Partial<Record<ContenidoTipo, number>>;
    topEntry?: ContenidoEntry;
  } {
    const entries = (this.entries.get(groupId) ?? []).filter(e => e.autor === jid);
    const totalVotes = entries.reduce((s, e) => s + e.votes, 0);
    const byTipo: Partial<Record<ContenidoTipo, number>> = {};
    for (const e of entries) {
      byTipo[e.tipo] = (byTipo[e.tipo] ?? 0) + 1;
    }
    const topEntry = entries.sort((a, b) => b.votes - a.votes)[0];
    return { total: entries.length, totalVotes, byTipo, topEntry };
  }

  formatEntry(entry: ContenidoEntry, showMeta = true, footer?: string): string {
    const emoji = TIPO_EMOJI[entry.tipo];
    const label = TIPO_LABEL[entry.tipo];
    const defaultFooter = footer || '> _VaniaBot💝 — Poesía & Amor_';

    let cleanContent = entry.contenido;
    cleanContent = cleanContent.replace(/>\s*VaniaBot[💝]*\s*[-–—]?\s*Poes[ií]a.*$/gim, '').trim();
    cleanContent = cleanContent.replace(/>\s*VaniaBot[💝]*\s*$/gim, '').trim();

    let msg = '';

    if (showMeta) {
      msg += `${emoji} *${label}*`;
      if (entry.tema) msg += ` — _${entry.tema}_`;
      if (entry.estilo) msg += ` _(${entry.estilo})_`;
      msg += '\n';
      if (entry.dedicado) msg += `💝 _Para: ${entry.dedicado}_\n`;
      msg += `━━━━━━━━━━━━━\n\n`;
    }

    msg += cleanContent;

    if (showMeta) {
      msg += `\n\n━━━━━━━━━━━━━\n`;
      msg += `🆔 ID: \`${entry.id}\` | 👤 Por: ${entry.autorName}\n`;
      msg += `❤️ Vota con *!votar* o *!votar ${entry.id}*\n`;
      msg += `\n${defaultFooter}`;
    }

    return msg;
  }

  formatTop(entries: TopEntry[], tipo?: ContenidoTipo, footer?: string): string {
    if (entries.length === 0) {
      return tipo
        ? `No hay ${TIPO_LABEL[tipo]?.toLowerCase() ?? 'contenido'} votado aún en este grupo.`
        : 'Nadie ha votado contenido aún. Usa *!votar* después de pedir un poema. 🌹';
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const titulo = tipo ? `${TIPO_EMOJI[tipo]} Top ${TIPO_LABEL[tipo]}` : '🏆 Top Poesía del Grupo';
    const defaultFooter = footer || '> _VaniaBot💝 — Poesía & Amor_';

    let msg = `${titulo}\n━━━━━━━━━━━━\n\n`;

    for (const { entry, rank } of entries) {
      const medal = medals[rank - 1] ?? `${rank}.`;
      const preview = entry.contenido.split('\n')[0].slice(0, 50) + '...';
      msg += `${medal} *${entry.autorName}* — ❤️ ${entry.votes} votos\n`;
      msg += `   _"${preview}"_\n`;
      msg += `   🆔 ${entry.id} | ${TIPO_EMOJI[entry.tipo]} ${TIPO_LABEL[entry.tipo]}\n\n`;
    }

    msg += defaultFooter;
    return msg;
  }

  private _saveEntry(groupId: string, entry: ContenidoEntry): void {
    if (!this.entries.has(groupId)) this.entries.set(groupId, []);
    const list = this.entries.get(groupId);
    if (list) {
      list.push(entry);
      if (list.length > MAX_ENTRIES_PER_GROUP) {
        list.splice(0, list.length - MAX_ENTRIES_PER_GROUP);
      }
    }
  }

  /** Limpieza del caché expirado (llamar periódicamente) */
  cleanCache(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now > v.expiresAt) this.cache.delete(k);
    }
    for (const [k, v] of this.cooldowns.entries()) {
      if (now - v > USER_COOLDOWN * 2) this.cooldowns.delete(k);
    }
  }
}

export const poesiaService = new PoesiaService();
