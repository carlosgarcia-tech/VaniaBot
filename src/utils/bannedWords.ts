/**
 * bannedWords.ts
 * Filter for blocked terms. Normalization is used ONLY for detection;
 * the original user text is never modified.
 */

/** Base terms to block (already in folded form: lowercase, a-z only). */
const BANNED_TERMS = ['pio'];

/**
 * If true, also checks the text with ALL spaces removed ("p i o", "pi o", "p io").
 * Catches more evasions but can false-positive across words ("api otro").
 */
const CHECK_ACROSS_SPACES = true;

const ALLOWED_WORDS: string[] = [];

const HOMOGLYPHS: Record<string, string> = {
  р: 'p',
  ρ: 'p',
  ƿ: 'p',
  þ: 'p',
  і: 'i',
  ї: 'i',
  ı: 'i',
  ι: 'i',
  ɩ: 'i',
  ӏ: 'i',
  l: 'l',
  о: 'o',
  ο: 'o',
  ø: 'o',
  œ: 'o',
  ɔ: 'o',
  σ: 'o',
  ᴘ: 'p',
  ɪ: 'i',
  ᴏ: 'o',
};

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '¡': 'i',
  '¦': 'i',
};

function fold(raw: string): string {
  let s = raw
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\p{Cf}/gu, '')
    .toLowerCase();

  s = Array.from(s, ch => HOMOGLYPHS[ch] ?? LEET[ch] ?? ch).join('');

  s = s.replace(/[^\p{L}\p{N}\s]/gu, '');

  s = s.replace(/(.)\1+/gu, '$1');

  return s;
}

function stripAllowed(s: string): string {
  let out = s;
  for (const w of ALLOWED_WORDS) {
    out = out.split(fold(w)).join(' ');
  }
  return out;
}

function hasBannedTerm(raw: string): boolean {
  const folded = stripAllowed(fold(raw));
  const candidates: string[] = [folded];

  // Runs of single-char tokens: "p i o" → "pio"
  candidates.push(folded.replace(/\b(?:\p{L}\s+){1,}\p{L}\b/gu, m => m.replace(/\s+/g, '')));

  if (CHECK_ACROSS_SPACES) {
    candidates.push(folded.replace(/\s+/g, ''));
  }

  return candidates.some(c => BANNED_TERMS.some(term => c.includes(term)));
}

/**
 * Returns true if any of the given texts contains a banned term.
 * Pass pack and author separately AND the raw input, so splitting
 * across the `|` separator ("p|io") is also caught.
 */
export function containsBannedWord(...texts: string[]): boolean {
  const all = texts.filter(Boolean);
  if (all.length === 0) return false;
  return [...all, all.join('')].some(hasBannedTerm);
}
