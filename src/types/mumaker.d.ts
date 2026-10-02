/**
 * mumaker.d.ts
 *
 * Ambient types for the `mumaker` meme generator.
 *
 * Result fields are loosely typed on purpose: the upstream package returns
 * inconsistent shapes (image vs. result) depending on the template, so callers
 * must check for the field they need.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

declare module 'mumaker' {
  interface EphotoResult {
    /** URL of the generated meme, when the provider returns one. */
    image?: string;
    /** Alternative field name used by some endpoints. */
    result?: string;
    [key: string]: unknown;
  }

  interface EphotoOptions {
    text?: string;
    text1?: string;
    text2?: string;
    [key: string]: string | number | undefined;
  }

  /** Default two-line meme layout. */
  export function ephoto(url: string, text: string): Promise<EphotoResult>;
  export function logo(url: string, text: string): Promise<EphotoResult>;
  export function smaker(url: string, text: string): Promise<EphotoResult>;
}
