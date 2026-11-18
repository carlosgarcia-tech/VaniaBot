/**
 * AnimeCommand.ts
 *
 * OrbitBot commands module exposing `hugCommand`, `patCommand`, `kissCommand`, `cryCommand`.
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { AnimeBase } from './AnimeBase.js';
import { nekosBestService } from '@/services/external/NekosBestService.js';
import { purrbotService } from '@/services/external/PurrbotService.js';
import { nekobotService } from '@/services/external/NekobotService.js';
import { booruService } from '@/services/external/BooruService.js';
import { animeNewsService } from '@/services/external/AnimeNewsService.js';
import { gifUrlToMp4 } from '@/services/media/GifToMp4.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

type AnimeService =
  | 'animebase'
  | 'nekos'
  | 'nekobot'
  | 'booru'
  | 'reactions'
  | 'nsfw'
  | 'random'
  | 'anime'
  | 'animenews';

interface AnimeCommandDef {
  name: string;
  description: string;
  aliases: string[];
  react: string;
  endpoint: string;
  service: AnimeService;
  cooldown?: number;
  enabled?: boolean;
  /** NSFW commands are gated by the !nsfw toggle in the pipeline. */
  nsfw?: boolean;
  /** gif provider when the category is not on nekos.best. */
  provider?: 'purrbot';
  /** Booru tag query (`tags=a b`, max 2 for danbooru anonymous). */
  tags?: string;
  usage?: string;
  examples?: string[];
}

const ANIME_COMMANDS: AnimeCommandDef[] = [
  {
    name: 'neko',
    description: 'Obtiene una imagen aleatoria de neko',
    aliases: ['neko', 'nekos', 'nekochan'],
    react: '🐱',
    endpoint: 'neko',
    service: 'nekos',
  },
  {
    // Restored via Danbooru (2-tag anonymous limit: tag + rating).
    name: 'megumin',
    description: 'Obtiene una imagen aleatoria de Megumin',
    aliases: ['megumin'],
    react: '🔥',
    endpoint: 'danbooru',
    tags: 'megumin rating:g',
    service: 'booru',
  },
  {
    name: 'waifu',
    description: 'Obtiene una imagen aleatoria de waifu',
    aliases: ['waifu'],
    react: '👧',
    endpoint: 'waifu',
    service: 'nekos',
  },
  {
    name: 'randomanime',
    description: 'Obtiene una imagen aleatoria de anime',
    aliases: ['randomanime', 'random_anime'],
    react: '🎲',
    endpoint: 'random',
    service: 'nekos',
  },
  {
    // Restored via nekobot.xyz, behind the !nsfw toggle.
    name: 'hneko',
    description: 'Obtiene una imagen aleatoria de hneko NSFW',
    aliases: ['hneko', 'hnekonsfw'],
    react: '😺',
    endpoint: 'hneko',
    service: 'nekobot',
    nsfw: true,
  },
  {
    // Restored via nekobot.xyz (hkitsune), behind the !nsfw toggle.
    name: 'hwaifu',
    description: 'Obtiene una imagen aleatoria de hwaifu NSFW',
    aliases: ['hwaifu'],
    react: '😈',
    endpoint: 'hkitsune',
    service: 'nekobot',
    nsfw: true,
  },
  {
    // Restored via Konachan.net (SFW mirror, verified alive).
    name: 'konachan',
    description: 'Obtiene una imagen de Konachan',
    aliases: ['konachan'],
    react: '🖼️',
    endpoint: 'konachan_net',
    service: 'booru',
  },
  {
    // Restored via Danbooru (yande.re has no milf pool), behind !nsfw.
    name: 'milf',
    description: 'Obtiene una imagen de milf',
    aliases: ['milf'],
    react: '🍑',
    endpoint: 'danbooru',
    tags: 'milf rating:g',
    service: 'booru',
    nsfw: true,
  },

  {
    // nekos.best 'kitsune' replaces the dead Delirius foxgirl.
    name: 'foxgirl',
    description: 'Obtiene una imagen de foxgirl',
    aliases: ['foxgirl'],
    react: '🦊',
    endpoint: 'kitsune',
    service: 'nekos',
  },
  {
    name: 'gacha',
    description: 'Obtiene un personaje aleatorio de gacha',
    aliases: [],
    react: '🎰',
    // Restored via Danbooru (game CG art).
    endpoint: 'danbooru',
    tags: 'game_cg rating:g',
    service: 'booru',
  },
  {
    // Restored via nekobot (pgif), behind the !nsfw toggle.
    name: 'hentaivid',
    description: 'Obtiene un video hentai aleatorio',
    aliases: ['hentaivideo'],
    react: '🎬',
    endpoint: 'pgif',
    service: 'nekobot',
    nsfw: true,
  },
  {
    // Restored via Danbooru.
    name: 'maid',
    description: 'Obtiene una imagen de maid anime',
    aliases: [],
    react: '👗',
    endpoint: 'danbooru',
    tags: 'maid rating:g',
    service: 'booru',
  },
  {
    name: 'selfie',
    description: 'Obtiene una selfie anime aleatoria',
    aliases: [],
    react: '🤳',
    // Restored via Danbooru.
    endpoint: 'danbooru',
    tags: 'selfie rating:g',
    service: 'booru',
  },
  {
    // Restored via Danbooru.
    name: 'uniform',
    description: 'Obtiene una imagen de uniforme anime',
    aliases: [],
    react: '👔',
    endpoint: 'danbooru',
    tags: 'school_uniform rating:g',
    service: 'booru',
  },

  {
    name: 'hug',
    description: 'Muestra una imagen de anime abrazando',
    aliases: ['hug', 'abrazar'],
    react: '🤗',
    endpoint: 'hug',
    service: 'reactions',
  },
  {
    name: 'pat',
    description: 'Muestra una imagen de anime acariciando',
    aliases: ['pat', 'acariciar'],
    react: '👋',
    endpoint: 'pat',
    service: 'reactions',
  },
  {
    name: 'kiss',
    description: 'Muestra una imagen de anime besando',
    aliases: ['kiss', 'besar'],
    react: '💋',
    endpoint: 'kiss',
    service: 'reactions',
  },
  {
    name: 'cry',
    description: 'Muestra una imagen de anime llorando',
    aliases: ['cry', 'llorar'],
    react: '😭',
    endpoint: 'cry',
    service: 'reactions',
  },
  {
    name: 'dance',
    description: 'Muestra una imagen de anime bailando',
    aliases: ['dance', 'bailar'],
    react: '💃',
    endpoint: 'dance',
    service: 'reactions',
  },
  {
    name: 'angry',
    description: 'Muestra una imagen de anime enojado',
    aliases: ['angry', 'enojado'],
    react: '😡',
    endpoint: 'angry',
    service: 'reactions',
  },
  {
    name: 'bonk',
    description: 'Muestra una imagen de anime bonk',
    aliases: ['bonk'],
    react: '🔨',
    endpoint: 'bonk',
    service: 'reactions',
  },
  {
    name: 'bite',
    description: 'Muestra una imagen de anime mordiendo',
    aliases: ['bite', 'morder'],
    react: '🦷',
    endpoint: 'bite',
    service: 'reactions',
  },
  {
    name: 'blush',
    description: 'Muestra una imagen de anime sonrojado',
    aliases: ['blush', 'sonrojar'],
    react: '😊',
    endpoint: 'blush',
    service: 'reactions',
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'bully',
    description: 'Muestra una imagen de anime bullying',
    aliases: ['bully', 'intimidar'],
    react: '👊',
    endpoint: 'bully',
    service: 'reactions',
    enabled: false,
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'confy',
    description: 'Muestra una imagen de anime confortable',
    aliases: ['confy', 'confort'],
    react: '😌',
    endpoint: 'confy',
    service: 'reactions',
    enabled: false,
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'cringe',
    description: 'Muestra una imagen de anime cringe',
    aliases: ['cringe'],
    react: '😬',
    endpoint: 'cringe',
    service: 'reactions',
    enabled: false,
  },
  {
    name: 'cuddle',
    description: 'Muestra una imagen de anime acurrucado',
    aliases: ['cuddle', 'acurrucar'],
    react: '🤗',
    endpoint: 'cuddle',
    service: 'reactions',
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'eevee',
    description: 'Muestra una imagen de Eevee',
    aliases: ['eevee', 'eve'],
    react: '🐾',
    endpoint: 'eevee',
    service: 'reactions',
    enabled: false,
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'fluff',
    description: 'Muestra una imagen de anime fluffy',
    aliases: ['fluff'],
    react: '🦊',
    endpoint: 'fluff',
    service: 'reactions',
    enabled: false,
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'glomp',
    description: 'Muestra una imagen de anime glomp',
    aliases: ['glomp', 'saltar'],
    react: '🤗',
    endpoint: 'glomp',
    service: 'reactions',
    enabled: false,
  },
  {
    name: 'handhold',
    description: 'Muestra una imagen de anime tomados de la mano',
    aliases: ['handhold', 'manos'],
    react: '🤝',
    endpoint: 'handhold',
    service: 'reactions',
  },
  {
    name: 'happy',
    description: 'Muestra una imagen de anime feliz',
    aliases: ['happy', 'feliz'],
    react: '😄',
    endpoint: 'happy',
    service: 'reactions',
  },
  {
    name: 'highfive',
    description: 'Muestra una imagen de anime chocando los 5',
    aliases: ['highfive', 'chocar'],
    react: '✋',
    endpoint: 'highfive',
    service: 'reactions',
  },
  {
    name: 'kill',
    description: 'Muestra una imagen de anime matando',
    aliases: ['kill', 'matar'],
    react: '🔪',
    endpoint: 'kill',
    service: 'reactions',
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    enabled: false,
  },
  {
    // 'lay' has no category in nekos.best; 'sleep' is the closest gif.
    name: 'lay',
    description: 'Muestra una imagen de anime recostado',
    aliases: ['lay', 'recostar'],
    react: '🛌',
    endpoint: 'sleep',
    service: 'reactions',
  },
  {
    // Not in nekos.best; waifu.pics (the planned fallback) is dead.
    name: 'lick',
    description: 'Muestra una imagen de anime lamiendo',
    aliases: ['lick', 'lamer'],
    react: '👅',
    endpoint: 'lick',
    service: 'reactions',
    enabled: false,
  },
  {
    name: 'nom',
    description: 'Muestra una imagen de anime comiendo',
    aliases: ['nom', 'comer'],
    react: '🍽️',
    endpoint: 'nom',
    service: 'reactions',
  },
  {
    name: 'poke',
    description: 'Muestra una imagen de anime tocando',
    aliases: ['poke', 'tocar'],
    react: '👉',
    endpoint: 'poke',
    service: 'reactions',
  },
  {
    name: 'pout',
    description: 'Muestra una imagen de anime haciendo puchero',
    aliases: ['pout', 'puchero'],
    react: '😗',
    endpoint: 'pout',
    service: 'reactions',
  },
  {
    name: 'slap',
    description: 'Muestra una imagen de anime abofeteando',
    aliases: ['slap', 'abofetear'],
    react: '✋',
    endpoint: 'slap',
    service: 'reactions',
  },
  {
    name: 'smile',
    description: 'Muestra una imagen de anime sonriendo',
    aliases: ['smile', 'sonrisa'],
    react: '😊',
    endpoint: 'smile',
    service: 'reactions',
  },
  {
    name: 'smug',
    description: 'Muestra una imagen de anime smug',
    aliases: ['smug'],
    react: '😏',
    endpoint: 'smug',
    service: 'reactions',
  },
  {
    // nekos.best 'wag' (moving tail gif).
    name: 'tail',
    description: 'Muestra una imagen de anime moviendo la cola',
    aliases: ['tail', 'cola'],
    react: '🐕',
    endpoint: 'wag',
    service: 'reactions',
  },
  {
    name: 'tickle',
    description: 'Muestra una imagen de anime haciendo cosquillas',
    aliases: ['tickle', 'cosquillas'],
    react: '🪶',
    endpoint: 'tickle',
    service: 'reactions',
  },
  {
    name: 'wink',
    description: 'Muestra una imagen de anime guiñando',
    aliases: ['wink', 'guiñar'],
    react: '😉',
    endpoint: 'wink',
    service: 'reactions',
  },
  {
    name: 'yeet',
    description: 'Muestra una imagen de anime yeet',
    aliases: ['yeet', 'lanzar'],
    react: '🚀',
    endpoint: 'yeet',
    service: 'reactions',
  },
  {
    name: 'patear',
    description: 'Muestra una imagen de anime pateando',
    // No alias 'kick': it is the name of KickCommand (moderation) and the registry
    // remapped it, leaving the kick unreachable by its own name.
    aliases: [],
    react: '🦶',
    endpoint: 'kick',
    service: 'reactions',
  },

  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'anal',
    description: 'Imagen NSFW de anal',
    aliases: ['anal'],
    react: '🔞',
    endpoint: 'nsfw/anal',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'blowjob',
    description: 'Imagen NSFW de blowjob',
    aliases: ['blowjob', 'mamada'],
    react: '🔞',
    endpoint: 'nsfw/blowjob',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'cum',
    description: 'Imagen NSFW de cum',
    aliases: ['cum', 'semen'],
    react: '🔞',
    endpoint: 'nsfw/cum',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'fuck',
    description: 'Imagen NSFW de fuck',
    aliases: ['fuck', 'coger'],
    react: '🔞',
    endpoint: 'nsfw/fuck',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'nekonsfw',
    description: 'Imagen NSFW de neko',
    aliases: ['nekonsfw'],
    react: '🔞',
    endpoint: 'nsfw/neko',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'nekosfw',
    description: 'Imagen SFW de neko gif',
    aliases: ['nekosfw'],
    react: '🔞',
    endpoint: 'sfw/neko',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'pussylick',
    description: 'Imagen NSFW de pussylick',
    aliases: ['pussylick'],
    react: '🔞',
    endpoint: 'nsfw/pussylick',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'solo',
    description: 'Imagen NSFW de solo',
    aliases: ['solo'],
    react: '🔞',
    endpoint: 'nsfw/solo',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },
  {
    // Restored via Purrbot (api.purrbot.site/v2, verified alive).
    name: 'yuri',
    description: 'Imagen NSFW de yuri',
    aliases: ['yuri'],
    react: '🔞',
    endpoint: 'nsfw/yuri',
    service: 'reactions',
    provider: 'purrbot',
    nsfw: true,
  },

  {
    name: 'coffee',
    description: 'Obtiene una imagen de cafe aleatoria',
    aliases: ['coffee', 'cafe'],
    react: '☕',
    endpoint: 'coffee',
    service: 'random',
    cooldown: 10000,
  },
  {
    name: 'dog',
    description: 'Obtiene una imagen de perro aleatoria',
    aliases: ['dog', 'perro'],
    react: '🐶',
    endpoint: 'dog',
    service: 'random',
    cooldown: 10000,
  },
  {
    name: 'duck',
    description: 'Obtiene una imagen de pato aleatoria',
    aliases: ['duck', 'pato'],
    react: '🦆',
    endpoint: 'duck',
    service: 'random',
    cooldown: 10000,
  },
  {
    name: 'picsum',
    description: 'Obtiene una imagen aleatoria de Picsum',
    aliases: ['picsum', 'randompic'],
    react: '🖼️',
    endpoint: 'picsum',
    service: 'random',
    cooldown: 10000,
  },

  {
    // Restored via nekobot, behind the !nsfw toggle.
    name: 'boobs',
    description: 'Obtiene una imagen de tetinas',
    aliases: ['boobs', 'tetas'],
    react: '🔞',
    endpoint: 'boobs',
    service: 'nekobot',
    cooldown: 10000,
    nsfw: true,
  },
  {
    // Restored via nekobot, behind the !nsfw toggle.
    name: 'hentai',
    description: 'Obtiene una imagen hentai aleatoria',
    aliases: ['hentai'],
    react: '🔞',
    endpoint: 'hentai',
    service: 'nekobot',
    cooldown: 10000,
    nsfw: true,
  },

  {
    name: 'avatar',
    description: 'Obtiene un avatar anime aleatorio',
    aliases: ['avataranime'],
    react: '🎭',
    endpoint: 'avatar',
    service: 'anime',
  },
  {
    // Restored via Danbooru.
    name: 'marin',
    description: 'Obtiene una imagen de Marin Kitagawa',
    aliases: ['marin_kitagawa'],
    react: '🎀',
    endpoint: 'danbooru',
    tags: 'kitagawa_marin rating:g',
    service: 'booru',
    cooldown: 10000,
  },
  {
    // Restored via Danbooru (Mori Calliope, VTuber de Hololive).
    name: 'mori',
    description: 'Obtiene una imagen de Mori Calliope',
    aliases: ['mori_calliope'],
    react: '👼',
    endpoint: 'danbooru',
    tags: 'mori_calliope rating:g',
    service: 'booru',
    cooldown: 10000,
  },
  {
    // Restored via nekobot (boobs), behind the !nsfw toggle.
    name: 'oppai',
    description: 'Obtiene una imagen de oppai',
    aliases: ['oppai'],
    react: '🍈',
    endpoint: 'boobs',
    service: 'nekobot',
    cooldown: 10000,
    nsfw: true,
  },
  {
    // Restored via ANN RSS (verified alive).
    name: 'newsanime',
    description: 'Muestra las últimas noticias de anime',
    aliases: ['anime_news', 'noticiasanime'],
    react: '📰',
    endpoint: 'newsanime',
    service: 'animenews',
    cooldown: 10000,
  },
];

const ANIME_COMMANDS_MAP = new Map(ANIME_COMMANDS.map(c => [c.name, c]));
function getAnimeCommand(name: string): AnimeCommandDef {
  const cmd = ANIME_COMMANDS_MAP.get(name);
  if (!cmd) throw new Error(`Anime command '${name}' not found`);
  return cmd;
}

/** Random pick among nekos.best image categories (for `randomanime`). */
const NEKO_RANDOM_CATEGORIES = ['neko', 'waifu', 'kitsune', 'husbando'];

/** Direct JSON image sources replacing the dead Delirius `random` category. */
const RANDOM_JSON_URLS: Record<string, string> = {
  dog: 'https://dog.ceo/api/breeds/image/random',
  duck: 'https://random-d.uk/api/v2/random',
  coffee: 'https://coffee.alexflipnote.dev/random.json',
};

async function fetchJsonObject(url: string): Promise<Record<string, never>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OrbitBot/7.3 (WhatsApp bot)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return (await response.json()) as Record<string, never>;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Resolves a `random`-service endpoint to an image URL. */
export async function resolveRandomImage(endpoint: string): Promise<string> {
  if (endpoint === 'picsum') {
    return `https://picsum.photos/600/400?r=${Date.now()}`;
  }
  const jsonUrl = RANDOM_JSON_URLS[endpoint];
  if (!jsonUrl) {
    throw new Error(`Endpoint aleatorio desconocido: ${endpoint}`);
  }
  const data = await fetchJsonObject(jsonUrl);
  const imageUrl =
    (data as { message?: string }).message ??
    (data as { url?: string }).url ??
    (data as { image?: string }).image;
  if (!imageUrl) {
    throw new Error(`No image URL in response from ${jsonUrl}`);
  }
  return imageUrl;
}

function createAnimeCommand(def: AnimeCommandDef): Command {
  const cooldown = def.cooldown ?? 8000;
  const enabled = def.enabled ?? true;
  const usage = def.usage ?? `!${def.name}`;
  const examples = def.examples ?? [`!${def.name}`];

  class DynamicCommand extends Command {
    name = def.name;
    description = def.description;
    category = CommandCategory.ANIME;
    aliases = def.aliases;
    cooldown = cooldown;
    enabled = enabled;
    nsfw = def.nsfw ?? false;
    contexts = [CommandContext.BOTH];
    usage = usage;
    examples = examples;
    permissions = { user: [PermissionLevel.USER], bot: [] };

    async execute(ctx: MessageContext): Promise<void> {
      await ctx.react(def.react);

      switch (def.service) {
        case 'animebase': {
          await new AnimeBase().sendImage(ctx, def.endpoint);
          break;
        }
        case 'nekos': {
          try {
            const category =
              def.endpoint === 'random'
                ? NEKO_RANDOM_CATEGORIES[Math.floor(Math.random() * NEKO_RANDOM_CATEGORIES.length)]
                : def.endpoint;
            const imageUrl = await nekosBestService.getImageUrl(category);
            await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'reactions': {
          try {
            // nekos.best serves GIFs; convert to mp4 once and cache for
            // gifPlayback playback (WhatsApp cannot play raw GIFs).
            const video =
              def.provider === 'purrbot'
                ? await purrbotService.getReactionVideo(def.endpoint)
                : await nekosBestService.getReactionVideo(def.endpoint);
            await ctx.sock.sendMessage(ctx.chat.jid, {
              video: video,
              gifPlayback: true,
            });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'nekobot': {
          try {
            const imageUrl = await nekobotService.getImage(def.endpoint);
            if (imageUrl.endsWith('.gif')) {
              // nekobot also serves gifs; WhatsApp needs mp4 for playback.
              const video = await gifUrlToMp4(imageUrl);
              await ctx.sock.sendMessage(ctx.chat.jid, { video, gifPlayback: true });
            } else {
              await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            }
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'booru': {
          try {
            const imageUrl = await booruService.randomPost(
              def.endpoint as 'konachan_net' | 'yandere' | 'danbooru',
              def.tags,
            );
            await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No encontré imagen (o fue filtrada por seguridad).');
          }
          break;
        }
        case 'random': {
          try {
            const imageUrl = await resolveRandomImage(def.endpoint);
            await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'animenews': {
          try {
            const items = await animeNewsService.latestNews();
            const list = items.map(n => `📰 *${n.title}*\n🔗 ${n.link}`).join('\n\n');
            await ctx.reply(`📰 *Últimas noticias de anime (ANN)*\n\n${list}`);
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude leer las noticias. Intenta de nuevo.');
          }
          break;
        }
        case 'anime': {
          try {
            const imageUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${Math.random().toString(36).slice(2)}`;
            await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
      }
    }
  }

  return new DynamicCommand();
}

export const hugCommand = createAnimeCommand(getAnimeCommand('hug'));
export const patCommand = createAnimeCommand(getAnimeCommand('pat'));
export const kissCommand = createAnimeCommand(getAnimeCommand('kiss'));
export const cryCommand = createAnimeCommand(getAnimeCommand('cry'));
export const danceCommand = createAnimeCommand(getAnimeCommand('dance'));
export const angryCommand = createAnimeCommand(getAnimeCommand('angry'));
export const bonkCommand = createAnimeCommand(getAnimeCommand('bonk'));
export const biteCommand = createAnimeCommand(getAnimeCommand('bite'));
export const blushCommand = createAnimeCommand(getAnimeCommand('blush'));
export const bullyCommand = createAnimeCommand(getAnimeCommand('bully'));
export const confyCommand = createAnimeCommand(getAnimeCommand('confy'));
export const cringeCommand = createAnimeCommand(getAnimeCommand('cringe'));
export const cuddleCommand = createAnimeCommand(getAnimeCommand('cuddle'));
export const eeveeCommand = createAnimeCommand(getAnimeCommand('eevee'));
export const fluffCommand = createAnimeCommand(getAnimeCommand('fluff'));
export const glompCommand = createAnimeCommand(getAnimeCommand('glomp'));
export const handholdCommand = createAnimeCommand(getAnimeCommand('handhold'));
export const happyCommand = createAnimeCommand(getAnimeCommand('happy'));
export const highfiveCommand = createAnimeCommand(getAnimeCommand('highfive'));
export const killCommand = createAnimeCommand(getAnimeCommand('kill'));
export const layCommand = createAnimeCommand(getAnimeCommand('lay'));
export const lickCommand = createAnimeCommand(getAnimeCommand('lick'));
export const nomCommand = createAnimeCommand(getAnimeCommand('nom'));
export const pokeCommand = createAnimeCommand(getAnimeCommand('poke'));
export const poutCommand = createAnimeCommand(getAnimeCommand('pout'));
export const slapCommand = createAnimeCommand(getAnimeCommand('slap'));
export const smileCommand = createAnimeCommand(getAnimeCommand('smile'));
export const smugCommand = createAnimeCommand(getAnimeCommand('smug'));
export const tailCommand = createAnimeCommand(getAnimeCommand('tail'));
export const tickleCommand = createAnimeCommand(getAnimeCommand('tickle'));
export const winkCommand = createAnimeCommand(getAnimeCommand('wink'));
export const yeetCommand = createAnimeCommand(getAnimeCommand('yeet'));
export const patearCommand = createAnimeCommand(getAnimeCommand('patear'));
export const nekoCommand = createAnimeCommand(getAnimeCommand('neko'));
export const meguminCommand = createAnimeCommand(getAnimeCommand('megumin'));
export const waifuCommand = createAnimeCommand(getAnimeCommand('waifu'));
export const randomanimeCommand = createAnimeCommand(getAnimeCommand('randomanime'));
export const hnekoCommand = createAnimeCommand(getAnimeCommand('hneko'));
export const hwaifuCommand = createAnimeCommand(getAnimeCommand('hwaifu'));
export const konachanCommand = createAnimeCommand(getAnimeCommand('konachan'));
export const milfCommand = createAnimeCommand(getAnimeCommand('milf'));
export const foxgirlCommand = createAnimeCommand(getAnimeCommand('foxgirl'));
export const gachaCommand = createAnimeCommand(getAnimeCommand('gacha'));
export const hentaividCommand = createAnimeCommand(getAnimeCommand('hentaivid'));
export const maidCommand = createAnimeCommand(getAnimeCommand('maid'));
export const selfieCommand = createAnimeCommand(getAnimeCommand('selfie'));
export const uniformCommand = createAnimeCommand(getAnimeCommand('uniform'));
export const coffeeCommand = createAnimeCommand(getAnimeCommand('coffee'));
export const dogCommand = createAnimeCommand(getAnimeCommand('dog'));
export const duckCommand = createAnimeCommand(getAnimeCommand('duck'));
export const picsumCommand = createAnimeCommand(getAnimeCommand('picsum'));
export const boobsCommand = createAnimeCommand(getAnimeCommand('boobs'));
export const hentaiCommand = createAnimeCommand(getAnimeCommand('hentai'));
export const avatarCommand = createAnimeCommand(getAnimeCommand('avatar'));
export const marinCommand = createAnimeCommand(getAnimeCommand('marin'));
export const moriCommand = createAnimeCommand(getAnimeCommand('mori'));
export const oppaiCommand = createAnimeCommand(getAnimeCommand('oppai'));
export const newsanimeCommand = createAnimeCommand(getAnimeCommand('newsanime'));
export const analCommand = createAnimeCommand(getAnimeCommand('anal'));
export const blowjobCommand = createAnimeCommand(getAnimeCommand('blowjob'));
export const cumCommand = createAnimeCommand(getAnimeCommand('cum'));
export const fuckCommand = createAnimeCommand(getAnimeCommand('fuck'));
export const nekonsfwCommand = createAnimeCommand(getAnimeCommand('nekonsfw'));
export const nekosfwCommand = createAnimeCommand(getAnimeCommand('nekosfw'));
export const pussylickCommand = createAnimeCommand(getAnimeCommand('pussylick'));
export const soloCommand = createAnimeCommand(getAnimeCommand('solo'));
export const yuriCommand = createAnimeCommand(getAnimeCommand('yuri'));
