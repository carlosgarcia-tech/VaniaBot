import { Command } from '../../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import { logger } from '@/utils/logger.js';

import {
  parseCoord,
  nearestNode,
  resolveNodeId,
  coordToString,
  NODES,
} from '../map/Purgatoriomap.js';
import {
  runTacticalAnalysis,
  scoreRoutes,
  buildCacheKey,
  type TacticalAnalysis,
  type ScoredRoute,
  type ZoneId,
} from '../services/RotationSimulator.js';
import { rotationCache, formatAnalysis } from '../services/RotationCache.js';

interface ResolvedNode {
  nodeId: string;
  label: string;
}

function resolveInput(raw: string): ResolvedNode | null {
  const byAlias = resolveNodeId(raw);
  if (byAlias) return { nodeId: byAlias, label: NODES[byAlias].name };

  const coord = parseCoord(raw);
  if (coord) {
    const node = nearestNode(coord);
    return {
      nodeId: node.id,
      label: `${coordToString(coord)} (≈ ${node.name})`,
    };
  }
  return null;
}

function inferZone(nodeId: string): ZoneId {
  return (NODES[nodeId]?.zone ?? 'CENTER') as ZoneId;
}

function buildAIPrompt(
  analysis: TacticalAnalysis,
  scored: ScoredRoute[],
  myZone: string,
  goalName: string,
): string {
  const top = scored[0];
  const phase = analysis.circlePhase;

  const enemySummary = analysis.enemyRotations
    .map(e => `Z${e.zone}:ETA${e.fastestEta < 999 ? e.fastestEta + 's' : 'bloqueado'}`)
    .join(' | ');

  const topConflicts = analysis.conflictZones
    .slice(0, 2)
    .map(c => `${c.nodeName}(${Math.round(c.risk * 100)}%)`)
    .join(', ');

  const routeSummary = scored
    .slice(0, 3)
    .filter(r => r.path.found)
    .map((r, i) => `R${i + 1}:${Math.round(r.score)}pts/${r.eta}s/${r.riskLevel}`)
    .join(' | ');

  return (
    `Analista táctico Free Fire, Purgatorio. Solo genera explicación, cálculos ya hechos.\n` +
    `Zona:${myZone} Cierre:${goalName} Fase:${phase}\n` +
    `Enemigos: ${enemySummary}\n` +
    `Conflictos: ${topConflicts || 'ninguno crítico'}\n` +
    `Rutas: ${routeSummary}\n` +
    `Mejor ruta: score ${Math.round(top?.score ?? 0)}, ETA ${top?.eta ?? 0}s\n` +
    `High ground en ruta: ${top?.highGroundNodes?.join(',') || 'ninguno'}\n\n` +
    `Explica en 3 frases cortas: (1) por qué esa ruta es la mejor, ` +
    `(2) qué enemigo es la mayor amenaza y dónde, ` +
    `(3) cómo posicionarse al llegar. Sin encabezados. Máx 80 palabras.`
  );
}

const HELP =
  `❌ *Formato incorrecto*\n\n` +
  `Uso: *!r cuadri [posición] [cierre] [equipos?]*\n\n` +
  `*Inputs válidos:*\n` +
  `• Coordenada: *6,e* / *e6* / *E,6*\n` +
  `• Alias: *brasilia · forge · golf · crossroads*\n` +
  `  *ski · moathouse · fire · lumber · campsite*\n` +
  `  *marbleworks · quarry · villa · central*\n\n` +
  `*Ejemplos:*\n` +
  `• !r cuadri 8,d 6,e\n` +
  `• !r cuadri golf brasilia\n` +
  `• !r cuadri marbleworks forge 3\n` +
  `• !r cuadri 4,i fire\n\n` +
  `*Grid: columnas A-I (oeste→este), filas 1-10 (norte→sur)*\n` +
  `Brasilia:6,E · Crossroads:2,C · Ski:4,I · Forge:6,I\n` +
  `Golf:7,C · Marble:4,C · Central:9,D · Fire:9,F · Lumber:9,H`;

export class RotacionCommand extends Command {
  name = 'r cuadri';
  description = 'Motor de rotación táctica — Purgatorio (Free Fire)';
  category = CommandCategory.UTILITY;
  aliases = ['rot cuadri', 'rotacion cuadri'];
  usage = '!r cuadri [posición] [cierre] [equipos?]';
  examples = [
    '!r cuadri 8,d 6,e',
    '!r cuadri golf brasilia',
    '!r cuadri marbleworks forge 3',
    '!r cuadri 4,i fire',
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const [arg1, arg2, arg3] = ctx.args;

    if (!arg1 || !arg2) {
      await ctx.reply(HELP);
      return;
    }

    const start = resolveInput(arg1);
    const goal = resolveInput(arg2);
    const teamCount = arg3 ? Math.min(4, Math.max(2, parseInt(arg3) || 4)) : 4;

    if (!start) {
      await ctx.reply(`❌ Posición no reconocida: *${arg1}*\n\n${HELP}`);
      return;
    }
    if (!goal) {
      await ctx.reply(`❌ Cierre no reconocido: *${arg2}*\n\n${HELP}`);
      return;
    }

    if (start.nodeId === goal.nodeId) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *ya estás a salvo* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ estás en *${start.label}*\n` +
          `✩ quédate quietecita y cuídate ✩`,
      );
      return;
    }

    try {
      await ctx.react('🗺️');
    } catch (error) {
      logger.debug('[RotacionCommand] React failed:', error);
    }

    const myZone = inferZone(start.nodeId);

    const analysis = runTacticalAnalysis(start.nodeId, goal.nodeId, myZone);
    const cacheKey = buildCacheKey(start.nodeId, goal.nodeId, analysis.circlePhase, teamCount);

    const cached = rotationCache.get<string>(cacheKey);
    if (cached) {
      await ctx.sock.sendMessage(ctx.chat.jid, { text: cached }, { quoted: ctx.message });
      return;
    }

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ _calculando..._ ˚₊· ͟͟͞͞➳\n` +
        `✩ *${start.label}* → 🌸 *${goal.label}*\n` +
        `✿ ${teamCount} equipos | fase: *${analysis.circlePhase}*`,
    );

    const scored = scoreRoutes(
      analysis.myRoutes,
      analysis.conflictZones,
      analysis.enemyRotations,
      analysis.circlePhase,
    );

    const prompt = buildAIPrompt(analysis, scored, myZone, goal.label);
    const aiResp = await aiService.generate(prompt, 200);
    const aiText = isRight(aiResp) ? aiResp.right : 'Análisis calculado por motor táctico.';

    const result = formatAnalysis(analysis, scored, start.label, goal.label, myZone, aiText);

    rotationCache.set(cacheKey, result);

    await ctx.sock.sendMessage(ctx.chat.jid, { text: result }, { quoted: ctx.message });
  }
}

export default RotacionCommand;
