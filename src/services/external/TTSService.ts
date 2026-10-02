/**
 * TTSService.ts
 *
 * VaniaBot services module exposing `TTSService`, `ttsService`.
 *
 * @author **Carlos G**
 */

const TIMEOUT_MS = 30000;

export class TTSService {
  async textToSpeech(text: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const encodedText = encodeURIComponent(text);
      const url = `https://www.laurine.site/api/tts/tts-nova?text=${encodedText}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: '*/*',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`TTS_ERROR:${response.status}`);
      }

      const rawData = await response.json();
      const data = rawData as Record<string, unknown>;

      const urlData = rawData as string;
      if (
        typeof urlData === 'string' &&
        (urlData.startsWith('http://') || urlData.startsWith('https://'))
      ) {
        return urlData;
      }

      if (data.data) {
        const d = data.data as Record<string, unknown>;
        if (d.URL) return d.URL as string;
        if (d.url) return d.url as string;
        if (d.MP3) return `https://ttsmp3.com/created_mp3_ai/${d.MP3}`;
        if (d.mp3) return `https://ttsmp3.com/created_mp3_ai/${d.mp3}`;
      }

      if (data.URL) return data.URL as string;
      if (data.url) return data.url as string;
      if (data.MP3) return `https://ttsmp3.com/created_mp3_ai/${data.MP3}`;
      if (data.mp3) return `https://ttsmp3.com/created_mp3_ai/${data.mp3}`;

      throw new Error('Invalid TTS response structure');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async downloadAudio(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'audio/mpeg',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`DOWNLOAD_ERROR:${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const ttsService = new TTSService();
