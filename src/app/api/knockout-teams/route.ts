import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { resolveKnockoutBracket, calculateGroupStandings, clinchedGroupPositions, MatchScore } from '@/lib/standings';
import { groupMatches, knockoutStructure } from '@/lib/tournament';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const actualResults = await prisma.actualResult.findMany();
  const resultSet = new Set(actualResults.map(r => r.matchNumber));

  const actualScores: MatchScore[] = actualResults.map(r => ({
    matchNumber: r.matchNumber,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    advancingTeam: r.advancingTeam || undefined,
  }));

  // Group completeness: all of a group's matches have a result.
  const groupComplete: Record<string, boolean> = {};
  const matchesByGroup: Record<string, number[]> = {};
  for (const m of groupMatches) {
    (matchesByGroup[m.group] ??= []).push(m.matchNumber);
  }
  for (const [group, nums] of Object.entries(matchesByGroup)) {
    groupComplete[group] = nums.every(n => resultSet.has(n));
  }
  // Best-third assignment compares 3rd-placed teams across ALL groups, so it
  // can only be resolved once every group is finished.
  const allGroupsComplete = Object.values(groupComplete).every(Boolean);

  // Resolve group positions (1X / 2X) that are already certain. A finished
  // group uses its final standings; an unfinished group uses only positions
  // that are mathematically clinched regardless of the remaining matches.
  const standings = calculateGroupStandings(actualScores);
  const positionTeam: Record<string, string> = {};
  for (const group of Object.keys(matchesByGroup)) {
    if (groupComplete[group]) {
      const s = standings[group];
      if (s[0]) positionTeam[`1${group}`] = s[0].code;
      if (s[1]) positionTeam[`2${group}`] = s[1].code;
    } else {
      const { first, second } = clinchedGroupPositions(group, actualScores);
      if (first) positionTeam[`1${group}`] = first;
      if (second) positionTeam[`2${group}`] = second;
    }
  }

  // resolveKnockoutBracket resolves 3RD_ / W## / L## sources; we override the
  // group-position sides with the certain-only positionTeam map above.
  const bracket = resolveKnockoutBracket(actualScores);

  function resolveSide(src: string, bracketTeam: string | null): string | null {
    if (/^[12][A-L]$/.test(src)) return positionTeam[src] ?? null;
    if (src.startsWith('3RD_')) return allGroupsComplete ? bracketTeam : null;
    if (src.startsWith('W') || src.startsWith('L')) {
      return resultSet.has(parseInt(src.slice(1))) ? bracketTeam : null;
    }
    return null;
  }

  // Fill each knockout match as soon as BOTH of its sides are certain.
  const teams: Record<number, { homeTeam: string | null; awayTeam: string | null }> = {};
  for (const b of bracket) {
    const km = knockoutStructure.find(m => m.matchNumber === b.matchNumber);
    if (!km) continue;

    const homeTeam = resolveSide(km.homeSource, b.homeTeam);
    const awayTeam = resolveSide(km.awaySource, b.awayTeam);
    if (homeTeam && awayTeam) {
      teams[b.matchNumber] = { homeTeam, awayTeam };
    }
  }

  // Slot-level fills for the bracket simulator: every already-certain group
  // position (1X/2X), the official best-third assignment (only once every
  // group is finished), and the advancing team of every knockout match that
  // has already been played. Lets the simulator start from reality.
  const slots: Record<string, string> = { ...positionTeam };
  if (allGroupsComplete) {
    for (const km of knockoutStructure) {
      const b = bracket.find(x => x.matchNumber === km.matchNumber);
      if (km.homeSource.startsWith('3RD_') && b?.homeTeam) slots[km.homeSource] = b.homeTeam;
      if (km.awaySource.startsWith('3RD_') && b?.awayTeam) slots[km.awaySource] = b.awayTeam;
    }
  }

  const winners: Record<number, string> = {};
  for (const km of knockoutStructure) {
    if (!resultSet.has(km.matchNumber)) continue;
    const b = bracket.find(x => x.matchNumber === km.matchNumber);
    if (!b || !b.homeTeam || !b.awayTeam) continue;
    const r = actualScores.find(x => x.matchNumber === km.matchNumber)!;
    let w: string | null = null;
    if (r.homeScore > r.awayScore) w = b.homeTeam;
    else if (r.awayScore > r.homeScore) w = b.awayTeam;
    else w = r.advancingTeam ?? null;
    if (w) winners[km.matchNumber] = w;
  }

  return NextResponse.json({ teams, slots, winners });
}
