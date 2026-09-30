import type { WASocket } from 'baileys';
import { serviceManager } from './Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { circuitBreakerManager } from './CircuitBreakerService.js';
import { cacheManager } from '@/core/CacheManager.js';
import { findAssetFile } from '@/utils/assetHelper.js';

export interface WelcomeConfig {
  enabled: boolean;
  message?: string;
  useProfilePic?: boolean;
}

export interface GoodbyeConfig {
  enabled: boolean;
  message?: string;
  useProfilePic?: boolean;
}

interface WelcomeConfigExtended extends WelcomeConfig {
  useProfilePic?: boolean;
}

const VANIABOT_FACTS: string[] = [
  '💌 El nombre VaniaBot nació en un dia cualquiera…',
  '💭 VaniaBot no es solo un bot…',
  '🌙 «VaniaBot» empezó como un juego…',
];

const cachedFacts: string[] = [];
let lastFactCacheTime = 0;
const FACT_CACHE_DURATION = 60 * 60 * 1000;

async function getRandomFact(): Promise<string> {
  const now = Date.now();

  if (cachedFacts.length === 0 || now - lastFactCacheTime > FACT_CACHE_DURATION) {
    cachedFacts.length = 0;
    try {
      const circuitBreaker = circuitBreakerManager.getOrCreate('uselessfacts', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 10000,
        monitoringPeriod: 60000,
        name: 'uselessfacts',
      });

      const results = await Promise.all(
        Array(5)
          .fill(null)
          .map(async () => {
            try {
              const res = await circuitBreaker.execute(async () => {
                const resp = await fetch(
                  'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en',
                  {
                    signal: AbortSignal.timeout(5000),
                  },
                );
                if (!resp.ok) throw new Error(`status ${resp.status}`);
                const data = (await resp.json()) as { text?: string };
                return data.text?.trim();
              });
              return res;
            } catch (error) {
              logger.debug('[WelcomeService] Fact source failed:', error);
              return null;
            }
          }),
      );

      const validFacts = results.filter((f): f is string => f !== null);
      cachedFacts.push(...validFacts);
      lastFactCacheTime = now;
    } catch (error) {
      // Sin facts remotos se cae a la lista local: registrar, no romper.
      logger.debug('[WelcomeService] Fact refresh failed:', error);
    }
  }

  const roll = Math.random();
  if (roll < 0.15 && cachedFacts.length > 0) {
    return cachedFacts[Math.floor(Math.random() * cachedFacts.length)];
  }

  return VANIABOT_FACTS[Math.floor(Math.random() * VANIABOT_FACTS.length)];
}

function formatFact(fact: string): string {
  return `\n.・✦─⋆⋅ 𝘿𝙖𝙩𝙤 𝙘𝙪𝙧𝙞𝙤𝙨𝙤 ⋅⋆─✦・.\n${fact}\n.・✦────────────✦・.`;
}

export class WelcomeService {
  private readonly DEFAULT_PROFILE_PIC = 'logo.png';
  private readonly DEFAULT_WELCOME = `
✧･ﾟ:*  𝙚𝙮, 𝙣𝙪𝙚𝙫𝙖 𝙘𝙖𝙧𝙖  *:･ﾟ✧
hola @user ♡
@fact
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  private readonly DEFAULT_GOODBYE = `
✧･ﾟ:*  𝙎𝙚 𝙡@ 𝙡𝙡𝙚𝙫@ 𝙡𝙖 𝙫𝙚𝙧𝙜𝙖  *:･ﾟ✧
@user dijo adiós
@count seguimos aquí
✧･ﾟ:*  𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩  *:･ﾟ✧
  `.trim();

  /**
   * Obtiene el buffer de la imagen por defecto usando assetHelper
   */
  private getDefaultProfilePicBuffer(): Buffer | null {
    try {
      return findAssetFile(this.DEFAULT_PROFILE_PIC);
    } catch (error) {
      logError('[WelcomeService] Error loading default profile pic:', error);
      return null;
    }
  }

  async handleNewParticipant(sock: WASocket, groupJid: string, userJid: string): Promise<void> {
    try {
      const isVaniaEnabled = await serviceManager.vaniaToggleService.isEnabled(groupJid, 'main');
      if (!isVaniaEnabled) return;

      const group = await serviceManager.groupService.getGroup(groupJid);
      if (!group.welcome.enabled) return;

      const metadata = await sock.groupMetadata(groupJid);
      const rawFact = await getRandomFact();
      const formattedFact = formatFact(rawFact);

      const message = this.parseMessage(group.welcome.message || this.DEFAULT_WELCOME, {
        user: `@${userJid.split('@')[0]}`,
        group: metadata.subject,
        desc: metadata.desc || 'Sin descripción',
        count: metadata.participants.length.toString(),
        fact: formattedFact,
      });

      const welcomeExt = group.welcome as WelcomeConfigExtended;
      const useProfilePic = welcomeExt.useProfilePic !== false;

      let profilePicBuffer: Buffer | null = null;
      if (useProfilePic) {
        try {
          const profilePicUrl = await sock.profilePictureUrl(userJid, 'image');
          if (profilePicUrl) {
            const response = await fetch(profilePicUrl);
            profilePicBuffer = Buffer.from(await response.arrayBuffer());
          }
        } catch {
          profilePicBuffer = this.getDefaultProfilePicBuffer();
        }
      }

      if (profilePicBuffer) {
        await sock.sendMessage(groupJid, {
          image: profilePicBuffer,
          caption: message,
          mentions: [userJid],
        });
      } else {
        await sock.sendMessage(groupJid, { text: message, mentions: [userJid] });
      }
    } catch (error) {
      logError('[Welcome] Error critico enviando bienvenida:', error);
    }
  }

  async handleParticipantLeft(
    sock: WASocket,
    groupJid: string,
    userJid: string,
    botId: string = 'main',
  ): Promise<void> {
    try {
      const isVaniaEnabled = await serviceManager.vaniaToggleService.isEnabled(groupJid, botId);
      if (!isVaniaEnabled) return;

      const group = await serviceManager.groupService.getGroup(groupJid);
      if (!group.goodbye.enabled) return;

      let metadata;
      try {
        metadata = await sock.groupMetadata(groupJid);
      } catch (metadataError) {
        const errMsg =
          metadataError instanceof Error ? metadataError.message : String(metadataError);
        if (errMsg.includes('forbidden') || errMsg.includes('not-authorized')) {
          return;
        }
        throw metadataError;
      }

      const rawFact = await getRandomFact();
      const formattedFact = formatFact(rawFact);

      const message = this.parseMessage(group.goodbye.message || this.DEFAULT_GOODBYE, {
        user: `@${userJid.split('@')[0]}`,
        group: metadata.subject,
        desc: metadata.desc || 'Sin descripción',
        count: metadata.participants.length.toString(),
        fact: formattedFact,
      });

      const groupGoodbye = group.goodbye as GoodbyeConfig;
      const useProfilePic = groupGoodbye.useProfilePic === true;

      let profilePicBuffer: Buffer | null = null;
      if (useProfilePic) {
        try {
          const profilePicUrl = await sock.profilePictureUrl(userJid, 'image');
          if (profilePicUrl) {
            const response = await fetch(profilePicUrl);
            profilePicBuffer = Buffer.from(await response.arrayBuffer());
          }
        } catch {
          profilePicBuffer = this.getDefaultProfilePicBuffer();
        }
      }

      if (profilePicBuffer) {
        await sock.sendMessage(groupJid, {
          image: profilePicBuffer,
          caption: message,
          mentions: [userJid],
        });
      } else {
        await sock.sendMessage(groupJid, { text: message, mentions: [userJid] });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('forbidden') || errMsg.includes('not-authorized')) {
        return;
      }
      logError('[Goodbye] Error enviando despedida:', error);
    }
  }

  private parseMessage(template: string, vars: Record<string, string>): string {
    let message = template;
    for (const [key, value] of Object.entries(vars)) {
      message = message.replace(new RegExp(`@${key}`, 'g'), value);
    }
    return message;
  }

  async enableWelcome(groupJid: string, message?: string, useProfilePic = true): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: {
        enabled: true,
        message: message || this.DEFAULT_WELCOME,
        ...(useProfilePic !== undefined && { useProfilePic }),
      },
    });
    cacheManager.invalidateGroupMetadata(groupJid);
    logger.info(`[Welcome] Bienvenida activada para ${groupJid}`);
  }

  async disableWelcome(groupJid: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: { ...group.welcome, enabled: false },
    });
    cacheManager.invalidateGroupMetadata(groupJid);
    logger.info(`[Welcome] Bienvenida desactivada para ${groupJid}`);
  }

  async enableGoodbye(groupJid: string, message?: string): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: { enabled: true, message: message || this.DEFAULT_GOODBYE },
    });
    cacheManager.invalidateGroupMetadata(groupJid);
    logger.info(`[Goodbye] Despedida activada para ${groupJid}`);
  }

  async disableGoodbye(groupJid: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: { ...group.goodbye, enabled: false },
    });
    cacheManager.invalidateGroupMetadata(groupJid);
    logger.info(`[Goodbye] Despedida desactivada para ${groupJid}`);
  }

  async setWelcomeMessage(groupJid: string, message: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: { ...group.welcome, message },
    });
  }

  async setGoodbyeMessage(groupJid: string, message: string): Promise<void> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    await serviceManager.groupService.updateGroup(groupJid, {
      goodbye: { ...group.goodbye, message },
    });
  }

  async resetMessages(groupJid: string): Promise<void> {
    await serviceManager.groupService.updateGroup(groupJid, {
      welcome: { enabled: true, message: this.DEFAULT_WELCOME },
      goodbye: { enabled: true, message: this.DEFAULT_GOODBYE },
    });
  }

  public getDefaultWelcome(): string {
    return this.DEFAULT_WELCOME;
  }

  public getDefaultGoodbye(): string {
    return this.DEFAULT_GOODBYE;
  }

  public getDefaultProfilePicPath(): string {
    return this.DEFAULT_PROFILE_PIC;
  }

  async getConfig(groupJid: string): Promise<{ welcome: WelcomeConfig; goodbye: GoodbyeConfig }> {
    const group = await serviceManager.groupService.getGroup(groupJid);
    const welcomeExt = group.welcome as WelcomeConfigExtended;
    return {
      welcome: {
        enabled: group.welcome.enabled,
        message: group.welcome.message || this.DEFAULT_WELCOME,
        useProfilePic: welcomeExt.useProfilePic !== false,
      },
      goodbye: {
        enabled: group.goodbye.enabled,
        message: group.goodbye.message || this.DEFAULT_GOODBYE,
      },
    };
  }
}

export const welcomeService = new WelcomeService();
