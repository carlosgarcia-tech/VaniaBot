import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

const FILE = path.join(process.cwd(), 'database', 'freefire-torneos.json');

const freeFireFileStore = new JsonFileStore<FreeFireStore>({
  filePath: FILE,
  defaults: () => ({ groups: {} }),
});

const DEFAULT_SCORE_RULES = { win: 3, draw: 1, loss: 0 };
const DEFAULT_FORMAT_RULES = {
  mode: 'clash_squad',
  teamSize: 4,
  roundsBestOf: 7,
  roundsToWin: 4,
  mapsBestOf: 1,
};

interface PlayerEntry {
  jid: string;
  number: string;
  nick: string;
  joinedAt: string;
}

interface Clan {
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  killsFor: number;
  killsAgainst: number;
  createdAt: string;
  players: PlayerEntry[];
  lineup: string[];
}

interface Match {
  id: string;
  clanA: string;
  clanB: string;
  round: string;
  status: 'pendiente' | 'jugado';
  createdAt: string;
  result?: {
    winner: string;
    scoreA: number;
    scoreB: number;
    killsA: number;
    killsB: number;
    by: string;
    at: string;
  };
  format: {
    teamSize: number;
    roundsBestOf: number;
    roundsToWin: number;
    mapsBestOf: number;
  };
}

interface Tournament {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  status: 'activo' | 'cerrado';
  scoreRules: typeof DEFAULT_SCORE_RULES;
  formatRules: typeof DEFAULT_FORMAT_RULES;
  clans: Clan[];
  matches: Match[];
  nextMatchNumber: number;
}

interface FreeFireStore {
  groups: Record<
    string,
    {
      activeTournamentId: string;
      tournaments: Record<string, Tournament>;
    }
  >;
}

function nowIso(): string {
  return new Date().toISOString();
}
function cleanText(v: string): string {
  return String(v || '').trim();
}
function normalizeClanKey(v: string): string {
  return cleanText(v).toLowerCase();
}
function numberFromJid(jid: string): string {
  return jid.split('@')[0].replace(/[^\d]/g, '');
}

export class FreeFireService {
  private store: FreeFireStore;

  constructor() {
    this.store = freeFireFileStore.load();
  }

  private getGroupState(groupId: string) {
    const key = cleanText(groupId);
    if (!this.store.groups[key])
      this.store.groups[key] = { activeTournamentId: '', tournaments: {} };
    return this.store.groups[key];
  }

  private getTournament(groupId: string): Tournament | null {
    const groupState = this.getGroupState(groupId);
    if (!groupState.activeTournamentId) return null;
    return groupState.tournaments[groupState.activeTournamentId] || null;
  }

  getActiveTournament(groupId: string): Tournament | null {
    return this.getTournament(groupId);
  }

  createTournament(groupId: string, name: string, createdBy: string): Tournament {
    const groupState = this.getGroupState(groupId);
    const id = `ff-${Date.now()}`;
    const tournament: Tournament = {
      id,
      name: cleanText(name) || 'Torneo Free Fire',
      createdBy,
      createdAt: nowIso(),
      status: 'activo',
      scoreRules: { ...DEFAULT_SCORE_RULES },
      formatRules: { ...DEFAULT_FORMAT_RULES },
      clans: [],
      matches: [],
      nextMatchNumber: 1,
    };
    groupState.tournaments[id] = tournament;
    groupState.activeTournamentId = id;
    this.save();
    return tournament;
  }

  addClan(groupId: string, clanName: string): Clan | null {
    const tournament = this.getTournament(groupId);
    if (!tournament) return null;
    if (tournament.clans.find(c => normalizeClanKey(c.name) === normalizeClanKey(clanName)))
      return null;
    const clan: Clan = {
      name: cleanText(clanName),
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      killsFor: 0,
      killsAgainst: 0,
      createdAt: nowIso(),
      players: [],
      lineup: [],
    };
    tournament.clans.push(clan);
    this.save();
    return clan;
  }

  removeClan(groupId: string, clanName: string): boolean {
    const tournament = this.getTournament(groupId);
    if (!tournament) return false;
    const index = tournament.clans.findIndex(
      c => normalizeClanKey(c.name) === normalizeClanKey(clanName),
    );
    if (index === -1) return false;
    tournament.clans.splice(index, 1);
    tournament.matches = tournament.matches.filter(
      m =>
        normalizeClanKey(m.clanA) !== normalizeClanKey(clanName) &&
        normalizeClanKey(m.clanB) !== normalizeClanKey(clanName),
    );
    this.save();
    return true;
  }

  addPlayerToClan(groupId: string, clanName: string, jid: string, nick: string): boolean {
    const tournament = this.getTournament(groupId);
    if (!tournament) return false;
    const clan = tournament.clans.find(
      c => normalizeClanKey(c.name) === normalizeClanKey(clanName),
    );
    if (!clan) return false;

    for (const existingClan of tournament.clans) {
      const player = existingClan.players.find(p => p.jid === jid);
      if (player) {
        if (normalizeClanKey(existingClan.name) !== normalizeClanKey(clanName)) {
          existingClan.players = existingClan.players.filter(p => p.jid !== jid);
          existingClan.lineup = existingClan.lineup.filter(l => l !== jid);
        } else {
          player.nick = cleanText(nick) || player.nick;
          this.save();
          return true;
        }
      }
    }

    const player: PlayerEntry = {
      jid,
      number: numberFromJid(jid),
      nick: cleanText(nick) || `Jugador ${clan.players.length + 1}`,
      joinedAt: nowIso(),
    };
    clan.players.push(player);
    this.save();
    return true;
  }

  removePlayer(groupId: string, jid: string): boolean {
    const tournament = this.getTournament(groupId);
    if (!tournament) return false;
    for (const clan of tournament.clans) {
      const index = clan.players.findIndex(p => p.jid === jid);
      if (index !== -1) {
        clan.players.splice(index, 1);
        clan.lineup = clan.lineup.filter(l => l !== jid);
        this.save();
        return true;
      }
    }
    return false;
  }

  createMatch(groupId: string, clanAName: string, clanBName: string, round: string): Match | null {
    const tournament = this.getTournament(groupId);
    if (!tournament) return null;

    const clanA = tournament.clans.find(
      c => normalizeClanKey(c.name) === normalizeClanKey(clanAName),
    );
    const clanB = tournament.clans.find(
      c => normalizeClanKey(c.name) === normalizeClanKey(clanBName),
    );
    if (!clanA || !clanB) return null;

    const { teamSize, roundsBestOf, roundsToWin, mapsBestOf } = tournament.formatRules;
    const match: Match = {
      id: `M${tournament.nextMatchNumber++}`,
      clanA: clanA.name,
      clanB: clanB.name,
      round: cleanText(round) || 'R1',
      status: 'pendiente',
      createdAt: nowIso(),
      format: { teamSize, roundsBestOf, roundsToWin, mapsBestOf },
    };
    tournament.matches.push(match);
    this.save();
    return match;
  }

  setMatchResult(groupId: string, matchId: string, scoreText: string, winner?: string): boolean {
    const tournament = this.getTournament(groupId);
    if (!tournament) return false;

    const match = tournament.matches.find(m => m.id === matchId);
    if (!match || match.status === 'jugado') return false;

    const score = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
    if (!score) return false;

    const scoreA = parseInt(score[1], 10);
    const scoreB = parseInt(score[2], 10);

    const clanA = tournament.clans.find(
      c => normalizeClanKey(c.name) === normalizeClanKey(match.clanA),
    );
    const clanB = tournament.clans.find(
      c => normalizeClanKey(c.name) === normalizeClanKey(match.clanB),
    );
    if (!clanA || !clanB) return false;

    let matchWinner = cleanText(winner || '');
    if (!matchWinner) {
      if (scoreA > scoreB) matchWinner = match.clanA;
      else if (scoreB > scoreA) matchWinner = match.clanB;
      else matchWinner = 'empate';
    }

    const isDraw = matchWinner === 'empate';
    match.status = 'jugado';
    match.result = {
      winner: matchWinner,
      scoreA,
      scoreB,
      killsA: 0,
      killsB: 0,
      by: '',
      at: nowIso(),
    };

    if (isDraw) {
      clanA.draws++;
      clanB.draws++;
      clanA.points += tournament.scoreRules.draw;
      clanB.points += tournament.scoreRules.draw;
    } else if (normalizeClanKey(matchWinner) === normalizeClanKey(match.clanA)) {
      clanA.wins++;
      clanB.losses++;
      clanA.points += tournament.scoreRules.win;
      clanB.points += tournament.scoreRules.loss;
    } else {
      clanB.wins++;
      clanA.losses++;
      clanB.points += tournament.scoreRules.win;
      clanA.points += tournament.scoreRules.loss;
    }

    this.save();
    return true;
  }

  getTable(groupId: string): Clan[] {
    const tournament = this.getTournament(groupId);
    if (!tournament) return [];
    return [...tournament.clans].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const kdA = a.killsFor - a.killsAgainst;
      const kdB = b.killsFor - b.killsAgainst;
      if (kdB !== kdA) return kdB - kdA;
      return a.name.localeCompare(b.name);
    });
  }

  closeTournament(groupId: string): Tournament | null {
    const tournament = this.getTournament(groupId);
    if (!tournament) return null;
    tournament.status = 'cerrado';
    const groupState = this.getGroupState(groupId);
    groupState.activeTournamentId = '';
    this.save();
    return tournament;
  }

  private save(): void {
    freeFireFileStore.save(this.store);
  }
}

export const freeFireService = new FreeFireService();
