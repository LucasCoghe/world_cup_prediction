import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

// GET /api/comments?match=1
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const matchNumber = parseInt(searchParams.get('match') || '0');
  if (!matchNumber) {
    return NextResponse.json({ error: 'Match nummer vereist' }, { status: 400 });
  }

  const comments = await prisma.matchComment.findMany({
    where: { matchNumber },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    comments: comments.map(c => ({
      id: c.id,
      userName: c.user.name,
      message: c.message,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

// POST /api/comments
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const { matchNumber, message } = await req.json();
  if (!matchNumber || !message?.trim()) {
    return NextResponse.json({ error: 'Match en bericht vereist' }, { status: 400 });
  }

  // Max 500 characters
  const trimmed = message.trim().slice(0, 500);

  const comment = await prisma.matchComment.create({
    data: {
      userId: user.userId,
      matchNumber,
      message: trimmed,
    },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      userName: comment.user.name,
      message: comment.message,
      createdAt: comment.createdAt.toISOString(),
    },
  });
}
