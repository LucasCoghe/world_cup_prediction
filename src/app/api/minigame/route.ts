import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET() {
  const leaderboard = await prisma.minigameScore.findMany({
    orderBy: { score: 'desc' },
    take: 20,
    distinct: ['userId'],
    include: { user: { select: { name: true } } },
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

  return NextResponse.json({
    leaderboard: leaderboard.map(s => ({
      name: s.user.name,
      score: s.score,
    })),
    personalBest,
  });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const { score } = await req.json();
  if (typeof score !== 'number' || score < 0 || score > 10000) {
    return NextResponse.json({ error: 'Ongeldige score' }, { status: 400 });
  }

  await prisma.minigameScore.create({
    data: { userId: user.userId, score: Math.floor(score) },
  });

  return NextResponse.json({ success: true });
}
