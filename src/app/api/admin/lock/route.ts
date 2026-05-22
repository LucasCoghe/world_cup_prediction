import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const { userId, locked } = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: { locked },
  });

  return NextResponse.json({ success: true });
}

// Lock all users
export async function PUT(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  await prisma.user.updateMany({
    where: { isAdmin: false },
    data: { locked: true },
  });

  return NextResponse.json({ success: true });
}
