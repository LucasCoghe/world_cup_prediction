import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { awardKeepyUppyCoins, getEquippedCosmeticsForUsers } from '@/lib/coins';

const SECRET = process.env.JWT_SECRET || 'wk-pronostiek-2026-secret-key-change-me';
const MAX_SESSION_AGE_MS = 30 * 60 * 1000; // 30 min between /start and /submit

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

  const { score, startTime, nonce, signature } = await req.json();
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > MAX_SCORE) {
    return NextResponse.json({ error: 'Ongeldige score' }, { status: 400 });
  }

  // Verify HMAC-signed session token issued by /api/minigame/start.
  // Prevents direct score submissions without playing the game.
  if (typeof startTime !== 'number' || !Number.isInteger(startTime) || typeof nonce !== 'string' || typeof signature !== 'string') {
    return NextResponse.json({ error: 'Ontbrekend sessie-token' }, { status: 400 });
  }

  const payload = `${user.userId}:${startTime}:${nonce}`;
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  let signatureValid = false;
  try {
    const provided = Buffer.from(signature, 'hex');
    const exp = Buffer.from(expected, 'hex');
    signatureValid = provided.length === exp.length && timingSafeEqual(provided, exp);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return NextResponse.json({ error: 'Ongeldig sessie-token' }, { status: 400 });
  }

  const now = Date.now();
  if (startTime > now || now - startTime > MAX_SESSION_AGE_MS) {
    return NextResponse.json({ error: 'Verlopen sessie' }, { status: 400 });
  }

  const elapsedSec = (now - startTime) / 1000;
  if (elapsedSec < score * MIN_SECONDS_PER_POINT) {
    return NextResponse.json({ error: 'Te snel gespeeld' }, { status: 429 });
  }

  // Replay prevention: each user's sessionStart must strictly increase.
  // Replaying a captured (startTime, nonce, signature) trio fails this check.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { lastMinigameStart: true },
  });
  if (dbUser?.lastMinigameStart && startTime <= dbUser.lastMinigameStart.getTime()) {
    return NextResponse.json({ error: 'Sessie al gebruikt' }, { status: 400 });
  }

  await prisma.minigameScore.create({
    data: { userId: user.userId, score },
  });
  await prisma.user.update({
    where: { id: user.userId },
    data: { lastMinigameStart: new Date(startTime) },
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
