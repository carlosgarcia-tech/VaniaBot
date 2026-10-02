/**
 * RotationCache.ts
 *
 * VaniaBot commands module exposing `RotationCache`, `formatAnalysis`, `rotationCache`.
 *
 * @author **Carlos G**
 */

import type { TacticalAnalysis, ScoredRoute } from './RotationSimulator.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

export class RotationCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs = 4 * 60 * 1000, maxSize = 100) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    if (this.store.size >= this.maxSize) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) this.store.delete(oldest[0]);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs, hits: 0 });
  }

  stats() {
    return { size: this.store.size, maxSize: this.maxSize };
  }
}

export const rotationCache = new RotationCache();

const MEDALS = ['🥇', '🥈', '🥉'];
const RISK_ICONS: Record<string, string> = {
  bajo: '🟢',
  medio: '🟡',
  alto: '🟠',
  'muy alto': '🔴',
};
const EDGE_ICONS: Record<string, string> = {
  road: '🛣️',
  bridge: '🌉',
  zipline: '🪂',
  river_crossing: '🌊',
  start: '📍',
};
const PHASE_ICONS: Record<string, string> = {
  early: '🌅',
  mid: '⚡',
  late: '🔥',
};

export function formatAnalysis(
  analysis: TacticalAnalysis,
  scoredRoutes: ScoredRoute[],
  myStartName: string,
  goalName: string,
  myZone: string,
  aiExplanation: string,
): string {
  const lines: string[] = [];
  const phaseIcon = PHASE_ICONS[analysis.circlePhase] ?? '⏱️';

  lines.push(`*ROTACIÓN TÁCTICA — Purgatorio*`);
  lines.push(`*Inicio:* ${myStartName} (Zona ${myZone})`);
  lines.push(`*Cierre:* ${goalName}`);
  lines.push(
    `${phaseIcon} *Fase:* ${analysis.circlePhase.toUpperCase()} — ${analysis.phaseAdvice}`,
  );
  lines.push(``);

  lines.push(`*Amenazas enemigas:*`);
  for (const enemy of analysis.enemyRotations) {
    const eta = enemy.fastestEta < 999 ? `~${enemy.fastestEta}s` : 'sin ruta';
    const routeCount = enemy.probableRoutes.filter(r => r.path.found).length;
    lines.push(
      `• Zona *${enemy.zone}* desde ${enemy.startNodeName} → ETA *${eta}* ` +
        `(${routeCount} rutas probables)`,
    );
  }
  lines.push(``);

  const topConflicts = analysis.conflictZones.slice(0, 3);
  if (topConflicts.length > 0) {
    lines.push(`⚠️ *Puntos de conflicto:*`);
    for (const cz of topConflicts) {
      const riskPct = Math.round(cz.risk * 100);
      lines.push(
        `• ${cz.nodeName} — riesgo *${riskPct}%* ` + `(${cz.proximityTeamCount} equipos en radio)`,
      );
    }
    lines.push(``);
  }

  const validRoutes = scoredRoutes.filter(r => r.path.found).slice(0, 3);
  for (let i = 0; i < validRoutes.length; i++) {
    const sr = validRoutes[i];
    const medal = MEDALS[i] ?? `${i + 1}.`;
    const riskIcon = RISK_ICONS[sr.riskLevel] ?? '⚪';

    lines.push(`${medal} *Ruta ${i + 1} — ${Math.round(sr.score)}/100* ${riskIcon}`);

    const steps = sr.path.steps;
    const show =
      steps.length <= 5
        ? steps
        : [
            ...steps.slice(0, 2),
            {
              nodeId: '...',
              nodeName: '···',
              edgeType: '',
              costFromStart: 0,
              exposure: 0,
            },
            steps[steps.length - 1],
          ];

    const pathStr = show
      .map((s, idx) => {
        if (s.nodeId === '...') return '···';
        const icon = idx === 0 ? '📍' : (EDGE_ICONS[s.edgeType] ?? '➡️');
        return `${icon}${s.nodeName}`;
      })
      .join(' → ');

    lines.push(`• ${pathStr}`);
    lines.push(`• ETA: ~${sr.eta}s | ${riskIcon} Riesgo: *${sr.riskLevel}*`);

    if (sr.highGroundNodes.length > 0) {
      lines.push(`• High ground: ${sr.highGroundNodes.join(', ')}`);
    }
    if (sr.path.chokepoints.length > 0) {
      lines.push(`• Cuellos de botella: ${sr.path.chokepoints.join(', ')}`);
    }
    if (sr.conflictsOnPath.length > 0) {
      lines.push(`• Conflictos directos: ${sr.conflictsOnPath.join(', ')}`);
    }
    if (sr.enemyZonesCrossed.length > 0) {
      lines.push(`• Cruza zona activa: ${sr.enemyZonesCrossed.join(', ')}`);
    }
    lines.push(``);
  }

  if (analysis.worstChokepoint) {
    lines.push(`🚧 *Cuello crítico:* ${analysis.worstChokepoint}`);
  }
  if (analysis.safeApproach) {
    lines.push(`✅ *Aproximación segura:* ${analysis.safeApproach}`);
  }
  lines.push(``);

  lines.push(`💡 *Análisis:*`);
  lines.push(aiExplanation.trim());

  return lines.join('\n');
}
