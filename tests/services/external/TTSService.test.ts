/**
 * TTSService.test.ts
 *
 * Laurine TTS (the old primary) died with its domain (NXDOMAIN). These tests
 * pin the Edge TTS (msedge-tts) replacement: right voice/format, stream
 * concatenated into an mp3 Buffer, empty audio rejected.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Readable } from 'stream';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ttsService } from '@/services/external/TTSService.js';

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3' },
  MsEdgeTTS: vi.fn(),
}));

const MockedTTS = MsEdgeTTS as unknown as {
  mockImplementation: (impl: () => unknown) => void;
};

const mockInstance = () => {
  const inst = {
    setMetadata: vi.fn(),
    toStream: vi.fn(),
  };
  return inst;
};

describe('TTSService.synthesize (Edge TTS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a Spanish neural voice and the mp3 format, and returns the audio', async () => {
    const inst = mockInstance();
    (inst.toStream as ReturnType<typeof vi.fn>).mockReturnValue({
      audioStream: Readable.from([Buffer.from('aaa'), Buffer.from('bbb')]),
    });
    MockedTTS.mockImplementation(() => inst);

    const audio = await ttsService.synthesize('hola orbit');

    expect(audio).toEqual(Buffer.from('aaabbb'));
    expect(inst.setMetadata).toHaveBeenCalledWith(
      'es-MX-DaliaNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
    );
    expect(inst.toStream).toHaveBeenCalledWith('hola orbit');
  });

  it('rejects when the stream yields nothing', async () => {
    const inst = mockInstance();
    (inst.toStream as ReturnType<typeof vi.fn>).mockReturnValue({
      audioStream: Readable.from([]),
    });
    MockedTTS.mockImplementation(() => inst);

    await expect(ttsService.synthesize('nada')).rejects.toThrow('Empty');
  });

  it('propagates connection failures to the caller', async () => {
    const inst = mockInstance();
    (inst.setMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('403'));
    MockedTTS.mockImplementation(() => inst);

    await expect(ttsService.synthesize('hola')).rejects.toThrow('403');
  });
});
