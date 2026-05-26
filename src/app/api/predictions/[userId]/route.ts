import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { isMatchLocked, groupMatches, knockoutStructure } from '@/lib/tournament';
import { resolveKnockoutBracket, MatchScore } from '@/lib/standings';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const currentUser = await getUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
  }

  const isOwnProfile = currentUser.userId === userId;

  const predictions = await prisma.matchPrediction.findMany({
    where: { userId },
  });

  const extra = await prisma.extraPrediction.findUnique({
    where: { userId },
  });

  const actualResults = await prisma.actualResult.findMany();
  const resultMap = new Map(actualResults.map(r => [r.matchNumber, r]));

  const predScores: MatchScore[] = predictions.map(p => ({
    matchNumber: p.matchNumber,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    advancingTeam: p.advancingTeam || undefined,
  }));
  const bracket = resolveKnockoutBracket(predScores);
  const bracketMap = new Map(bracket.map(b => [b.matchNumber, b]));

  const visiblePredictions = isOwnProfile
    ? predictions
    : predictions.filter(p => isMatchLocked(p.matchNumber));

  const matchPredictions = visiblePredictions.map(p => {
    const gm = groupMatches.find(m => m.matchNumber === p.matchNumber);
    const km = knockoutStructure.find(m => m.matchNumber === p.matchNumber);
    const actual = resultMap.get(p.matchNumber);
    const resolved = bracketMap.get(p.matchNumber);

    return {
      matchNumber: p.matchNumber,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      advancingTeam: p.advancingTeam,
      jokerUsed: p.jokerUsed,
      group: gm?.group || null,
      round: km?.round || null,
      home: gm?.home || km?.homeSource || '',
      away: gm?.away || km?.awaySource || '',
      resolvedHome: resolved?.homeTeam || null,
      resolvedAway: resolved?.awayTeam || null,
      actualHome: actual?.homeScore ?? null,
      actualAway: actual?.awayScore ?? null,
    };
  });

  return NextResponse.json({ predictions: matchPredictions, extra, userName: user.name });
}
