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

  const { matchNumber, homeScore, awayScore, advancingTeam, live } = await req.json();
  const isLive = live === true;

  // For live saves: just update score, no beer recalc, no pushes.
  // Leaderboard shows live points but skips beer counting until match is finalized.
  if (isLive) {
    await prisma.actualResult.upsert({
      where: { matchNumber },
      update: { homeScore, awayScore, advancingTeam: advancingTeam || null, live: true },
      create: { matchNumber, homeScore, awayScore, advancingTeam: advancingTeam || null, live: true },
    });
    return NextResponse.json({ success: true, live: true });
  }

  // Final save: snapshot beer reasons, write result (live=false), diff and push.
  // Reasons are unique per user (drinkerId_reason is unique), so we diff by the
  // actual reason strings rather than by array index — beerReasons is rebuilt in
  // a fixed order (group dates → knockout rounds → streaks → gifts), so a new
  // reason can be inserted in the middle and a slice would grab the wrong text.
  const beforeReasons = new Map<string, string[]>();
  const beforeGiveReasons = new Map<string, string[]>();
  const leaderboardBefore = await fetchLeaderboard(req);
  for (const entry of leaderboardBefore) {
    beforeReasons.set(entry.id, entry.beerReasons);
    beforeGiveReasons.set(entry.id, entry.beerGiveReasons);
  }

  await prisma.actualResult.upsert({
    where: { matchNumber },
    update: { homeScore, awayScore, advancingTeam: advancingTeam || null, live: false },
    create: { matchNumber, homeScore, awayScore, advancingTeam: advancingTeam || null, live: false },
  });

  // Check beer reasons after — notify on the reasons that are genuinely new.
  const leaderboardAfter = await fetchLeaderboard(req);
  for (const entry of leaderboardAfter) {
    // Gifts ("Cadeau van …") are notified separately at gift-creation time and
    // don't change when a result is finalized, so exclude them here.
    const prev = new Set(beforeReasons.get(entry.id) || []);
    const newReasons = entry.beerReasons.filter(r => !prev.has(r) && !r.startsWith('Cadeau van '));
    if (newReasons.length > 0) {
      await sendPushToUser(entry.id, '🍺 Nieuw biertje!', newReasons.length === 1
        ? newReasons[0]
        : `${newReasons.length} nieuwe pintjes! ${newReasons.join(', ')}`);
    }

    const prevGive = new Set(beforeGiveReasons.get(entry.id) || []);
    const newGiveReasons = entry.beerGiveReasons.filter(r => !prevGive.has(r));
    if (newGiveReasons.length > 0) {
      await sendPushToUser(entry.id, '🎁 Biertje uitdelen!', newGiveReasons.length === 1
        ? `${newGiveReasons[0]} — kies wie er moet drinken!`
        : `${newGiveReasons.length}x mag je een biertje uitdelen: ${newGiveReasons.join(', ')}`);
    }
  }

  return NextResponse.json({ success: true, live: false });
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
