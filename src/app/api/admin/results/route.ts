import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET() {
  const results = await prisma.actualResult.findMany({
    orderBy: { matchNumber: 'asc' },
  });
  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const { matchNumber, homeScore, awayScore, advancingTeam } = await req.json();

  await prisma.actualResult.upsert({
    where: { matchNumber },
    update: { homeScore, awayScore, advancingTeam: advancingTeam || null },
    create: { matchNumber, homeScore, awayScore, advancingTeam: advancingTeam || null },
  });

  return NextResponse.json({ success: true });
}
