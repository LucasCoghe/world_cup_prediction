import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import webpush from 'web-push';
import { groupMatches, knockoutStructure, teams, TOTAL_GROUP_MATCHES } from '@/lib/tournament';

webpush.setVapidDetails(
  'mailto:admin@wk2026.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: 'Alleen admin' }, { status: 403 });
  }

  const { type, title, body, test } = await req.json();

  if (type === 'deadline') {
    return await sendDeadlineReminders(!!test);
  }

  if (type === 'custom') {
    return await sendToAll(title || 'WK 2026', body || 'Check de app!');
  }

  if (type === 'final') {
    return await sendFinalStandings(req);
  }

  return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 });
}

// Nederlandse rangtelwoorden: -ste voor 1, 8 en de tientallen vanaf 20
// (twintigste, dertigste ...), -de voor de rest (2de, 3de, 10de, 14de ...).
function dutchOrdinal(n: number): string {
  const ste = n === 1 || n === 8 || (n >= 20 && n % 10 === 0);
  return `${n}${ste ? 'ste' : 'de'}`;
}

// Stuurt elke speler een gepersonaliseerde push met zijn finale plaats en een
// link naar het persoonlijke eindoverzicht. Bedoeld om te versturen zodra de
// admin de extra vragen heeft ingevuld en het toernooi is afgelopen.
async function sendFinalStandings(req: Request): Promise<Response> {
  const baseUrl = new URL(req.url).origin;
  const cookieHeader = req.headers.get('cookie') || '';
  const res = await fetch(`${baseUrl}/api/leaderboard`, { headers: { cookie: cookieHeader } });
  const data = await res.json();
  const board: { id: string; totalPoints: number }[] = data.leaderboard || [];

  if (board.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Geen klassement beschikbaar' });
  }

  const rankById = new Map<string, number>();
  board.forEach((e, i) => rankById.set(e.id, i + 1));

  const subs = await prisma.pushSubscription.findMany();
  let sent = 0;
  for (const sub of subs) {
    const rank = rankById.get(sub.userId);
    if (!rank) continue;
    const ordinal = dutchOrdinal(rank);
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `Eindstand: ${ordinal} plaats!`,
          body: `Je eindigde ${ordinal} van de ${board.length}. Check je stats over het hele toernooi!`,
          url: '/?tab=season',
        })
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }

  return NextResponse.json({ sent, players: board.length });
}

async function sendDeadlineReminders(test = false) {
  const allMatches = [
    ...groupMatches.map(m => ({ ...m, round: undefined as string | undefined })),
    ...knockoutStructure.map(m => ({ ...m, home: '', away: '', group: '', round: m.round as string | undefined })),
  ];

  let upcomingMatches;
  if (test) {
    upcomingMatches = allMatches.slice(0, 3);
  } else {
    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    upcomingMatches = allMatches.filter(m => {
      const kickoff = new Date(`${m.date}T${m.time}:00+02:00`);
      return kickoff > now && kickoff <= soon;
    });
  }

  if (upcomingMatches.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Geen wedstrijden binnen het uur' });
  }

  // Get users who haven't predicted these matches
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
      ? `${matchDescriptions[0]} begint zo! Vul je voorspelling in.`
      : `${missing.length} wedstrijden beginnen zo! ${matchDescriptions.join(', ')}`;

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

async function sendToAll(title: string, body: string) {
  const subs = await prisma.pushSubscription.findMany();
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }

  return NextResponse.json({ sent });
}
