/**
 * TTSService.ts
 *
 * OrbitBot services module exposing `TTSService`, `ttsService`.
 *
 * Microsoft Edge neural TTS via `msedge-tts` — no API key, good Spanish
 * voices. It is an unofficial service and could change without notice.
 *
 * Two hard requirements learned in production (limited uplink):
 *  - WhatsApp only plays voice notes (ptt) as OGG/Opus; mp3 ptt is silently
 *    dropped by the server, so the mp3 is transcoded with ffmpeg.
 *  - The stream needs a hard timeout, otherwise a stalled connection leaves
 *    the command hanging forever without replying.
 *
 * @author **Carlos G**
 */

import { spawn } from 'child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE = 'es-MX-DaliaNeural';
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
const SYNTH_TIMEOUT_MS = 60000;

/** Transcodes an mp3 Buffer to an OGG/Opus Buffer (WhatsApp voice note). */
export function mp3ToOggOpus(mp3: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      // Pipe input has no seekable header: declare the format or ffmpeg hangs.
      '-f',
      'mp3',
      '-i',
      'pipe:0',
      '-c:a',
      'libopus',
      '-b:a',
      '48k',
      '-application',
      'voip',
      '-f',
      'ogg',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    const errors: string[] = [];
    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code: number) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg opus failed (${code}): ${errors.join('')}`));
      }
    });
    ffmpeg.stdin.end(mp3);
  });
}

export class TTSService {
  /** Neural TTS; returns an OGG/Opus Buffer ready to send as a voice note. */
  async synthesize(text: string): Promise<Buffer> {
    const mp3 = await this.synthesizeMp3(text);
    return await mp3ToOggOpus(mp3);
  }

  private async synthesizeMp3(text: string): Promise<Buffer> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, FORMAT);
    const { audioStream } = tts.toStream(text);

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        audioStream.destroy();
        reject(new Error(`TTS timeout tras ${SYNTH_TIMEOUT_MS}ms`));
      }, SYNTH_TIMEOUT_MS);

      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      audioStream.on('end', () => {
        clearTimeout(timer);
        const audio = Buffer.concat(chunks);
        if (audio.length === 0) reject(new Error('Empty TTS audio'));
        else resolve(audio);
      });
    });
  }
}

export const ttsService = new TTSService();
