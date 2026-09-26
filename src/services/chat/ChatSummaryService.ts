import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

const FILE = path.join(process.cwd(), 'database', 'resumirchat-buffer.json');

const chatSummaryStore = new JsonFileStore<ChatSummaryStore>({
  filePath: FILE,
  defaults: () => ({ trackedSince: new Date().toISOString(), groups: {} }),
});

export interface ChatMessage {
  sender: string;
  text: string;
  at: string;
}

export interface ChatSummaryStore {
  trackedSince: string;
  groups: Record<string, ChatMessage[]>;
}

const MAX_BUFFER_PER_GROUP = 260;
const DEFAULT_LIMIT = 40;

const STOPWORDS = new Set([
  'de',
  'la',
  'el',
  'los',
  'las',
  'y',
  'o',
  'u',
  'en',
  'por',
  'para',
  'con',
  'sin',
  'que',
  'se',
  'es',
  'un',
  'una',
  'unos',
  'unas',
  'lo',
  'al',
  'del',
  'a',
  'e',
  'i',
  'no',
  'si',
  'ya',
  'yo',
  'tu',
  'te',
  'mi',
  'me',
  'su',
  'sus',
  'le',
  'les',
  'como',
  'cuando',
  'donde',
  'porque',
  'pero',
  'mas',
  'muy',
  'the',
  'and',
  'for',
  'with',
  'you',
  'your',
  'this',
  'that',
  'from',
  'have',
  'has',
  'was',
  'were',
  'are',
  'they',
  'them',
  'just',
  'about',
  'hola',
  'jaja',
]);

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TopKeyword {
  0: string;
  1: number;
}

export interface TopParticipant {
  0: string;
  1: number;
}

export interface ChatSummary {
  count: number;
  range: string;
  participants: TopParticipant[];
  keywords: TopKeyword[];
  highlights: string[];
}

export class ChatSummaryService {
  private store: ChatSummaryStore;
  /**
   * Pending flush handle for the debounced persist. Non-null while a
   * setTimeout is scheduled and not yet fired.
   */
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.store = chatSummaryStore.load();
  }

  private getGroupMessages(groupId: string): ChatMessage[] {
    const key = cleanText(groupId);
    if (!this.store.groups[key]) {
      this.store.groups[key] = [];
    }
    if (!Array.isArray(this.store.groups[key])) {
      this.store.groups[key] = [];
    }
    return this.store.groups[key];
  }

  addMessage(groupId: string, sender: string, text: string): void {
    const messages = this.getGroupMessages(groupId);
    messages.push({
      sender: cleanText(sender),
      text: cleanText(text),
      at: new Date().toISOString(),
    });
    if (messages.length > MAX_BUFFER_PER_GROUP) {
      messages.splice(0, messages.length - MAX_BUFFER_PER_GROUP);
    }
    this.scheduleSave();
  }

  /**
   * Debounced persist: coalesces bursts of messages into one disk write per
   * second. Replaces the previous per-message synchronous write, which
   * serialized the hot message path on every group chat.
   */
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        chatSummaryStore.save(this.store);
      } catch {
        // Never let persistence break message processing.
      }
    }, 1000);
  }

  private save(): void {
    chatSummaryStore.save(this.store);
  }

  getTopKeywords(messages: ChatMessage[], limit = 6): TopKeyword[] {
    const freq = new Map<string, number>();

    for (const row of messages) {
      const words = cleanText(row.text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

      for (const word of words) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
    }

    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit) as TopKeyword[];
  }

  getTopParticipants(messages: ChatMessage[], limit = 4): TopParticipant[] {
    const freq = new Map<string, number>();

    for (const row of messages) {
      const sender = cleanText(row.sender) || 'Desconocido';
      freq.set(sender, (freq.get(sender) || 0) + 1);
    }

    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit) as TopParticipant[];
  }

  getSummary(groupId: string, limit = DEFAULT_LIMIT): ChatSummary | null {
    const messages = this.getGroupMessages(groupId);
    const selected = messages.slice(-limit);

    if (selected.length === 0) return null;

    const first = selected[0];
    const last = selected[selected.length - 1];

    const formatTime = (iso: string): string => {
      try {
        return new Date(iso).toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        return '--:--';
      }
    };

    const highlights = selected.slice(-6).map(row => {
      const text = cleanText(row.text);
      return `${row.sender}: ${text.length > 80 ? `${text.slice(0, 77)}...` : text}`;
    });

    return {
      count: selected.length,
      range: `${formatTime(first.at)} - ${formatTime(last.at)}`,
      participants: this.getTopParticipants(selected),
      keywords: this.getTopKeywords(selected),
      highlights,
    };
  }

  clearGroup(groupId: string): void {
    const key = cleanText(groupId);
    delete this.store.groups[key];
    this.save();
  }

  /** Flushes any pending debounced write (used by tests and graceful stop). */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    chatSummaryStore.save(this.store);
  }
}

export const chatSummaryService = new ChatSummaryService();
