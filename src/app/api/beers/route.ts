import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

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

  return NextResponse.json({ confirmations });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, drinkerId, reason, confirmationId } = await req.json();

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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
