import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { isMatchLocked } from '@/lib/tournament';

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
    for (const pred of predictions) {
      // Skip matches that have already started
      if (isMatchLocked(pred.matchNumber)) {
        skipped.push(pred.matchNumber);
        continue;
      }
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
        },
        create: {
          userId: user.userId,
          matchNumber: pred.matchNumber,
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          advancingTeam: pred.advancingTeam || null,
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
