import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { getLockedMatches } from '@/lib/tournament';

// Returns all users' predictions for matches that are locked (started) OR have a result
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  // Matches are visible if kicked off OR if admin already entered a result
  const locked = getLockedMatches();
  const actualResults = await prisma.actualResult.findMany({ select: { matchNumber: true } });
  const visibleMatches = new Set([...locked, ...actualResults.map(r => r.matchNumber)]);

  if (visibleMatches.size === 0) {
    return NextResponse.json({ predictions: {} });
  }

  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    select: { id: true, name: true },
  });

  const predictions = await prisma.matchPrediction.findMany({
    where: {
      userId: { in: users.map(u => u.id) },
      matchNumber: { in: [...visibleMatches] },
    },
    select: {
      userId: true,
      matchNumber: true,
      homeScore: true,
      awayScore: true,
    },
  });

  // Group predictions by match number
  const byMatch: Record<number, { userName: string; homeScore: number; awayScore: number }[]> = {};
  const userMap = new Map(users.map(u => [u.id, u.name]));

  for (const p of predictions) {
    if (!byMatch[p.matchNumber]) byMatch[p.matchNumber] = [];
    byMatch[p.matchNumber].push({
      userName: userMap.get(p.userId) || '?',
      homeScore: p.homeScore,
      awayScore: p.awayScore,
    });
  }

  return NextResponse.json({ predictions: byMatch });
}
