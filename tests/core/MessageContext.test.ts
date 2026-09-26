/**
 * MessageContext.test.ts
 *
 * Unit tests for the MessageContext class: text extraction,
 * command parsing with multi-prefix support, sender/chat getters,
 * and reply/react/sendMessage helpers.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/index.js', () => ({
  config: {
    prefix: '!',
  },
}));

vi.mock('@/services/PermissionService.js', () => ({
  PermissionService: {
    isOwner: vi.fn((jid: string) => jid === 'owner@test.com'),
    isOwnerAsync: vi.fn().mockResolvedValue(false),
    getUserPermissions: vi.fn().mockResolvedValue({ isAdmin: true, isOwner: false }),
    getBotPermissions: vi.fn().mockResolvedValue({ isAdmin: true }),
  },
  normalizeJid: vi.fn((jid: string) => jid),
}));

vi.mock('@/core/CacheManager.js', () => ({
  cacheManager: {
    getPermissions: vi.fn().mockReturnValue(null),
    setPermissions: vi.fn(),
  },
}));

vi.mock('@/utils/getContextInfo.js', () => ({
  getContextInfo: vi.fn().mockReturnValue({
    quotedMessage: { conversation: 'quoted text' },
    participant: 'quoted@test.com',
    stanzaId: 'stanza-123',
  }),
}));

import { MessageContext } from '../../src/core/MessageContext.js';
import type { WASocket, WAMessage } from 'baileys';

function createMockSock(): WASocket {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    groupMetadata: vi.fn(),
  } as unknown as WASocket;
}

function createMessage(text: string, overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    key: {
      id: 'msg-1',
      remoteJid: '123456789@s.whatsapp.net',
      fromMe: false,
      participant: 'user@test.com',
    },
    message: { conversation: text },
    pushName: 'Tester',
    ...overrides,
  } as unknown as WAMessage;
}

describe('MessageContext', () => {
  let sock: WASocket;

  beforeEach(() => {
    sock = createMockSock();
  });

  describe('text extraction', () => {
    it('extracts conversation text', () => {
      const ctx = new MessageContext(sock, createMessage('hola mundo'));
      expect(ctx.text).toBe('hola mundo');
    });

    it('extracts extendedTextMessage text', () => {
      const msg = createMessage('', {
        message: { extendedTextMessage: { text: 'respuesta con cita' } },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.text).toBe('respuesta con cita');
    });

    it('extracts image caption', () => {
      const msg = createMessage('', {
        message: { imageMessage: { caption: 'mira esto' } },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.text).toBe('mira esto');
    });

    it('extracts video caption', () => {
      const msg = createMessage('', {
        message: { videoMessage: { caption: 'video cap' } },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.text).toBe('video cap');
    });

    it('returns empty string for media without caption', () => {
      const msg = createMessage('', {
        message: { imageMessage: {} },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.text).toBe('');
    });
  });

  describe('command parsing', () => {
    it('parses command and args with the configured prefix', () => {
      const ctx = new MessageContext(sock, createMessage('!kick 123 reason'));
      expect(ctx.command).toBe('kick');
      expect(ctx.args).toEqual(['123', 'reason']);
    });

    it('is case-insensitive for the command name', () => {
      const ctx = new MessageContext(sock, createMessage('!KICK 123'));
      expect(ctx.command).toBe('kick');
    });

    it('parses commands with dot prefix', () => {
      const ctx = new MessageContext(sock, createMessage('.menu'));
      expect(ctx.command).toBe('menu');
      expect(ctx.args).toEqual([]);
    });

    it('prefers the longest matching prefix (.. vs .)', () => {
      const ctx = new MessageContext(sock, createMessage('..weird'));
      expect(ctx.command).toBe('.weird');
    });

    it('returns no command for plain text', () => {
      const ctx = new MessageContext(sock, createMessage('hola a todos'));
      expect(ctx.command).toBe('');
      expect(ctx.args).toEqual([]);
    });

    it('handles prefix-only messages', () => {
      const ctx = new MessageContext(sock, createMessage('!'));
      expect(ctx.command).toBe('');
      expect(ctx.args).toEqual([]);
    });

    it('handles prefix followed by spaces', () => {
      const ctx = new MessageContext(sock, createMessage('!   kick'));
      expect(ctx.command).toBe('kick');
    });
  });

  describe('sender getter', () => {
    it('exposes normalized jid and pushName', () => {
      const ctx = new MessageContext(sock, createMessage('!ping'));
      expect(ctx.sender.jid).toBe('user@test.com');
      expect(ctx.sender.pushName).toBe('Tester');
    });

    it('flags owner by jid', () => {
      const msg = createMessage('!ping', {
        key: { id: 'x', remoteJid: 'g@g.us', fromMe: false, participant: 'owner@test.com' },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.sender.isOwner).toBe(true);
    });

    it('falls back to remoteJid as sender in DMs', () => {
      const msg = createMessage('!ping', {
        key: { id: 'x', remoteJid: 'dm@test.com', fromMe: false },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.sender.jid).toBe('dm@test.com');
    });
  });

  describe('chat getter', () => {
    it('detects group chats', () => {
      const msg = createMessage('!ping', {
        key: { id: 'x', remoteJid: '123@g.us', fromMe: false, participant: 'u@test.com' },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      expect(ctx.chat.isGroup).toBe(true);
      expect(ctx.chat.jid).toBe('123@g.us');
    });

    it('detects DM chats', () => {
      const ctx = new MessageContext(sock, createMessage('!ping'));
      expect(ctx.chat.isGroup).toBe(false);
    });
  });

  describe('messaging helpers', () => {
    it('reply() sends a quoted text message to the chat jid', async () => {
      const ctx = new MessageContext(sock, createMessage('!ping'));
      await ctx.reply('hola');
      expect(sock.sendMessage).toHaveBeenCalledWith(
        '123456789@s.whatsapp.net',
        { text: 'hola' },
        { quoted: expect.objectContaining({ key: expect.objectContaining({ id: 'msg-1' }) }) },
      );
    });

    it('react() sends a reaction with the message key', async () => {
      const ctx = new MessageContext(sock, createMessage('!ping'));
      await ctx.react('✅');
      expect(sock.sendMessage).toHaveBeenCalledWith('123456789@s.whatsapp.net', {
        react: { text: '✅', key: expect.objectContaining({ id: 'msg-1' }) },
      });
    });

    it('sendMessage() forwards arbitrary content', async () => {
      const ctx = new MessageContext(sock, createMessage('!ping'));
      const content = { text: 'raw', mentions: ['a@b.c'] };
      await ctx.sendMessage(content);
      expect(sock.sendMessage).toHaveBeenCalledWith('123456789@s.whatsapp.net', content);
    });
  });

  describe('permission loaders', () => {
    it('loadBotPermissions sets isAdmin in DMs without network calls', async () => {
      const ctx = new MessageContext(sock, createMessage('!ping'));
      await ctx.loadBotPermissions();
      expect(ctx.getBotPermissions()).toEqual({ isAdmin: false });
    });

    it('loadSenderPermissions stores fetched permissions', async () => {
      const msg = createMessage('!ping', {
        key: { id: 'x', remoteJid: '123@g.us', fromMe: false, participant: 'u@test.com' },
      } as Partial<WAMessage>);
      const ctx = new MessageContext(sock, msg);
      await ctx.loadSenderPermissions();
      expect(ctx.getSenderPermissions()).toEqual({ isAdmin: true, isOwner: false });
    });
  });
});
