import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { getEquippedCosmeticsForUsers } from '@/lib/coins';

// GET /api/comments?match=1
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const matchParam = searchParams.get('match');
  if (matchParam === null) {
    return NextResponse.json({ error: 'Match nummer vereist' }, { status: 400 });
  }
  const matchNumber = parseInt(matchParam);

  const comments = await prisma.matchComment.findMany({
    where: { matchNumber },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const userIds = [...new Set(comments.map(c => c.user.id))];
  const cosmeticsByUser = await getEquippedCosmeticsForUsers(userIds);

  return NextResponse.json({
    comments: comments.map(c => ({
      id: c.id,
      userId: c.user.id,
      userName: c.user.name,
      avatarUrl: c.user.avatarUrl,
      message: c.message,
      createdAt: c.createdAt.toISOString(),
      cosmetics: cosmeticsByUser.get(c.user.id) || { nameColor: null, rowStyle: null, title: null },
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
  if (matchNumber === undefined || matchNumber === null || !message?.trim()) {
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
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const cosmeticsByUser = await getEquippedCosmeticsForUsers([comment.user.id]);

  return NextResponse.json({
    comment: {
      id: comment.id,
      userId: comment.user.id,
      userName: comment.user.name,
      avatarUrl: comment.user.avatarUrl,
      message: comment.message,
      createdAt: comment.createdAt.toISOString(),
      cosmetics: cosmeticsByUser.get(comment.user.id) || { nameColor: null, rowStyle: null, title: null },
    },
  });
}
