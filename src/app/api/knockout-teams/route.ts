import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { resolveKnockoutBracket, MatchScore } from '@/lib/standings';
import { TOTAL_GROUP_MATCHES, knockoutStructure } from '@/lib/tournament';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const actualResults = await prisma.actualResult.findMany();
  const resultSet = new Set(actualResults.map(r => r.matchNumber));

  // R32 teams only available when all 72 group matches have results
  const allGroupsComplete = Array.from({ length: TOTAL_GROUP_MATCHES }, (_, i) => i + 1)
    .every(n => resultSet.has(n));

  if (!allGroupsComplete) {
    return NextResponse.json({ teams: {} });
  }

  const actualScores: MatchScore[] = actualResults.map(r => ({
    matchNumber: r.matchNumber,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    advancingTeam: r.advancingTeam || undefined,
  }));

  const bracket = resolveKnockoutBracket(actualScores);

  const teams: Record<number, { homeTeam: string | null; awayTeam: string | null }> = {};
  for (const b of bracket) {
    if (!b.homeTeam || !b.awayTeam) continue;

    const km = knockoutStructure.find(m => m.matchNumber === b.matchNumber);
    if (!km) continue;

    // Check source matches have results (for rounds after R32)
    let sourcesReady = true;
    for (const src of [km.homeSource, km.awaySource]) {
      const refMatch = src.startsWith('W') || src.startsWith('L') ? parseInt(src.slice(1)) : null;
      if (refMatch && !resultSet.has(refMatch)) {
        sourcesReady = false;
        break;
      }
    }

    if (sourcesReady) {
      teams[b.matchNumber] = { homeTeam: b.homeTeam, awayTeam: b.awayTeam };
    }
  }

  return NextResponse.json({ teams });
}
