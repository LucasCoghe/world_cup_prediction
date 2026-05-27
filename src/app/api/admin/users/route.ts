import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET() {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      locked: true,
      createdAt: true,
      _count: { select: { predictions: true, pushSubscriptions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}
