import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import webpush from 'web-push';
import { groupMatches, knockoutStructure, teams } from '@/lib/tournament';

webpush.setVapidDetails(
  'mailto:admin@wk2026.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Cron runs every 15 min via GitHub Actions. For each match starting in
// ~1 hour (kickoff between now+45 and now+75 min) we send one push to every
// non-admin user with at least one push subscription, regardless of whether
// they already predicted — they may still want to adjust before lock.
// A MatchReminderSent row prevents duplicate notifications across overlapping
// cron windows or retries.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 75 * 60 * 1000);

  const allMatches = [
    ...groupMatches.map(m => ({ matchNumber: m.matchNumber, date: m.date, time: m.time, home: m.home, away: m.away, knockout: false })),
    ...knockoutStructure.map(m => ({ matchNumber: m.matchNumber, date: m.date, time: m.time, home: '', away: '', knockout: true })),
  ];

  const dueMatches = allMatches.filter(m => {
    const kickoff = new Date(`${m.date}T${m.time}:00+02:00`);
    return kickoff >= windowStart && kickoff <= windowEnd;
  });

  if (dueMatches.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Geen wedstrijden in 1u-window' });
  }

  const alreadySent = await prisma.matchReminderSent.findMany({
    where: { matchNumber: { in: dueMatches.map(m => m.matchNumber) } },
    select: { matchNumber: true },
  });
  const sentSet = new Set(alreadySent.map(r => r.matchNumber));
  const todo = dueMatches.filter(m => !sentSet.has(m.matchNumber));

  if (todo.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Alle reminders al verstuurd' });
  }

  const users = await prisma.user.findMany({
    where: { isAdmin: false, locked: false },
    include: { pushSubscriptions: true },
  });

  let sent = 0;
  for (const match of todo) {
    const label = match.knockout
      ? `Knockout #${match.matchNumber}`
      : `${teams[match.home]?.name || match.home} - ${teams[match.away]?.name || match.away}`;

    const body = `${label} begint over een uur — laatste kans om je voorspelling aan te passen!`;
    const payload = JSON.stringify({ title: 'Deadline over 1 uur!', body });

    for (const user of users) {
      for (const sub of user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
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

    await prisma.matchReminderSent.create({ data: { matchNumber: match.matchNumber } });
  }

  return NextResponse.json({ sent, matches: todo.map(m => m.matchNumber) });
}
