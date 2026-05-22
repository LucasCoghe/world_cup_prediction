import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, locked: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
  }

  // Only show predictions if the user is locked (submitted)
  if (!user.locked) {
    return NextResponse.json({ error: 'Voorspellingen nog niet ingediend' }, { status: 403 });
  }

  const predictions = await prisma.matchPrediction.findMany({
    where: { userId },
  });

  const extra = await prisma.extraPrediction.findUnique({
    where: { userId },
  });

  return NextResponse.json({ predictions, extra, userName: user.name });
}
