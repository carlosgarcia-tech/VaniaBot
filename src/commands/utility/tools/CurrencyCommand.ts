/**
 * CurrencyCommand.ts
 *
 * utility command `moneda` — Convierte monedas y criptomonedas en tiempo real.
 * Usage: !moneda <cantidad> <de> <a>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

interface FrankfurterResponse {
  rates: Record<string, number>;
}

interface CoinGeckoResponse {
  [key: string]: Record<string, number>;
}

/** Command handler for `!moneda`: Convierte monedas y criptomonedas en tiempo real. */
export class CurrencyCommand extends Command {
  name = 'moneda';
  description = 'Convierte monedas y criptomonedas en tiempo real.';
  category = CommandCategory.UTILITY;
  aliases = ['currency', 'cambio', 'crypto', 'convert'];
  usage = '!moneda <cantidad> <de> <a>';
  examples = [
    '!moneda 100 USD MXN',
    '!moneda 1 BTC USD',
    '!moneda 50 EUR MXN',
    '!moneda 1000 MXN USD',
  ];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  private readonly FIAT_API = 'https://api.frankfurter.app/latest';
  private readonly CRYPTO_API = 'https://api.coingecko.com/api/v3/simple/price';

  private readonly CRYPTO_IDS: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    SOL: 'solana',
    XRP: 'ripple',
    ADA: 'cardano',
    DOGE: 'dogecoin',
    MATIC: 'matic-network',
    DOT: 'polkadot',
    AVAX: 'avalanche-2',
    LINK: 'chainlink',
    UNI: 'uniswap',
    LTC: 'litecoin',
    BCH: 'bitcoin-cash',
    SHIB: 'shiba-inu',
    USDT: 'tether',
    USDC: 'usd-coin',
  };

  private readonly CRYPTO_SYMBOLS = new Set(Object.keys(this.CRYPTO_IDS));

  private isCrypto(symbol: string): boolean {
    return this.CRYPTO_SYMBOLS.has(symbol.toUpperCase());
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
    if (n >= 1)
      return n.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    return n.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  }

  private getCryptoEmoji(symbol: string): string {
    const map: Record<string, string> = {
      BTC: '₿',
      ETH: 'Ξ',
      BNB: '🔶',
      SOL: '◎',
      XRP: '✕',
      DOGE: '🐕',
      USDT: '💵',
      USDC: '💵',
      SHIB: '🐕',
    };
    return map[symbol.toUpperCase()] || '🪙';
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (ctx.args.length < 3) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *conversor de monedas* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usarlo:* !moneda <cantidad> <de> <a>\n\n` +
          `✩ *monedas que manejo:*\n` +
          `  ﹒fiat: USD, EUR, MXN, ARS, COP, CLP, BRL, GBP, JPY...\n` +
          `  ﹒cripto: BTC, ETH, BNB, SOL, DOGE, XRP...\n\n` +
          `♡ *ejemplitos:*\n` +
          `  ﹒!moneda 100 USD MXN\n` +
          `  ﹒!moneda 1 BTC USD\n` +
          `  ﹒!moneda 50 EUR MXN`,
      );
      return;
    }

    const amount = parseFloat(ctx.args[0]);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ La cantidad debe ser un número positivo.');
      return;
    }

    const from = ctx.args[1].toUpperCase();
    const to = ctx.args[2].toUpperCase();

    await ctx.react('⏳');

    try {
      let rate: number;
      let source: string;

      const fromIsCrypto = this.isCrypto(from);
      const toIsCrypto = this.isCrypto(to);

      if (fromIsCrypto || toIsCrypto) {
        const cryptoSymbol = fromIsCrypto ? from : to;
        const fiatSymbol = fromIsCrypto ? to : from;
        const coinId = this.CRYPTO_IDS[cryptoSymbol];

        if (!coinId) {
          await ctx.react('❌');
          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *oops, no conozco ${cryptoSymbol}* ˚₊· ͟͟͞͞➳\n\n` +
              `✿ *mis criptos:* ${[...this.CRYPTO_SYMBOLS].join(', ')}`,
          );
          return;
        }

        const url = `${this.CRYPTO_API}?ids=${coinId}&vs_currencies=${fiatSymbol.toLowerCase()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
        const data = (await res.json()) as CoinGeckoResponse;

        if (!data[coinId]) {
          await ctx.react('❌');
          await ctx.reply(
            `❌ No se pudo obtener precio de *${cryptoSymbol}* en *${fiatSymbol}*.\nVerifica los símbolos.`,
          );
          return;
        }

        const pricePerCoin = data[coinId][fiatSymbol.toLowerCase()];
        if (!pricePerCoin) {
          await ctx.react('❌');
          await ctx.reply(
            `❌ Moneda *${fiatSymbol}* no soportada para cripto.\nUsa: USD, EUR, MXN, BRL, ARS, etc.`,
          );
          return;
        }

        rate = fromIsCrypto ? pricePerCoin : 1 / pricePerCoin;
        source = 'CoinGecko';
      } else {
        const url = `${this.FIAT_API}?from=${from}&to=${to}`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404 || res.status === 422) {
            await ctx.react('❌');
            await ctx.reply(
              `❌ Moneda *${from}* o *${to}* no soportada.\nEjemplos válidos: USD, EUR, MXN, GBP, JPY, BRL, ARS`,
            );
            return;
          }
          throw new Error(`Frankfurter HTTP ${res.status}`);
        }

        const data = (await res.json()) as FrankfurterResponse;
        if (!data.rates?.[to]) {
          await ctx.react('❌');
          await ctx.reply(`❌ No se encontró conversión de *${from}* a *${to}*.`);
          return;
        }

        rate = data.rates[to];
        source = 'Frankfurter';
      }

      const result = amount * rate;
      const fromEmoji = fromIsCrypto ? this.getCryptoEmoji(from) : '💵';
      const toEmoji = toIsCrypto ? this.getCryptoEmoji(to) : '💰';

      const msg =
        `💱 *Conversor de Monedas*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${fromEmoji} *${this.formatNumber(amount)} ${from}*\n` +
        `          ⬇️\n` +
        `${toEmoji} *${this.formatNumber(result)} ${to}*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📊 *Tasa:* 1 ${from} = ${this.formatNumber(rate)} ${to}\n` +
        `🕐 *Actualizado:* ${new Date().toLocaleTimeString('es-MX')}\n` +
        `📡 *Fuente:* ${source}`;

      await ctx.react('✅');
      await ctx.reply(msg);
    } catch (error) {
      await ctx.react('❌');
      logError('[CurrencyCommand] Error', error);
      await ctx.reply('❌ Error al obtener tasas de cambio. Intenta más tarde.');
    }
  }
}
