import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDBUser } from '@/lib/auth';
import { isMatchLocked, isExtraLocked, TOTAL_GROUP_MATCHES, groupMatches } from '@/lib/tournament';

const MAX_GROUP_JOKERS = 3;
const MAX_KNOCKOUT_JOKERS = 2;

export async function GET() {
  const dbUser = await getDBUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const [predictions, extra] = await Promise.all([
    prisma.matchPrediction.findMany({ where: { userId: dbUser.id } }),
    prisma.extraPrediction.findUnique({ where: { userId: dbUser.id } }),
  ]);

  return NextResponse.json({ predictions, extra, userLocked: dbUser.locked });
}

export async function POST(req: Request) {
  const dbUser = await getDBUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }
  if (dbUser.locked) {
    return NextResponse.json({ error: 'Je voorspellingen zijn vergrendeld' }, { status: 403 });
  }
  const user = { userId: dbUser.id, name: dbUser.name, isAdmin: dbUser.isAdmin };

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

    // Validate: max 1 joker per group
    const matchGroupMap = new Map<number, string>();
    for (const m of groupMatches) matchGroupMap.set(m.matchNumber, m.group);

    const allGroupJokerMatches = [
      ...existingPreds.filter(p => isMatchLocked(p.matchNumber)).map(p => p.matchNumber),
      ...predictions
        .filter((p: { matchNumber: number; jokerUsed?: boolean }) =>
          p.jokerUsed && p.matchNumber <= TOTAL_GROUP_MATCHES && !isMatchLocked(p.matchNumber))
        .map((p: { matchNumber: number }) => p.matchNumber),
    ];
    const jokerGroups = new Set<string>();
    for (const mn of allGroupJokerMatches) {
      const group = matchGroupMap.get(mn);
      if (group) {
        if (jokerGroups.has(group)) {
          return NextResponse.json({ error: `Je mag maximaal 1 joker per groep gebruiken` }, { status: 400 });
        }
        jokerGroups.add(group);
      }
    }

    // Validate knockout jokers
    const existingKnockoutJokers = await prisma.matchPrediction.findMany({
      where: { userId: user.userId, jokerUsed: true, matchNumber: { gt: TOTAL_GROUP_MATCHES } },
      select: { matchNumber: true },
    });
    const lockedKnockoutJokers = existingKnockoutJokers.filter(p => isMatchLocked(p.matchNumber)).length;
    const newKnockoutJokers = predictions.filter(
      (p: { matchNumber: number; jokerUsed?: boolean }) =>
        p.jokerUsed && p.matchNumber > TOTAL_GROUP_MATCHES && !isMatchLocked(p.matchNumber)
    ).length;

    if (lockedKnockoutJokers + newKnockoutJokers > MAX_KNOCKOUT_JOKERS) {
      return NextResponse.json({ error: `Je mag maximaal ${MAX_KNOCKOUT_JOKERS} jokers gebruiken in de knockout` }, { status: 400 });
    }

    for (const pred of predictions) {
      if (isMatchLocked(pred.matchNumber)) {
        skipped.push(pred.matchNumber);
        continue;
      }
      const jokerUsed = pred.jokerUsed ?? false;
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
    // Extra predictions lock at midnight after first match day (end of opening day)
    if (isExtraLocked()) {
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
