import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
  }
  if (target.isAdmin) {
    return NextResponse.json({ error: 'Kan admin niet verwijderen' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.matchComment.deleteMany({ where: { userId: id } }),
    prisma.matchPrediction.deleteMany({ where: { userId: id } }),
    prisma.extraPrediction.deleteMany({ where: { userId: id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.beerConfirmation.deleteMany({ where: { OR: [{ drinkerId: id }, { witnessId: id }] } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
