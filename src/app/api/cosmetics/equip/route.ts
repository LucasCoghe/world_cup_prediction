import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCosmetic, CosmeticCategory } from '@/lib/cosmetics';

const VALID_CATEGORIES: CosmeticCategory[] = ['name_color', 'row_style', 'title'];

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const body = await req.json();
  const cosmeticId: string | null = body.cosmeticId ?? null;
  const category: CosmeticCategory | undefined = body.category;

  if (cosmeticId === null) {
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Categorie vereist' }, { status: 400 });
    }
    await prisma.userCosmetic.updateMany({
      where: { userId: user.userId, category, equipped: true },
      data: { equipped: false },
    });
    return NextResponse.json({ success: true, equipped: null });
  }

  const cosmetic = getCosmetic(cosmeticId);
  if (!cosmetic) return NextResponse.json({ error: 'Onbekende cosmetic' }, { status: 404 });

  const owned = await prisma.userCosmetic.findUnique({
    where: { userId_cosmeticId: { userId: user.userId, cosmeticId } },
  });
  if (!owned) return NextResponse.json({ error: 'Niet bezeten' }, { status: 403 });

  await prisma.$transaction([
    prisma.userCosmetic.updateMany({
      where: { userId: user.userId, category: cosmetic.category, equipped: true },
      data: { equipped: false },
    }),
    prisma.userCosmetic.update({
      where: { userId_cosmeticId: { userId: user.userId, cosmeticId } },
      data: { equipped: true },
    }),
  ]);

  return NextResponse.json({ success: true, equipped: cosmeticId });
}
