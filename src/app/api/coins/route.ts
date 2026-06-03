import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { syncPredictionCoins, canClaimDaily, claimDailyCoins, DAILY_BONUS, getKeepyUppyDailyStats } from '@/lib/coins';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const balance = await syncPredictionCoins(user.userId);
  const claimAvailable = await canClaimDaily(user.userId);
  const keepyUppyToday = await getKeepyUppyDailyStats(user.userId);

  return NextResponse.json({
    balance,
    canClaimDaily: claimAvailable,
    dailyAmount: DAILY_BONUS,
    keepyUppyToday,
  });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const { action } = await req.json();

  if (action === 'claimDaily') {
    const result = await claimDailyCoins(user.userId);
    return NextResponse.json(result);
  }

  if (action === 'sync') {
    const balance = await syncPredictionCoins(user.userId);
    return NextResponse.json({ balance });
  }

  return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
}

export async function DELETE() {
  const user = await getUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });

  await prisma.user.updateMany({ data: { coinsBalance: 0, predictionPointsClaimed: 0, lastDailyClaim: null } });
  return NextResponse.json({ success: true });
}
