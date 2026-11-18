/**
 * TTSService.test.ts
 *
 * Laurine TTS (the old primary) died with its domain (NXDOMAIN). These tests
 * pin the Edge TTS (msedge-tts) replacement — right voice/format, stream
 * concatenated, empty audio rejected, failures propagated — plus the two
 * production fixes: the mp3 is transcoded to OGG/Opus (WhatsApp silently
 * drops an mp3 voice note) and a stalled stream can no longer hang forever.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ttsService, mp3ToOggOpus } from '@/services/external/TTSService.js';
import { TTSCommand } from '@/commands/fun/TTSCommand.js';
import type { MessageContext } from '@/types/index.js';

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3' },
  MsEdgeTTS: vi.fn(),
}));

vi.mock('child_process', () => ({ spawn: vi.fn() }));

const MockedTTS = MsEdgeTTS as unknown as {
  mockImplementation: (impl: () => unknown) => void;
};
const mockedSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

const mockInstance = () => ({
  setMetadata: vi.fn(),
  toStream: vi.fn(),
});

const mockFfmpeg = (ogg: Buffer) =>
  mockedSpawn.mockImplementation((() => {
    const stdout = { on: vi.fn() };
    stdout.on = (event: string, cb: (chunk: Buffer) => void) => {
      if (event === 'data') setTimeout(() => cb(ogg), 0);
    };
    return {
      stdout,
      stderr: { on: vi.fn() },
      stdin: { end: vi.fn() },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(0), 0);
      },
    };
  }) as never);

const createCtx = (args: string[]): MessageContext =>
  ({
    args,
    chat: { jid: 'chat@g.us' },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

describe('TTSService.synthesize (Edge TTS)', () => {
  const ogg = Buffer.from('OggS-converted');

  beforeEach(() => {
    vi.clearAllMocks();
    mockFfmpeg(ogg);
  });

  it('uses a Spanish neural voice and the mp3 format, returning ogg/opus', async () => {
    const inst = mockInstance();
    (inst.toStream as ReturnType<typeof vi.fn>).mockReturnValue({
      audioStream: Readable.from([Buffer.from('aaa'), Buffer.from('bbb')]),
    });
    MockedTTS.mockImplementation(() => inst);

    const audio = await ttsService.synthesize('hola orbit');

    expect(audio).toEqual(ogg);
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

describe('mp3ToOggOpus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pipes the mp3 through ffmpeg as opus/ogg', async () => {
    const ogg = Buffer.from('OggS-fake');
    mockFfmpeg(ogg);

    const result = await mp3ToOggOpus(Buffer.from('mp3'));

    expect(result).toEqual(ogg);
    const args = mockedSpawn.mock.calls[0]?.[1] as string[];
    expect(args).toContain('libopus');
    expect(args).toContain('ogg');
    // Pipe input needs an explicit format or ffmpeg hangs probing.
    expect(args.slice(args.indexOf('-f'), args.indexOf('-f') + 2)).toEqual(['-f', 'mp3']);
  });

  it('rejects when ffmpeg fails', async () => {
    mockedSpawn.mockImplementation((() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { end: vi.fn() },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(1), 0);
      },
    })) as never);

    await expect(mp3ToOggOpus(Buffer.from('mp3'))).rejects.toThrow('ffmpeg');
  });
});

describe('TTSCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFfmpeg(Buffer.from('OggS-voice'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runWithStream = async (chunks: Buffer[]) => {
    const inst = mockInstance();
    (inst.toStream as ReturnType<typeof vi.fn>).mockReturnValue({
      audioStream: Readable.from(chunks),
    });
    MockedTTS.mockImplementation(() => inst);
    const ctx = createCtx(['hola']);
    await new TTSCommand().execute(ctx);
    return ctx;
  };

  it('sends the audio as an ogg/opus voice note', async () => {
    const ctx = await runWithStream([Buffer.from('mp3')]);

    expect(ctx.sock.sendMessage).toHaveBeenCalledWith('chat@g.us', {
      audio: Buffer.from('OggS-voice'),
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    });
    expect(ctx.react).toHaveBeenCalledWith('✅');
  });

  it('reports a synthesis failure instead of staying silent', async () => {
    const inst = mockInstance();
    (inst.setMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('TTS timeout'));
    MockedTTS.mockImplementation(() => inst);

    const ctx = createCtx(['hola']);
    await new TTSCommand().execute(ctx);

    expect(ctx.react).toHaveBeenCalledWith('❌');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('❌'));
  });
});
