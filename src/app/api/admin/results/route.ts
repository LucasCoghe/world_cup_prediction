import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@wk2026.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET() {
  const results = await prisma.actualResult.findMany({
    orderBy: { matchNumber: 'asc' },
  });
  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const { matchNumber, homeScore, awayScore, advancingTeam } = await req.json();

  // Snapshot beer counts before
  const beforeCounts = new Map<string, number>();
  const beforeGiveCounts = new Map<string, number>();
  const leaderboardBefore = await fetchLeaderboard(req);
  for (const entry of leaderboardBefore) {
    beforeCounts.set(entry.id, entry.beerCount);
    beforeGiveCounts.set(entry.id, entry.beerGiveCount);
  }

  await prisma.actualResult.upsert({
    where: { matchNumber },
    update: { homeScore, awayScore, advancingTeam: advancingTeam || null },
    create: { matchNumber, homeScore, awayScore, advancingTeam: advancingTeam || null },
  });

  // Check beer counts after
  const leaderboardAfter = await fetchLeaderboard(req);
  for (const entry of leaderboardAfter) {
    const before = beforeCounts.get(entry.id) || 0;
    const newBeers = entry.beerCount - before;
    if (newBeers > 0) {
      const newReasons = entry.beerReasons.slice(before);
      await sendPushToUser(entry.id, '🍺 Nieuw biertje!', newBeers === 1
        ? newReasons[0]
        : `${newBeers} nieuwe pintjes! ${newReasons.join(', ')}`);
    }

    const beforeGive = beforeGiveCounts.get(entry.id) || 0;
    const newGives = entry.beerGiveCount - beforeGive;
    if (newGives > 0) {
      await sendPushToUser(entry.id, '🎁 Biertje uitdelen!', 'Je was de beste van de speeldag! Kies iemand die moet drinken.');
    }
  }

  return NextResponse.json({ success: true });
}

async function fetchLeaderboard(req: Request): Promise<{ id: string; name: string; beerCount: number; beerReasons: string[]; beerGiveCount: number; beerGiveReasons: string[] }[]> {
  const baseUrl = new URL(req.url).origin;
  const cookieHeader = req.headers.get('cookie') || '';
  const res = await fetch(`${baseUrl}/api/leaderboard`, {
    headers: { cookie: cookieHeader },
  });
  const data = await res.json();
  return data.leaderboard || [];
}

async function sendPushToUser(userId: string, title: string, body: string) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      );
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }
}
