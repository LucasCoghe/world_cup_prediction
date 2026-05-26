import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import webpush from 'web-push';
import { groupMatches, knockoutStructure, teams, TOTAL_GROUP_MATCHES } from '@/lib/tournament';

webpush.setVapidDetails(
  'mailto:admin@wk2026.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const allMatches = [
    ...groupMatches.map(m => ({ ...m, round: undefined as string | undefined })),
    ...knockoutStructure.map(m => ({ ...m, home: '', away: '', group: '', round: m.round as string | undefined })),
  ];

  const upcomingMatches = allMatches.filter(m => {
    const kickoff = new Date(`${m.date}T${m.time}:00+02:00`);
    return kickoff > now && kickoff <= endOfDay;
  });

  if (upcomingMatches.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Geen wedstrijden vandaag' });
  }

  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    include: {
      predictions: {
        where: { matchNumber: { in: upcomingMatches.map(m => m.matchNumber) } },
        select: { matchNumber: true },
      },
      pushSubscriptions: true,
    },
  });

  let sent = 0;
  for (const user of users) {
    if (user.pushSubscriptions.length === 0) continue;

    const predictedMatches = new Set(user.predictions.map(p => p.matchNumber));
    const missing = upcomingMatches.filter(m => !predictedMatches.has(m.matchNumber));
    if (missing.length === 0) continue;

    const matchDescriptions = missing.map(m => {
      if (m.matchNumber <= TOTAL_GROUP_MATCHES) {
        const home = teams[m.home]?.name || m.home;
        const away = teams[m.away]?.name || m.away;
        return `${home} - ${away}`;
      }
      return `Knockout #${m.matchNumber}`;
    }).slice(0, 3);

    const body = missing.length === 1
      ? `${matchDescriptions[0]} speelt vandaag! Vul je voorspelling in.`
      : `${missing.length} wedstrijden vandaag! ${matchDescriptions.join(', ')} — vul je voorspellingen in.`;

    for (const sub of user.pushSubscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'Deadline!', body })
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }
  }

  return NextResponse.json({ sent, matches: upcomingMatches.length });
}
