declare module 'mumaker' {
  interface EphotoResult {
    image?: string;
    result?: string;
    [key: string]: unknown;
  }

  interface EphotoOptions {
    text?: string;
    text1?: string;
    text2?: string;
    [key: string]: string | number | undefined;
  }

  export function ephoto(url: string, text: string): Promise<EphotoResult>;
  export function logo(url: string, text: string): Promise<EphotoResult>;
  export function smaker(url: string, text: string): Promise<EphotoResult>;
}
