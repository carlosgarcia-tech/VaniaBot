import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WelcomeService } from '../../src/services/system/WelcomeService.js';

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    orbitToggleService: {
      isEnabled: vi.fn().mockResolvedValue(true),
    },
    groupService: {
      getGroup: vi.fn(),
      updateGroup: vi.fn(),
    },
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

vi.mock('fetch', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/utils/assetHelper.js', () => ({
  findAssetFile: vi.fn().mockReturnValue(Buffer.from('mock-image')),
}));

describe('WelcomeService', () => {
  let welcomeService: WelcomeService;

  beforeEach(() => {
    vi.clearAllMocks();
    welcomeService = new WelcomeService();
  });

  describe('getDefaultWelcome', () => {
    it('should return default welcome message', () => {
      const msg = welcomeService.getDefaultWelcome();
      expect(msg).toContain('𝘽');
    });
  });

  describe('getDefaultGoodbye', () => {
    it('should return default goodbye message', () => {
      const msg = welcomeService.getDefaultGoodbye();
      expect(msg).toContain('𝘽');
    });
  });

  describe('getDefaultProfilePicPath', () => {
    it('should return default profile pic path', () => {
      const path = welcomeService.getDefaultProfilePicPath();
      expect(path).toBe('logo.png');
    });
  });

  describe('enableWelcome', () => {
    it('should enable welcome with default message', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: false },
      } as any);

      await welcomeService.enableWelcome('group@test.com');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          welcome: expect.objectContaining({ enabled: true }),
        }),
      );
    });

    it('should enable welcome with custom message', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: false },
      } as any);

      await welcomeService.enableWelcome('group@test.com', 'Custom welcome');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          welcome: expect.objectContaining({
            enabled: true,
            message: 'Custom welcome',
          }),
        }),
      );
    });
  });

  describe('disableWelcome', () => {
    it('should disable welcome', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: true },
        goodbye: { enabled: false },
      } as any);

      await welcomeService.disableWelcome('group@test.com');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          welcome: { enabled: false },
        }),
      );
    });
  });

  describe('enableGoodbye', () => {
    it('should enable goodbye with default message', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: false },
      } as any);

      await welcomeService.enableGoodbye('group@test.com');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          goodbye: expect.objectContaining({ enabled: true }),
        }),
      );
    });
  });

  describe('disableGoodbye', () => {
    it('should disable goodbye', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: true },
      } as any);

      await welcomeService.disableGoodbye('group@test.com');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          goodbye: { enabled: false },
        }),
      );
    });
  });

  describe('setWelcomeMessage', () => {
    it('should update welcome message', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: true, message: 'Old welcome' },
        goodbye: { enabled: false },
      } as any);

      await welcomeService.setWelcomeMessage('group@test.com', 'New welcome');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          welcome: expect.objectContaining({ message: 'New welcome' }),
        }),
      );
    });
  });

  describe('setGoodbyeMessage', () => {
    it('should update goodbye message', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: true, message: 'Old message' },
      } as any);

      await welcomeService.setGoodbyeMessage('group@test.com', 'New goodbye');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          goodbye: expect.objectContaining({ message: 'New goodbye' }),
        }),
      );
    });
  });

  describe('resetMessages', () => {
    it('should reset both messages to defaults', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false, message: 'Custom' },
        goodbye: { enabled: false, message: 'Custom' },
      } as any);

      await welcomeService.resetMessages('group@test.com');

      expect(serviceManager.groupService.updateGroup).toHaveBeenCalledWith(
        'group@test.com',
        expect.objectContaining({
          welcome: expect.objectContaining({ enabled: true }),
          goodbye: expect.objectContaining({ enabled: true }),
        }),
      );
    });
  });

  describe('getConfig', () => {
    it('should return welcome and goodbye config', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: true, message: 'Welcome!' },
        goodbye: { enabled: false, message: 'Goodbye!' },
      } as any);

      const config = await welcomeService.getConfig('group@test.com');

      expect(config.welcome.enabled).toBe(true);
      expect(config.welcome.message).toBe('Welcome!');
      expect(config.goodbye.enabled).toBe(false);
    });
  });

  describe('handleNewParticipant', () => {
    it('should skip when welcome is disabled', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');

      vi.mocked(serviceManager.orbitToggleService.isEnabled).mockResolvedValue(true);
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: false },
      } as any);

      const mockSock = {
        groupMetadata: vi.fn(),
        sendMessage: vi.fn(),
        profilePictureUrl: vi.fn(),
      } as any;

      await welcomeService.handleNewParticipant(mockSock, 'group@test.com', 'user@test.com');

      expect(mockSock.sendMessage).not.toHaveBeenCalled();
    });

    it('should send welcome message when enabled', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');
      
      vi.mocked(serviceManager.orbitToggleService.isEnabled).mockResolvedValue(true);
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: true, message: 'Welcome @user' },
        goodbye: { enabled: false },
      } as any);

      const mockSock = {
        groupMetadata: vi.fn().mockResolvedValue({
          subject: 'Test Group',
          desc: 'Test Description',
          participants: [{ id: 'user@test.com' }],
        }),
        sendMessage: vi.fn().mockResolvedValue({}),
        profilePictureUrl: vi.fn().mockRejectedValue(new Error('No pic')),
      } as any;

      await welcomeService.handleNewParticipant(mockSock, 'group@test.com', 'user@test.com');

      expect(mockSock.sendMessage).toHaveBeenCalled();
    });
  });

  describe('handleParticipantLeft', () => {
    it('should skip when goodbye is disabled', async () => {
      const { serviceManager } = await import('../../src/services/system/Servicemanager.js');

      vi.mocked(serviceManager.orbitToggleService.isEnabled).mockResolvedValue(true);
      vi.mocked(serviceManager.groupService.getGroup).mockResolvedValue({
        jid: 'group@test.com',
        welcome: { enabled: false },
        goodbye: { enabled: false },
      } as any);

      const mockSock = {
        groupMetadata: vi.fn(),
        sendMessage: vi.fn(),
      } as any;

      await welcomeService.handleParticipantLeft(mockSock, 'group@test.com', 'user@test.com');

      expect(mockSock.sendMessage).not.toHaveBeenCalled();
    });
  });
});