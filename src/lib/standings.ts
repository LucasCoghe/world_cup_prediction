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

    // Head-to-head mini-table among a set of teams level on points.
    // Counts ONLY the matches played between members of that set
    // (FIFA WK 2026: head-to-head is applied BEFORE overall goal difference).
    function miniTable(tiedCodes: string[]): Record<string, { points: number; gf: number; ga: number }> {
      const set = new Set(tiedCodes);
      const stats: Record<string, { points: number; gf: number; ga: number }> = {};
      for (const c of tiedCodes) stats[c] = { points: 0, gf: 0, ga: 0 };
      for (const match of groupGames) {
        if (!set.has(match.home) || !set.has(match.away)) continue;
        const pred = scoreMap.get(match.matchNumber);
        if (!pred) continue;
        stats[match.home].gf += pred.homeScore;
        stats[match.home].ga += pred.awayScore;
        stats[match.away].gf += pred.awayScore;
        stats[match.away].ga += pred.homeScore;
        if (pred.homeScore > pred.awayScore) stats[match.home].points += 3;
        else if (pred.homeScore < pred.awayScore) stats[match.away].points += 3;
        else { stats[match.home].points += 1; stats[match.away].points += 1; }
      }
      return stats;
    }

    // Sort with FIFA WK 2026 tiebreakers:
    // 1. points → 2-4. head-to-head (points, GD, goals) among teams level on
    // points → 5. overall GD → 6. overall goals → 7. deterministic fallback
    // (fair-play / FIFA ranking can't be modelled from predictions).
    const allTeams = Object.values(teamStats);
    const sorted = allTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      // Head-to-head among ALL teams sharing this point total (handles 3-way ties).
      const tied = allTeams.filter(t => t.points === a.points).map(t => t.code);
      if (tied.length > 1) {
        const mini = miniTable(tied);
        const ma = mini[a.code], mb = mini[b.code];
        if (mb.points !== ma.points) return mb.points - ma.points;
        const aGD = ma.gf - ma.ga, bGD = mb.gf - mb.ga;
        if (bGD !== aGD) return bGD - aGD;
        if (mb.gf !== ma.gf) return mb.gf - ma.gf;
      }

      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
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

  // Sort 3rd placed teams (FIFA WK 2026: no h2h since they're from different
  // groups). Order: points → goal diff → goals scored → deterministic fallback
  // (fair-play / FIFA ranking can't be modelled from predictions).
  thirdPlaced.sort((a, b) => {
    if (b.team.points !== a.team.points) return b.team.points - a.team.points;
    if (b.team.goalDiff !== a.team.goalDiff) return b.team.goalDiff - a.team.goalDiff;
    if (b.team.goalsFor !== a.team.goalsFor) return b.team.goalsFor - a.team.goalsFor;
    return a.group.localeCompare(b.group); // group letter as final fallback
  });

  // Top 8 best 3rd placed teams qualify
  return thirdPlaced.slice(0, 8);
}

// Determine which final group positions are ALREADY mathematically guaranteed,
// given the results entered so far, even if the group hasn't finished yet.
//
// Sound by construction: a position is only reported when the team holds it in
// EVERY possible win/draw/loss completion of the group's remaining matches,
// decided by points and head-to-head points (both derivable from W/D/L alone).
// Positions that would hinge on goal difference are intentionally left
// unresolved — with unbounded scorelines those can never be guaranteed early.
export function clinchedGroupPositions(
  group: string,
  results: MatchScore[]
): { first: string | null; second: string | null } {
  const teamCodes = groups[group];
  const groupGames = groupMatches.filter((m) => m.group === group);
  const scoreMap = new Map<number, MatchScore>();
  for (const r of results) scoreMap.set(r.matchNumber, r);

  const remaining = groupGames.filter((m) => !scoreMap.has(m.matchNumber));
  const n = remaining.length;

  // Winner of a (possibly hypothetical) match: 0 = home win, 1 = draw, 2 = away win.
  const decidedWinner = new Map<number, number>();
  for (const m of groupGames) {
    const s = scoreMap.get(m.matchNumber);
    if (s) decidedWinner.set(m.matchNumber, s.homeScore > s.awayScore ? 0 : s.homeScore < s.awayScore ? 2 : 1);
  }

  // Across all completions: track which definite ranks each team can hold, and
  // whether any completion left its rank ambiguous (a points+H2H tie).
  const possibleRanks: Record<string, Set<number>> = {};
  const everAmbiguous: Record<string, boolean> = {};
  for (const c of teamCodes) {
    possibleRanks[c] = new Set();
    everAmbiguous[c] = false;
  }

  const winnerInCompletion = new Map<number, number>(decidedWinner);

  for (let mask = 0; mask < 3 ** n; mask++) {
    // Apply this completion's W/D/L to the remaining matches.
    let x = mask;
    for (let i = 0; i < n; i++) {
      winnerInCompletion.set(remaining[i].matchNumber, x % 3);
      x = Math.floor(x / 3);
    }

    const pts: Record<string, number> = {};
    for (const c of teamCodes) pts[c] = 0;
    for (const m of groupGames) {
      const w = winnerInCompletion.get(m.matchNumber)!;
      if (w === 0) pts[m.home] += 3;
      else if (w === 2) pts[m.away] += 3;
      else { pts[m.home] += 1; pts[m.away] += 1; }
    }

    // Head-to-head points among a set of teams level on points.
    const miniPoints = (tied: string[]): Record<string, number> => {
      const set = new Set(tied);
      const mp: Record<string, number> = {};
      for (const c of tied) mp[c] = 0;
      for (const m of groupGames) {
        if (!set.has(m.home) || !set.has(m.away)) continue;
        const w = winnerInCompletion.get(m.matchNumber)!;
        if (w === 0) mp[m.home] += 3;
        else if (w === 2) mp[m.away] += 3;
        else { mp[m.home] += 1; mp[m.away] += 1; }
      }
      return mp;
    };

    for (const t of teamCodes) {
      const samePoints = teamCodes.filter((c) => c !== t && pts[c] === pts[t]);
      let above = teamCodes.filter((c) => c !== t && pts[c] > pts[t]).length;
      let ambiguous = 0;
      if (samePoints.length > 0) {
        const mp = miniPoints([t, ...samePoints]);
        for (const c of samePoints) {
          if (mp[c] > mp[t]) above++;
          else if (mp[c] === mp[t]) ambiguous++; // separable only by goal diff
        }
      }
      if (ambiguous > 0) everAmbiguous[t] = true;
      else possibleRanks[t].add(above + 1);
    }
  }

  // A team clinches rank k iff it was never ambiguous and always landed exactly k.
  const clinchedAt = (k: number): string | null => {
    for (const c of teamCodes) {
      if (!everAmbiguous[c] && possibleRanks[c].size === 1 && possibleRanks[c].has(k)) {
        return c;
      }
    }
    return null;
  };

  return { first: clinchedAt(1), second: clinchedAt(2) };
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
