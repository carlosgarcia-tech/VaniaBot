/**
 * TTSService.ts
 *
 * OrbitBot services module exposing `TTSService`, `ttsService`.
 *
 * Primary: Microsoft Edge neural TTS via `msedge-tts` — no API key, good
 * Spanish voices. It is an unofficial service and could change without
 * notice; if it dies, add a fallback chain (ttsmp3 → local) here.
 *
 * The previous primary, laurine.site, is dead (domain expired, NXDOMAIN).
 *
 * @author **Carlos G**
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE = 'es-MX-DaliaNeural';
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

export class TTSService {
  /** Neural text-to-speech; returns an mp3 Buffer ready to send as voice note. */
  async synthesize(text: string): Promise<Buffer> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, FORMAT);
    const { audioStream } = tts.toStream(text);

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('error', reject);
      audioStream.on('end', () => {
        const audio = Buffer.concat(chunks);
        if (audio.length === 0) reject(new Error('Empty TTS audio'));
        else resolve(audio);
      });
    });
  }
}

export const ttsService = new TTSService();
