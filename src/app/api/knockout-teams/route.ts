import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { resolveKnockoutBracket, MatchScore } from '@/lib/standings';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const actualResults = await prisma.actualResult.findMany();
  const actualScores: MatchScore[] = actualResults.map(r => ({
    matchNumber: r.matchNumber,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    advancingTeam: r.advancingTeam || undefined,
  }));

  const bracket = resolveKnockoutBracket(actualScores);

  const teams: Record<number, { homeTeam: string | null; awayTeam: string | null }> = {};
  for (const b of bracket) {
    if (b.homeTeam && b.awayTeam) {
      teams[b.matchNumber] = { homeTeam: b.homeTeam, awayTeam: b.awayTeam };
    }
  }

  return NextResponse.json({ teams });
}
