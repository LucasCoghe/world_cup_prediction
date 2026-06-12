import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: Request) {
  const { name, email, password, inviteCode } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Alle velden zijn verplicht' }, { status: 400 });
  }

  // Invite code gate: if INVITE_CODE env is set, registration requires matching code.
  // If env is not set/empty, registration is open (no check).
  const requiredCode = process.env.INVITE_CODE?.trim();
  if (requiredCode) {
    const provided = typeof inviteCode === 'string' ? inviteCode.trim() : '';
    if (provided.toLowerCase() !== requiredCode.toLowerCase()) {
      return NextResponse.json({ error: 'Ongeldige uitnodigingscode' }, { status: 403 });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Dit e-mailadres is al geregistreerd' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });

  const token = signToken({ userId: user.id, name: user.name, isAdmin: user.isAdmin });
  const response = NextResponse.json({ success: true, user: { userId: user.id, name: user.name, isAdmin: user.isAdmin, avatarUrl: user.avatarUrl } });
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
