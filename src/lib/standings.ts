// Calculate group standings from predicted scores
import { groups, groupMatches, knockoutStructure } from './tournament';

export interface TeamStanding {
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface MatchScore {
  matchNumber: number;
  homeScore: number;
  awayScore: number;
  advancingTeam?: string;
}

export function calculateGroupStandings(
  predictions: MatchScore[]
): Record<string, TeamStanding[]> {
  const scoreMap = new Map<number, MatchScore>();
  for (const p of predictions) {
    scoreMap.set(p.matchNumber, p);
  }

  const standings: Record<string, TeamStanding[]> = {};

  for (const [group, teamCodes] of Object.entries(groups)) {
    const teamStats: Record<string, TeamStanding> = {};
    for (const code of teamCodes) {
      teamStats[code] = {
        code,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      };
    }

    const groupGames = groupMatches.filter((m) => m.group === group);
    for (const match of groupGames) {
      const pred = scoreMap.get(match.matchNumber);
      if (!pred) continue;

      const home = teamStats[match.home];
      const away = teamStats[match.away];
      if (!home || !away) continue;

      home.played++;
      away.played++;
      home.goalsFor += pred.homeScore;
      home.goalsAgainst += pred.awayScore;
      away.goalsFor += pred.awayScore;
      away.goalsAgainst += pred.homeScore;

      if (pred.homeScore > pred.awayScore) {
        home.won++;
        home.points += 3;
        away.lost++;
      } else if (pred.homeScore < pred.awayScore) {
        away.won++;
        away.points += 3;
        home.lost++;
      } else {
        home.drawn++;
        away.drawn++;
        home.points += 1;
        away.points += 1;
      }
    }

    // Update goal differences
    for (const t of Object.values(teamStats)) {
      t.goalDiff = t.goalsFor - t.goalsAgainst;
    }

    // Head-to-head record between two teams in this group
    function h2h(a: string, b: string) {
      let aGoals = 0, bGoals = 0, aPoints = 0, bPoints = 0;
      for (const match of groupGames) {
        const pred = scoreMap.get(match.matchNumber);
        if (!pred) continue;
        if (match.home === a && match.away === b) {
          aGoals += pred.homeScore; bGoals += pred.awayScore;
          if (pred.homeScore > pred.awayScore) aPoints += 3;
          else if (pred.homeScore < pred.awayScore) bPoints += 3;
          else { aPoints += 1; bPoints += 1; }
        } else if (match.home === b && match.away === a) {
          bGoals += pred.homeScore; aGoals += pred.awayScore;
          if (pred.homeScore > pred.awayScore) bPoints += 3;
          else if (pred.homeScore < pred.awayScore) aPoints += 3;
          else { aPoints += 1; bPoints += 1; }
        }
      }
      return { aPoints, bPoints, aGoals, bGoals, aGD: aGoals - bGoals, bGD: bGoals - aGoals };
    }

    // Sort with FIFA tiebreakers
    const sorted = Object.values(teamStats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // Head-to-head
      const hh = h2h(a.code, b.code);
      if (hh.bPoints !== hh.aPoints) return hh.bPoints - hh.aPoints;
      if (hh.bGD !== hh.aGD) return hh.bGD - hh.aGD;
      if (hh.bGoals !== hh.aGoals) return hh.bGoals - hh.aGoals;
      if (b.won !== a.won) return b.won - a.won;
      return a.code.localeCompare(b.code);
    });

    standings[group] = sorted;
  }

  return standings;
}

export function getBestThirdPlaced(
  standings: Record<string, TeamStanding[]>
): { team: TeamStanding; group: string }[] {
  const thirdPlaced: { team: TeamStanding; group: string }[] = [];

  for (const [group, teams] of Object.entries(standings)) {
    if (teams[2]) {
      thirdPlaced.push({ team: teams[2], group });
    }
  }

  // Sort 3rd placed teams (FIFA rules: no h2h since they're from different groups)
  thirdPlaced.sort((a, b) => {
    if (b.team.points !== a.team.points) return b.team.points - a.team.points;
    if (b.team.goalDiff !== a.team.goalDiff) return b.team.goalDiff - a.team.goalDiff;
    if (b.team.goalsFor !== a.team.goalsFor) return b.team.goalsFor - a.team.goalsFor;
    if (b.team.won !== a.team.won) return b.team.won - a.team.won;
    return a.group.localeCompare(b.group); // group letter as final fallback
  });

  // Top 8 best 3rd placed teams qualify
  return thirdPlaced.slice(0, 8);
}

export interface KnockoutTeams {
  matchNumber: number;
  homeTeam: string | null;
  awayTeam: string | null;
}

export function resolveKnockoutBracket(
  predictions: MatchScore[]
): KnockoutTeams[] {
  const standingsMap = calculateGroupStandings(predictions);
  const bestThirds = getBestThirdPlaced(standingsMap);

  const scoreMap = new Map<number, MatchScore>();
  for (const p of predictions) {
    scoreMap.set(p.matchNumber, p);
  }

  // Map position codes to team codes
  const positionToTeam: Record<string, string> = {};

  for (const [group, standing] of Object.entries(standingsMap)) {
    if (standing[0]) positionToTeam[`1${group}`] = standing[0].code;
    if (standing[1]) positionToTeam[`2${group}`] = standing[1].code;
  }

  // Pre-solve 3rd-place assignment using backtracking
  // Collect all knockout slots that need a 3rd-placed team
  const thirdSlots: { source: string; allowedGroups: string[] }[] = [];
  for (const km of knockoutStructure) {
    for (const src of [km.homeSource, km.awaySource]) {
      if (src.startsWith('3RD_')) {
        thirdSlots.push({ source: src, allowedGroups: src.slice(4).split('') });
      }
    }
  }

  const thirdAssignment = new Map<string, string>(); // source -> team code
  function solveThirds(idx: number, used: Set<string>): boolean {
    if (idx >= thirdSlots.length) return true;
    const slot = thirdSlots[idx];
    for (const bt of bestThirds) {
      if (slot.allowedGroups.includes(bt.group) && !used.has(bt.team.code)) {
        used.add(bt.team.code);
        thirdAssignment.set(slot.source, bt.team.code);
        if (solveThirds(idx + 1, used)) return true;
        used.delete(bt.team.code);
        thirdAssignment.delete(slot.source);
      }
    }
    return false;
  }
  solveThirds(0, new Set());

  const results: KnockoutTeams[] = [];

  function resolveSource(source: string): string | null {
    if (positionToTeam[source]) return positionToTeam[source];

    if (source.startsWith('3RD_')) {
      return thirdAssignment.get(source) ?? null;
    }

    // Winner reference (e.g., "W73")
    if (source.startsWith('W')) {
      const refMatch = parseInt(source.slice(1));
      const pred = scoreMap.get(refMatch);
      if (!pred) return null;

      const resolved = results.find(r => r.matchNumber === refMatch);
      if (!resolved || !resolved.homeTeam || !resolved.awayTeam) return null;

      if (pred.homeScore > pred.awayScore) return resolved.homeTeam;
      if (pred.awayScore > pred.homeScore) return resolved.awayTeam;
      if (pred.advancingTeam) return pred.advancingTeam;
      return resolved.homeTeam;
    }

    // Loser reference (e.g., "L101")
    if (source.startsWith('L')) {
      const refMatch = parseInt(source.slice(1));
      const pred = scoreMap.get(refMatch);
      if (!pred) return null;

      const resolved = results.find(r => r.matchNumber === refMatch);
      if (!resolved || !resolved.homeTeam || !resolved.awayTeam) return null;

      if (pred.homeScore > pred.awayScore) return resolved.awayTeam;
      if (pred.awayScore > pred.homeScore) return resolved.homeTeam;
      if (pred.advancingTeam) return pred.advancingTeam === resolved.homeTeam ? resolved.awayTeam : resolved.homeTeam;
      return resolved.awayTeam;
    }

    return null;
  }

  for (const km of knockoutStructure) {
    const homeTeam = resolveSource(km.homeSource);
    const awayTeam = resolveSource(km.awaySource);
    results.push({
      matchNumber: km.matchNumber,
      homeTeam,
      awayTeam,
    });
  }

  return results;
}
