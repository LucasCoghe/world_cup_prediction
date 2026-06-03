import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { awardKeepyUppyCoins, getEquippedCosmeticsForUsers } from '@/lib/coins';

export async function GET() {
  const leaderboard = await prisma.minigameScore.findMany({
    orderBy: { score: 'desc' },
    take: 20,
    distinct: ['userId'],
    include: { user: { select: { id: true, name: true } } },
  });

  const user = await getUser();
  let personalBest: number | null = null;
  if (user) {
    const best = await prisma.minigameScore.findFirst({
      where: { userId: user.userId },
      orderBy: { score: 'desc' },
    });
    personalBest = best?.score ?? null;
  }

  const userIds = [...new Set(leaderboard.map(s => s.user.id))];
  const cosmeticsByUser = await getEquippedCosmeticsForUsers(userIds);

  return NextResponse.json({
    leaderboard: leaderboard.map(s => ({
      name: s.user.name,
      score: s.score,
      cosmetics: cosmeticsByUser.get(s.user.id) || { nameColor: null, rowStyle: null, title: null },
    })),
    personalBest,
  });
}

const MAX_SCORE = 200;
const MIN_SECONDS_PER_POINT = 0.8;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const { score } = await req.json();
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > MAX_SCORE) {
    return NextResponse.json({ error: 'Ongeldige score' }, { status: 400 });
  }

  const lastSubmission = await prisma.minigameScore.findFirst({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
  });

  if (lastSubmission) {
    const secondsSince = (Date.now() - lastSubmission.createdAt.getTime()) / 1000;
    if (secondsSince < score * MIN_SECONDS_PER_POINT) {
      return NextResponse.json({ error: 'Te snel gespeeld' }, { status: 429 });
    }
  }

  await prisma.minigameScore.create({
    data: { userId: user.userId, score },
  });
  const result = await awardKeepyUppyCoins(user.userId, score);

  return NextResponse.json({ success: true, coinsEarned: result.awarded, dayBest: result.dayBest });
}

export async function DELETE() {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const deleted = await prisma.minigameScore.deleteMany({
    where: { score: { gt: MAX_SCORE } },
  });

  return NextResponse.json({ deleted: deleted.count });
}
