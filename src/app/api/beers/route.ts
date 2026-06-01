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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const confirmations = await prisma.beerConfirmation.findMany({
    include: {
      drinker: { select: { id: true, name: true } },
      witness: { select: { id: true, name: true } },
    },
    orderBy: { reason: 'asc' },
  });

  const gifts = await prisma.beerGift.findMany({
    include: {
      giver: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ confirmations, gifts });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, drinkerId, reason, confirmationId, receiverId } = await req.json();

  if (action === 'claim') {
    if (user.userId !== drinkerId) {
      return NextResponse.json({ error: 'Je kan alleen je eigen pintje claimen' }, { status: 403 });
    }

    await prisma.beerConfirmation.upsert({
      where: { drinkerId_reason: { drinkerId, reason } },
      create: { drinkerId, reason, claimedAt: new Date() },
      update: { claimedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'witness') {
    const confirmation = await prisma.beerConfirmation.findUnique({
      where: { id: confirmationId },
    });

    if (!confirmation) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    if (!confirmation.claimedAt) return NextResponse.json({ error: 'Nog niet geclaimed' }, { status: 400 });
    if (confirmation.drinkerId === user.userId) {
      return NextResponse.json({ error: 'Je kan niet je eigen getuige zijn' }, { status: 403 });
    }

    await prisma.beerConfirmation.update({
      where: { id: confirmationId },
      data: { witnessId: user.userId, witnessedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'give') {
    if (!reason || !receiverId) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
    }
    if (receiverId === user.userId) {
      return NextResponse.json({ error: 'Je kan jezelf geen biertje geven' }, { status: 400 });
    }

    const existing = await prisma.beerGift.findUnique({
      where: { giverId_reason: { giverId: user.userId, reason } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Al toegewezen voor deze dag' }, { status: 400 });
    }

    const giver = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    await prisma.beerGift.create({
      data: { giverId: user.userId, receiverId, reason },
    });

    const subs = await prisma.pushSubscription.findMany({ where: { userId: receiverId } });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: '🍺 Biertje!', body: `${giver?.name} heeft jou een biertje gegeven!` })
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
