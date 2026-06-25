import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateMatchPoints } from '@/lib/scoring';
import { MatchScore, resolveKnockoutBracket } from '@/lib/standings';
import { groupMatches, knockoutStructure, TOTAL_GROUP_MATCHES } from '@/lib/tournament';

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', '3P', 'F'] as const;
const ROUND_LABELS: Record<string, string> = {
  R32: '1/16', R16: '1/8', QF: 'KF', SF: 'HF', '3P': 'Troost', F: 'Finale',
};

// Position-over-time history: each player's rank after every completed
// matchday (group phase) and every completed knockout round.
export async function GET() {
  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    include: { predictions: true },
  });

  const actualResults = await prisma.actualResult.findMany();
  // Only finalized results count toward standings checkpoints.
  const finalResults = actualResults.filter(r => !r.live);
  const finalSet = new Set(finalResults.map(r => r.matchNumber));

  const actualScores: MatchScore[] = actualResults.map(r => ({
    matchNumber: r.matchNumber,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    advancingTeam: r.advancingTeam || undefined,
  }));
  const actualScoreMap = new Map<number, MatchScore>();
  for (const a of actualScores) actualScoreMap.set(a.matchNumber, a);

  // Resolve actual knockout bracket once (for shootout-winner detection).
  const actualKoTeams = new Map<number, { home?: string; away?: string }>();
  for (const b of resolveKnockoutBracket(actualScores)) {
    actualKoTeams.set(b.matchNumber, { home: b.homeTeam ?? undefined, away: b.awayTeam ?? undefined });
  }

  // Build ordered checkpoints, each contributing a set of match numbers.
  const checkpoints: { label: string; matchNumbers: number[] }[] = [];

  // Group phase: one checkpoint per date where ALL that date's group matches are final.
  const groupByDate = new Map<string, number[]>();
  for (const m of groupMatches) {
    if (!groupByDate.has(m.date)) groupByDate.set(m.date, []);
    groupByDate.get(m.date)!.push(m.matchNumber);
  }
  const groupDates = [...groupByDate.keys()].sort();
  for (const date of groupDates) {
    const nums = groupByDate.get(date)!;
    if (!nums.every(n => finalSet.has(n))) continue;
    const label = new Date(date + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
    checkpoints.push({ label, matchNumbers: nums });
  }

  // Knockout: one checkpoint per round where ALL round matches are final.
  for (const round of ROUND_ORDER) {
    const nums = knockoutStructure.filter(m => m.round === round).map(m => m.matchNumber);
    if (nums.length === 0 || !nums.every(n => finalSet.has(n))) continue;
    checkpoints.push({ label: ROUND_LABELS[round], matchNumbers: nums });
  }

  // Pre-build prediction lookup per user.
  const predMaps = new Map<string, Map<number, { homeScore: number; awayScore: number; jokerUsed: boolean }>>();
  for (const u of users) {
    const map = new Map<number, { homeScore: number; awayScore: number; jokerUsed: boolean }>();
    for (const p of u.predictions) map.set(p.matchNumber, { homeScore: p.homeScore, awayScore: p.awayScore, jokerUsed: p.jokerUsed });
    predMaps.set(u.id, map);
  }

  // Points a user earned on a single match.
  const matchPointsFor = (userId: string, matchNumber: number): number => {
    const pred = predMaps.get(userId)!.get(matchNumber);
    const actual = actualScoreMap.get(matchNumber);
    if (!pred || !actual) return 0;
    const isKnockout = matchNumber > TOTAL_GROUP_MATCHES;
    const teams = isKnockout ? actualKoTeams.get(matchNumber) : undefined;
    return calculateMatchPoints(
      { matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore },
      actual,
      pred.jokerUsed,
      isKnockout,
      teams?.home,
      teams?.away,
    );
  };

  // Walk checkpoints, accumulate points, snapshot rank each step.
  const cumulative = new Map<string, number>();
  for (const u of users) cumulative.set(u.id, 0);

  const series = new Map<string, { ranks: number[]; points: number[] }>();
  for (const u of users) series.set(u.id, { ranks: [], points: [] });

  for (const cp of checkpoints) {
    for (const u of users) {
      let add = 0;
      for (const n of cp.matchNumbers) add += matchPointsFor(u.id, n);
      cumulative.set(u.id, cumulative.get(u.id)! + add);
    }
    // Rank: points desc, then name asc for a stable, deterministic order.
    const ranked = [...users].sort((a, b) => {
      const diff = cumulative.get(b.id)! - cumulative.get(a.id)!;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
    ranked.forEach((u, i) => {
      const s = series.get(u.id)!;
      s.ranks.push(i + 1);
      s.points.push(cumulative.get(u.id)!);
    });
  }

  const players = users.map(u => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl,
    ranks: series.get(u.id)!.ranks,
    points: series.get(u.id)!.points,
  }));

  return NextResponse.json({
    checkpoints: checkpoints.map(c => c.label),
    players,
  });
}
