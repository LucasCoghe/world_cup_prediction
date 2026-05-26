import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { isMatchLocked, TOTAL_GROUP_MATCHES } from '@/lib/tournament';

const MAX_GROUP_JOKERS = 3;

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const predictions = await prisma.matchPrediction.findMany({
    where: { userId: user.userId },
  });

  const extra = await prisma.extraPrediction.findUnique({
    where: { userId: user.userId },
  });

  return NextResponse.json({ predictions, extra });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  // Check if user is locked
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (dbUser?.locked) {
    return NextResponse.json({ error: 'Je voorspellingen zijn vergrendeld' }, { status: 403 });
  }

  const { predictions, extra } = await req.json();
  const skipped: number[] = [];

  if (predictions && Array.isArray(predictions)) {
    // Count existing jokers for locked group matches (can't be changed)
    const existingPreds = await prisma.matchPrediction.findMany({
      where: { userId: user.userId, jokerUsed: true, matchNumber: { lte: TOTAL_GROUP_MATCHES } },
      select: { matchNumber: true },
    });
    const lockedJokers = existingPreds.filter(p => isMatchLocked(p.matchNumber)).length;

    // Count jokers in this batch for unlocked group matches
    const newGroupJokers = predictions.filter(
      (p: { matchNumber: number; jokerUsed?: boolean }) =>
        p.jokerUsed && p.matchNumber <= TOTAL_GROUP_MATCHES && !isMatchLocked(p.matchNumber)
    ).length;

    if (lockedJokers + newGroupJokers > MAX_GROUP_JOKERS) {
      return NextResponse.json({ error: `Je mag maximaal ${MAX_GROUP_JOKERS} jokers gebruiken in de groepsfase` }, { status: 400 });
    }

    for (const pred of predictions) {
      if (isMatchLocked(pred.matchNumber)) {
        skipped.push(pred.matchNumber);
        continue;
      }
      const jokerUsed = pred.matchNumber <= TOTAL_GROUP_MATCHES ? (pred.jokerUsed ?? false) : false;
      await prisma.matchPrediction.upsert({
        where: {
          userId_matchNumber: {
            userId: user.userId,
            matchNumber: pred.matchNumber,
          },
        },
        update: {
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          advancingTeam: pred.advancingTeam || null,
          jokerUsed,
        },
        create: {
          userId: user.userId,
          matchNumber: pred.matchNumber,
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          advancingTeam: pred.advancingTeam || null,
          jokerUsed,
        },
      });
    }
  }

  let extraLocked = false;
  if (extra) {
    // Extra predictions lock before first match (match 1 kickoff)
    if (isMatchLocked(1)) {
      extraLocked = true;
    } else {
    await prisma.extraPrediction.upsert({
      where: { userId: user.userId },
      update: {
        topScorer: extra.topScorer || '',
        belgianTopScorer: extra.belgianTopScorer || '',
        worldChampion: extra.worldChampion || '',
        topScorerGoals: extra.topScorerGoals || 0,
        topScorerFirstGoalMin: extra.topScorerFirstGoalMin || 0,
      },
      create: {
        userId: user.userId,
        topScorer: extra.topScorer || '',
        belgianTopScorer: extra.belgianTopScorer || '',
        worldChampion: extra.worldChampion || '',
        topScorerGoals: extra.topScorerGoals || 0,
        topScorerFirstGoalMin: extra.topScorerFirstGoalMin || 0,
      },
    });
    }
  }

  return NextResponse.json({ success: true, skipped, extraLocked });
}
