import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const results = await prisma.actualResult.findMany({
    select: {
      matchNumber: true,
      homeScore: true,
      awayScore: true,
      advancingTeam: true,
      live: true,
    },
  });
  return NextResponse.json({ results });
}
