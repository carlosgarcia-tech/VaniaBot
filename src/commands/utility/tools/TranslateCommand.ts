import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { primeService } from '@/services/system/PrimeService.js';

interface TranslationResponse {
  responseStatus: number;
  responseDetails?: string;
  responseData: {
    translatedText: string;
    detectedLanguage?: string;
  };
}

export class TranslateCommand extends Command {
  name = 'traducirsimple';
  description = 'Traduce texto a cualquier idioma.';
  category = CommandCategory.UTILITY;
  aliases = ['traducir', 'tsimple'];
  usage = '!traducir <idioma> <texto> | responde un mensaje con !traducir <idioma>';
  examples = [
    '!traducir en Hola mundo',
    '!traducir ja Buenas noches',
    '!traducir fr ¿Cómo estás?',
    '!traducir pt (respondiendo un mensaje)',
  ];
  cooldown = 3000;
  contexts = [CommandContext.BOTH];

  private readonly LANGUAGES: Record<string, string> = {
    es: 'Español',
    en: 'English',
    pt: 'Português',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
    ru: 'Русский',
    ar: 'العربية',
    hi: 'हिन्दी',
    tr: 'Türkçe',
    nl: 'Nederlands',
    pl: 'Polski',
    sv: 'Svenska',
    da: 'Dansk',
    fi: 'Suomi',
    no: 'Norsk',
    uk: 'Українська',
    vi: 'Tiếng Việt',
    th: 'ภาษาไทย',
    id: 'Bahasa Indonesia',
    ms: 'Bahasa Melayu',
    he: 'עברית',
    ro: 'Română',
    hu: 'Magyar',
    cs: 'Čeština',
    el: 'Ελληνικά',
    bg: 'Български',
  };

  private getLangName(code: string): string {
    return this.LANGUAGES[code.toLowerCase()] || code.toUpperCase();
  }

  async translate(
    text: string,
    targetLang: string,
    sourceLang: string = 'auto',
  ): Promise<{ translated: string; detectedLang: string }> {
    const langPair = sourceLang === 'auto' ? `|${targetLang}` : `${sourceLang}|${targetLang}`;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as TranslationResponse;

    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'Error de traducción');
    }

    const translated = data.responseData.translatedText;
    const detectedLang = data.responseData.detectedLanguage || sourceLang;
    return { translated, detectedLang };
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      const langs = Object.entries(this.LANGUAGES)
        .map(([code, name]) => `  *${code}* → ${name}`)
        .join('\n');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *traductor* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo lo usas:*\n` +
          `  ﹒!traducir <código> <texto>\n` +
          `  ﹒o responde a un mensaje\n\n` +
          `✩ *idiomas que entiendo:*\n${langs} ✩`,
      );
      return;
    }

    const targetLang = ctx.args[0].toLowerCase();

    if (!this.LANGUAGES[targetLang]) {
      await ctx.reply(
        `❌ Idioma *"${targetLang}"* no reconocido.\n` +
          `Usa !traducir para ver los idiomas disponibles.`,
      );
      return;
    }

    let textToTranslate = ctx.args.slice(1).join(' ');

    if (!textToTranslate && ctx.quoted) {
      const quotedText =
        ctx.quoted.conversation ||
        ctx.quoted.extendedTextMessage?.text ||
        ctx.quoted.imageMessage?.caption ||
        ctx.quoted.videoMessage?.caption ||
        '';
      textToTranslate = quotedText.trim();
    }

    if (!textToTranslate) {
      await ctx.reply(
        `❌ Debes proporcionar un texto o responder a un mensaje.\n` +
          `Uso: !traducir ${targetLang} <texto>`,
      );
      return;
    }

    if (textToTranslate.length > 500) {
      await ctx.reply('❌ El texto es demasiado largo (máx. 500 caracteres).');
      return;
    }

    await ctx.react('⏳');

    try {
      const { translated, detectedLang } = await this.translate(textToTranslate, targetLang);

      const sourceName = this.getLangName(detectedLang);
      const targetName = this.getLangName(targetLang);

      const msg =
        `🌐 *Traducción*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📥 *De:* ${sourceName}\n` +
        `📤 *A:* ${targetName}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📝 *Original:*\n${textToTranslate}\n\n` +
        `✨ *Traducido:*\n${translated}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📡 ${await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup)}`;

      await ctx.react('✅');
      await ctx.reply(msg);
    } catch (error: unknown) {
      await ctx.react('❌');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error al traducir: ${errorMessage}`);
    }
  }
}
