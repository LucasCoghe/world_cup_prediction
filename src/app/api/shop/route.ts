import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCosmetic } from '@/lib/cosmetics';
import { syncPredictionCoins, getEquippedCosmetics } from '@/lib/coins';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  await syncPredictionCoins(user.userId);

  const [owned, dbUser, equipped] = await Promise.all([
    prisma.userCosmetic.findMany({
      where: { userId: user.userId },
      select: { cosmeticId: true, equipped: true },
    }),
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { coinsBalance: true },
    }),
    getEquippedCosmetics(user.userId),
  ]);

  return NextResponse.json({
    balance: dbUser?.coinsBalance ?? 0,
    owned: owned.map(o => o.cosmeticId),
    equipped,
  });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const { cosmeticId } = await req.json();
  if (typeof cosmeticId !== 'string') {
    return NextResponse.json({ error: 'Ongeldige cosmetic' }, { status: 400 });
  }

  const cosmetic = getCosmetic(cosmeticId);
  if (!cosmetic) return NextResponse.json({ error: 'Onbekende cosmetic' }, { status: 404 });

  const existing = await prisma.userCosmetic.findUnique({
    where: { userId_cosmeticId: { userId: user.userId, cosmeticId } },
  });
  if (existing) return NextResponse.json({ error: 'Al bezeten' }, { status: 409 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { coinsBalance: true },
  });
  if (!dbUser || dbUser.coinsBalance < cosmetic.price) {
    return NextResponse.json({ error: 'Onvoldoende coins' }, { status: 402 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.userId },
      data: { coinsBalance: { decrement: cosmetic.price } },
    }),
    prisma.userCosmetic.create({
      data: {
        userId: user.userId,
        cosmeticId,
        category: cosmetic.category,
      },
    }),
  ]);

  const updated = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { coinsBalance: true },
  });

  return NextResponse.json({ success: true, balance: updated?.coinsBalance ?? 0 });
}
