import { Command } from '../Command.js';
import { AnimeBase } from './AnimeBase.js';
import { DeliriusAnimeBase } from './DeliriusAnimeBase.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

type AnimeService = 'animebase' | 'deliriusbase' | 'reactions' | 'nsfw' | 'random' | 'anime';

interface AnimeCommandDef {
  name: string;
  description: string;
  aliases: string[];
  react: string;
  endpoint: string;
  service: AnimeService;
  cooldown?: number;
  enabled?: boolean;
  gifPlayback?: boolean;
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
    service: 'animebase',
  },
  {
    name: 'megumin',
    description: 'Obtiene una imagen aleatoria de Megumin',
    aliases: ['megumin'],
    react: '🔥',
    endpoint: 'megumin',
    service: 'animebase',
  },
  {
    name: 'waifu',
    description: 'Obtiene una imagen aleatoria de waifu',
    aliases: ['waifu'],
    react: '👧',
    endpoint: 'waifu',
    service: 'animebase',
  },
  {
    name: 'randomanime',
    description: 'Obtiene una imagen aleatoria de anime',
    aliases: ['randomanime', 'random_anime'],
    react: '🎲',
    endpoint: 'random',
    service: 'animebase',
  },
  {
    name: 'hneko',
    description: 'Obtiene una imagen aleatoria de hneko NSFW',
    aliases: ['hneko', 'hnekonsfw'],
    react: '😺',
    endpoint: 'hneko',
    service: 'animebase',
    enabled: false,
  },
  {
    name: 'hwaifu',
    description: 'Obtiene una imagen aleatoria de hwaifu NSFW',
    aliases: ['hwaifu'],
    react: '😈',
    endpoint: 'hwaifu',
    service: 'animebase',
    enabled: false,
  },
  {
    name: 'konachan',
    description: 'Obtiene una imagen de Konachan',
    aliases: ['konachan'],
    react: '🖼️',
    endpoint: 'konachan',
    service: 'animebase',
    enabled: false,
  },
  {
    name: 'loli',
    description: 'Obtiene una imagen de loli',
    aliases: ['loli'],
    react: '💢',
    endpoint: 'loli',
    service: 'animebase',
    enabled: false,
  },
  {
    name: 'milf',
    description: 'Obtiene una imagen de milf',
    aliases: ['milf'],
    react: '🍑',
    endpoint: 'milf',
    service: 'animebase',
    enabled: false,
  },

  {
    name: 'foxgirl',
    description: 'Obtiene una imagen de foxgirl',
    aliases: ['foxgirl'],
    react: '🦊',
    endpoint: 'foxgirl',
    service: 'deliriusbase',
  },
  {
    name: 'gacha',
    description: 'Obtiene un personaje aleatorio de gacha',
    aliases: [],
    react: '🎰',
    endpoint: 'gacha',
    service: 'deliriusbase',
  },
  {
    name: 'hentaivid',
    description: 'Obtiene un video hentai aleatorio',
    aliases: ['hentaivideo'],
    react: '🎬',
    endpoint: 'hentaivid',
    service: 'deliriusbase',
  },
  {
    name: 'lolipc',
    description: 'Obtiene una imagen de loli en PC',
    aliases: [],
    react: '🖥️',
    endpoint: 'lolipc',
    service: 'deliriusbase',
  },
  {
    name: 'maid',
    description: 'Obtiene una imagen de maid anime',
    aliases: [],
    react: '👗',
    endpoint: 'maid',
    service: 'deliriusbase',
  },
  {
    name: 'selfie',
    description: 'Obtiene una selfie anime aleatoria',
    aliases: [],
    react: '🤳',
    endpoint: 'selfie',
    service: 'deliriusbase',
  },
  {
    name: 'uniform',
    description: 'Obtiene una imagen de uniforme anime',
    aliases: [],
    react: '👔',
    endpoint: 'uniform',
    service: 'deliriusbase',
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
    name: 'bully',
    description: 'Muestra una imagen de anime bullying',
    aliases: ['bully', 'intimidar'],
    react: '👊',
    endpoint: 'bully',
    service: 'reactions',
  },
  {
    name: 'confy',
    description: 'Muestra una imagen de anime confortable',
    aliases: ['confy', 'confort'],
    react: '😌',
    endpoint: 'confy',
    service: 'reactions',
  },
  {
    name: 'cringe',
    description: 'Muestra una imagen de anime cringe',
    aliases: ['cringe'],
    react: '😬',
    endpoint: 'cringe',
    service: 'reactions',
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
    name: 'eevee',
    description: 'Muestra una imagen de Eevee',
    aliases: ['eevee', 'eve'],
    react: '🐾',
    endpoint: 'eevee',
    service: 'reactions',
  },
  {
    name: 'fluff',
    description: 'Muestra una imagen de anime fluffy',
    aliases: ['fluff'],
    react: '🦊',
    endpoint: 'fluff',
    service: 'reactions',
  },
  {
    name: 'glomp',
    description: 'Muestra una imagen de anime glomp',
    aliases: ['glomp', 'saltar'],
    react: '🤗',
    endpoint: 'glomp',
    service: 'reactions',
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
  },
  {
    name: 'lay',
    description: 'Muestra una imagen de anime recostado',
    aliases: ['lay', 'recostar'],
    react: '🛌',
    endpoint: 'lay',
    service: 'reactions',
  },
  {
    name: 'lick',
    description: 'Muestra una imagen de anime lamiendo',
    aliases: ['lick', 'lamer'],
    react: '👅',
    endpoint: 'lick',
    service: 'reactions',
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
    name: 'tail',
    description: 'Muestra una imagen de anime moviendo la cola',
    aliases: ['tail', 'cola'],
    react: '🐕',
    endpoint: 'tail',
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
    aliases: ['patear', 'kick'],
    react: '🦶',
    endpoint: 'kick',
    service: 'reactions',
  },

  {
    name: 'anal',
    description: 'Imagen NSFW de anal',
    aliases: ['anal'],
    react: '🔞',
    endpoint: 'anal',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'blowjob',
    description: 'Imagen NSFW de blowjob',
    aliases: ['blowjob', 'mamada'],
    react: '🔞',
    endpoint: 'blowjob',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'cum',
    description: 'Imagen NSFW de cum',
    aliases: ['cum', 'semen'],
    react: '🔞',
    endpoint: 'cum',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'fuck',
    description: 'Imagen NSFW de fuck',
    aliases: ['fuck', 'coger'],
    react: '🔞',
    endpoint: 'fuck',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'nekonsfw',
    description: 'Imagen NSFW de neko',
    aliases: ['nekonsfw'],
    react: '🔞',
    endpoint: 'nekonsfw',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'nekosfw',
    description: 'Imagen NSFW de neko',
    aliases: ['nekosfw'],
    react: '🔞',
    endpoint: 'nekosfw',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'pussylick',
    description: 'Imagen NSFW de pussylick',
    aliases: ['pussylick'],
    react: '🔞',
    endpoint: 'pussylick',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'solo',
    description: 'Imagen NSFW de solo',
    aliases: ['solo'],
    react: '🔞',
    endpoint: 'solo',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
  },
  {
    name: 'yuri',
    description: 'Imagen NSFW de yuri',
    aliases: ['yuri'],
    react: '🔞',
    endpoint: 'yuri',
    service: 'reactions',
    enabled: false,
    gifPlayback: true,
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
    name: 'boobs',
    description: 'Obtiene una imagen de tetinas',
    aliases: ['boobs', 'tetas'],
    react: '🔞',
    endpoint: 'boobs',
    service: 'nsfw',
    cooldown: 10000,
    enabled: false,
  },
  {
    name: 'corean',
    description: 'Obtiene una imagen coreana NSFW',
    aliases: ['corean'],
    react: '🔞',
    endpoint: 'corean',
    service: 'nsfw',
    cooldown: 10000,
    enabled: false,
  },
  {
    name: 'girls',
    description: 'Obtiene una imagen de chicas NSFW',
    aliases: ['girls'],
    react: '🔞',
    endpoint: 'girls',
    service: 'nsfw',
    cooldown: 10000,
    enabled: false,
  },
  {
    name: 'hentai',
    description: 'Obtiene una imagen hentai aleatoria',
    aliases: ['hentai'],
    react: '🔞',
    endpoint: 'hentai',
    service: 'nsfw',
    cooldown: 10000,
    enabled: false,
  },

  {
    name: 'avatar',
    description: 'Obtiene un avatar anime aleatorio',
    aliases: ['avataranime'],
    react: '🎭',
    endpoint: 'avatar/delirius?style=pixel-art',
    service: 'anime',
  },
  {
    name: 'marin',
    description: 'Obtiene una imagen de Marin Kitagawa',
    aliases: ['marin_kitagawa'],
    react: '🎀',
    endpoint: 'marin_kitagawa',
    service: 'anime',
    cooldown: 10000,
  },
  {
    name: 'mori',
    description: 'Obtiene una imagen de Mori Calliope',
    aliases: ['mori_calliope'],
    react: '👼',
    endpoint: 'mori_calliope',
    service: 'anime',
    cooldown: 10000,
  },
  {
    name: 'oppai',
    description: 'Obtiene una imagen de oppai',
    aliases: ['oppai'],
    react: '🍈',
    endpoint: 'oppai',
    service: 'anime',
    cooldown: 10000,
  },
  {
    name: 'newsanime',
    description: 'Muestra las últimas noticias de anime',
    aliases: ['anime_news', 'noticiasanime'],
    react: '📰',
    endpoint: 'newsanime',
    service: 'anime',
    cooldown: 10000,
  },
];

const ANIME_COMMANDS_MAP = new Map(ANIME_COMMANDS.map(c => [c.name, c]));
function getAnimeCommand(name: string): AnimeCommandDef {
  const cmd = ANIME_COMMANDS_MAP.get(name);
  if (!cmd) throw new Error(`Anime command '${name}' not found`);
  return cmd;
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
        case 'deliriusbase': {
          await new DeliriusAnimeBase().sendImage(ctx, def.endpoint);
          break;
        }
        case 'reactions': {
          try {
            const imageUrl = await deliriusService.getReactionsImage(def.endpoint);
            await ctx.sock.sendMessage(ctx.chat.jid, {
              video: { url: imageUrl },
              gifPlayback: def.gifPlayback ? true : undefined,
            });
            await ctx.react('✅');
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'nsfw': {
          try {
            const imageUrl = await deliriusService.getNsfwImage(def.endpoint);
            await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'random': {
          try {
            const imageUrl = await deliriusService.getRandomImage(def.endpoint);
            await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
            await ctx.react('✅');
          } catch (error) {
            logError(`[${def.name}Command]`, error);
            await ctx.react('❌');
            await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
          }
          break;
        }
        case 'anime': {
          try {
            const imageUrl = await deliriusService.getAnimeImage(def.endpoint);
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
export const loliCommand = createAnimeCommand(getAnimeCommand('loli'));
export const milfCommand = createAnimeCommand(getAnimeCommand('milf'));
export const foxgirlCommand = createAnimeCommand(getAnimeCommand('foxgirl'));
export const gachaCommand = createAnimeCommand(getAnimeCommand('gacha'));
export const hentaividCommand = createAnimeCommand(getAnimeCommand('hentaivid'));
export const lolipcCommand = createAnimeCommand(getAnimeCommand('lolipc'));
export const maidCommand = createAnimeCommand(getAnimeCommand('maid'));
export const selfieCommand = createAnimeCommand(getAnimeCommand('selfie'));
export const uniformCommand = createAnimeCommand(getAnimeCommand('uniform'));
export const coffeeCommand = createAnimeCommand(getAnimeCommand('coffee'));
export const dogCommand = createAnimeCommand(getAnimeCommand('dog'));
export const duckCommand = createAnimeCommand(getAnimeCommand('duck'));
export const picsumCommand = createAnimeCommand(getAnimeCommand('picsum'));
export const boobsCommand = createAnimeCommand(getAnimeCommand('boobs'));
export const coreanCommand = createAnimeCommand(getAnimeCommand('corean'));
export const girlsCommand = createAnimeCommand(getAnimeCommand('girls'));
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
