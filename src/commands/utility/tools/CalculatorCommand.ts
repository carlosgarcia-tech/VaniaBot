/**
 * CalculatorCommand.ts
 *
 * utility command `calc` — Calculadora avanzada y conversor de unidades.
 * Usage: !calc <expresión> | !calc <valor> <unidad> a <unidad>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { create, all } from 'mathjs';

const math = create(all);

const ALLOWED_FUNCTIONS = [
  'sqrt',
  'abs',
  'ceil',
  'floor',
  'round',
  'sign',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'log',
  'log10',
  'log2',
  'exp',
  'pow',
  'min',
  'max',
  'sum',
  'mean',
  'median',
  'factorial',
  'gamma',
  'combinations',
  'permutations',
];

const ALLOWED_CONSTANTS = [
  'pi',
  'e',
  'phi',
  'tau',
  'lambda',
  'EX',
  'E',
  'LOG2E',
  'LOG10E',
  'SQRT1_2',
  'SQRT2',
];

/** Command handler for `!calc`: Calculadora avanzada y conversor de unidades. */
export class CalculatorCommand extends Command {
  name = 'calc';
  description = 'Calculadora avanzada y conversor de unidades.';
  category = CommandCategory.UTILITY;
  aliases = ['calcular', 'math', 'matematica', 'convertir'];
  usage = '!calc <expresión> | !calc <valor> <unidad> a <unidad>';
  examples = [
    '!calc 15% de 340',
    '!calc (25 * 4) + 100 / 2',
    '!calc 5 km a m',
    '!calc 100 kg a lb',
    '!calc 37 C a F',
    '!calc 1 gb a mb',
  ];
  cooldown = 2000;
  contexts = [CommandContext.BOTH];

  private readonly UNITS: Record<string, Record<string, number>> = {
    longitud: {
      km: 1000,
      m: 1,
      cm: 0.01,
      mm: 0.001,
      mi: 1609.344,
      yd: 0.9144,
      ft: 0.3048,
      in: 0.0254,
      nm: 1852,
    },
    peso: {
      t: 1000,
      kg: 1,
      g: 0.001,
      mg: 0.000001,
      lb: 0.453592,
      oz: 0.028349,
      st: 6.35029,
    },
    volumen: {
      l: 1,
      ml: 0.001,
      cl: 0.01,
      dl: 0.1,
      gal: 3.78541,
      qt: 0.946353,
      pt: 0.473176,
      cup: 0.236588,
      floz: 0.0295735,
      tbsp: 0.0147868,
      tsp: 0.00492892,
    },
    digital: {
      b: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4,
      pb: 1024 ** 5,
    },
    velocidad: {
      'm/s': 1,
      'km/h': 1 / 3.6,
      mph: 0.44704,
      kt: 0.514444,
    },
    area: {
      m2: 1,
      cm2: 0.0001,
      km2: 1_000_000,
      ft2: 0.092903,
      in2: 0.00064516,
      ha: 10000,
      acre: 4046.86,
    },
  };

  private convertTemperature(value: number, from: string, to: string): number | null {
    const f = from.toLowerCase();
    const t = to.toLowerCase();

    let celsius: number;
    if (f === 'c' || f === '°c' || f === 'celsius') celsius = value;
    else if (f === 'f' || f === '°f' || f === 'fahrenheit') celsius = ((value - 32) * 5) / 9;
    else if (f === 'k' || f === 'kelvin') celsius = value - 273.15;
    else return null;

    if (t === 'c' || t === '°c' || t === 'celsius') return celsius;
    if (t === 'f' || t === '°f' || t === 'fahrenheit') return (celsius * 9) / 5 + 32;
    if (t === 'k' || t === 'kelvin') return celsius + 273.15;
    return null;
  }

  private findUnit(unit: string): { category: string; factor: number } | null {
    const u = unit.toLowerCase();
    for (const [category, units] of Object.entries(this.UNITS)) {
      if (u in units) return { category, factor: units[u] };
    }
    return null;
  }

  private convertUnit(
    value: number,
    from: string,
    to: string,
  ): { result: number; category: string } | null {
    const fromUnit = this.findUnit(from);
    const toUnit = this.findUnit(to);

    if (!fromUnit || !toUnit) return null;
    if (fromUnit.category !== toUnit.category) return null;

    const result = (value * fromUnit.factor) / toUnit.factor;
    return { result, category: fromUnit.category };
  }

  private safeEval(expr: string): number {
    const sanitized = expr.replace(/\s+/g, ' ').trim();

    const allowedChars = /^[\d\s\+\-\*\/\(\)\.\%\^\,a-zA-Z_]+$/;
    if (!allowedChars.test(sanitized)) {
      throw new Error('Expresión inválida');
    }

    const withPow = sanitized.replace(/\^/g, '**');

    const percentOfMatch = withPow.match(/^([\d.]+)%\s*de\s*([\d.]+)$/i);
    if (percentOfMatch) {
      return (parseFloat(percentOfMatch[1]) / 100) * parseFloat(percentOfMatch[2]);
    }

    const exprWithPercent = withPow.replace(/([\d.]+)%/g, '($1/100)');

    const scope: Record<string, unknown> = {};
    for (const fn of ALLOWED_FUNCTIONS) {
      scope[fn] = math[fn as keyof typeof math];
    }
    for (const c of ALLOWED_CONSTANTS) {
      try {
        const value = math[c as keyof typeof math];
        if (value !== undefined && value !== null) {
          scope[c] = math.number(value as Parameters<typeof math.number>[0]);
        }
      } catch {
        scope[c] = Math[c as keyof typeof Math] ?? 0;
      }
    }

    const result = math.evaluate(exprWithPercent, scope);

    const numResult =
      typeof result === 'number'
        ? result
        : typeof result === 'object' && result !== null && 'toNumber' in result
          ? (result as { toNumber: () => number }).toNumber()
          : Number(result);

    if (isNaN(numResult) || !isFinite(numResult)) {
      throw new Error('Resultado inválido');
    }

    return numResult;
  }

  private formatResult(n: number): string {
    if (!isFinite(n)) return '∞';
    if (Number.isInteger(n)) return n.toLocaleString('es-MX');
    return parseFloat(n.toFixed(8)).toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *calculadora y conversora* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *qué puedo hacer:*\n` +
          `  ﹒!calc 25 * 4 + 100\n` +
          `  ﹒!calc (5 + 3) ^ 2\n` +
          `  ﹒!calc 15% de 340\n\n` +
          `✩ *convierto cositas:*\n` +
          `  ﹒!calc 5 km a m\n` +
          `  ﹒!calc 100 kg a lb\n` +
          `  ﹒!calc 37 C a F\n` +
          `  ﹒!calc 1 gb a mb\n\n` +
          `♡ *unidades que conozco:*\n` +
          `  ﹒📏 km, m, cm, mm, mi, ft, in\n` +
          `  ﹒⚖️ t, kg, g, lb, oz\n` +
          `  ﹒🌡️ C, F, K\n` +
          `  ﹒💧 l, ml, gal, cup, floz\n` +
          `  ﹒💾 b, kb, mb, gb, tb\n` +
          `  ﹒🏎️ m/s, km/h, mph\n` +
          `  ﹒📐 m2, cm2, km2, ft2, ha, acre`,
      );
      return;
    }

    const input = ctx.args.join(' ').trim();

    const conversionMatch = input.match(/^([\d.,]+)\s+(\S+)\s+a\s+(\S+)$/i);
    if (conversionMatch) {
      const value = parseFloat(conversionMatch[1].replace(',', '.'));
      const fromUnit = conversionMatch[2];
      const toUnit = conversionMatch[3];

      if (isNaN(value)) {
        await ctx.reply('❌ Valor numérico inválido.');
        return;
      }

      const tempResult = this.convertTemperature(value, fromUnit, toUnit);
      if (tempResult !== null) {
        await ctx.react('✅');
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *temperatura* ˚₊· ͟͟͞͞➳\n` +
            `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
            `${value}° ${fromUnit.toUpperCase()} = *${this.formatResult(tempResult)}° ${toUnit.toUpperCase()}*`,
        );
        return;
      }

      const result = this.convertUnit(value, fromUnit, toUnit);
      if (result) {
        const categoryEmojis: Record<string, string> = {
          longitud: '📏',
          peso: '⚖️',
          volumen: '💧',
          digital: '💾',
          velocidad: '🏎️',
          area: '📐',
        };
        const emoji = categoryEmojis[result.category] || '🔄';

        await ctx.react('✅');
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ ${emoji} *${result.category}* ˚₊· ͟͟͞͞➳\n` +
            `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
            `${value} ${fromUnit} = *${this.formatResult(result.result)} ${toUnit}*`,
        );
        return;
      }

      await ctx.reply(
        `❌ No se puede convertir *${fromUnit}* a *${toUnit}*.\n` +
          `Verifica que sean del mismo tipo (longitud, peso, etc.)`,
      );
      return;
    }

    try {
      const result = this.safeEval(input);

      await ctx.react('✅');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *calculadora* ˚₊· ͟͟͞͞➳\n` +
          `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
          `${input}\n` +
          `= *${this.formatResult(result)}*`,
      );
    } catch (error: unknown) {
      await ctx.react('❌');
      logError('[CalculatorCommand] Error', error);
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, no sé calcular eso* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *prueba con estos:*\n` +
          `  ﹒!calc 25 * 4\n` +
          `  ﹒!calc (10 + 5) * 2\n` +
          `  ﹒!calc 15% de 200`,
      );
    }
  }
}
