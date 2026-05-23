import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { isMatchLocked, groupMatches, knockoutStructure } from '@/lib/tournament';

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
  const tournamentStarted = isMatchLocked(1);

  if (!isOwnProfile && !tournamentStarted) {
    return NextResponse.json({ error: 'Voorspellingen zijn pas zichtbaar na de deadline' }, { status: 403 });
  }

  const predictions = await prisma.matchPrediction.findMany({
    where: { userId },
  });

  const extra = await prisma.extraPrediction.findUnique({
    where: { userId },
  });

  const actualResults = await prisma.actualResult.findMany();
  const resultMap = new Map(actualResults.map(r => [r.matchNumber, r]));

  const matchPredictions = predictions.map(p => {
    const gm = groupMatches.find(m => m.matchNumber === p.matchNumber);
    const km = knockoutStructure.find(m => m.matchNumber === p.matchNumber);
    const actual = resultMap.get(p.matchNumber);

    return {
      matchNumber: p.matchNumber,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      advancingTeam: p.advancingTeam,
      group: gm?.group || null,
      round: km?.round || null,
      home: gm?.home || km?.homeSource || '',
      away: gm?.away || km?.awaySource || '',
      actualHome: actual?.homeScore ?? null,
      actualAway: actual?.awayScore ?? null,
    };
  });

  return NextResponse.json({ predictions: matchPredictions, extra, userName: user.name });
}
