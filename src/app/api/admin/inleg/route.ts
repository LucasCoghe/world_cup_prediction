import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const { userId, inlegPaid } = await req.json();
  if (typeof userId !== 'string' || typeof inlegPaid !== 'boolean') {
    return NextResponse.json({ error: 'Ongeldige input' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { inlegPaid },
  });

  return NextResponse.json({ success: true });
}
