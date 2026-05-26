import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since');

  if (!since) {
    const count = await prisma.matchComment.count({ where: { matchNumber: 0 } });
    return NextResponse.json({ count });
  }

  const sinceDate = new Date(since);
  const count = await prisma.matchComment.count({
    where: {
      matchNumber: 0,
      createdAt: { gt: sinceDate },
      userId: { not: user.userId },
    },
  });

  return NextResponse.json({ count });
}
