import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await getUser();
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const { userId, newPassword } = await req.json();

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Gebruiker en wachtwoord zijn verplicht' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  return NextResponse.json({ success: true });
}
