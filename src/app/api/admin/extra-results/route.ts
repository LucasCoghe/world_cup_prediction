import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

const SINGLETON_ID = 'singleton';

const EMPTY = {
  topScorer: '',
  belgianTopScorer: '',
  worldChampion: '',
  topScorerGoals: 0,
  topScorerFirstGoalMin: 0,
};

// De echte antwoorden op de extra vragen zijn publiek leesbaar (nodig voor het
// klassement), maar enkel een admin kan ze invullen/wijzigen.
export async function GET() {
  const result = await prisma.actualExtraResult.findUnique({ where: { id: SINGLETON_ID } });
  return NextResponse.json({ result: result ?? { id: SINGLETON_ID, ...EMPTY } });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Geen admin rechten' }, { status: 403 });
  }

  const body = await req.json();
  const data = {
    topScorer: typeof body.topScorer === 'string' ? body.topScorer.trim() : '',
    belgianTopScorer: typeof body.belgianTopScorer === 'string' ? body.belgianTopScorer.trim() : '',
    worldChampion: typeof body.worldChampion === 'string' ? body.worldChampion.trim() : '',
    topScorerGoals: Number.isFinite(body.topScorerGoals) ? Math.max(0, Math.trunc(body.topScorerGoals)) : 0,
    topScorerFirstGoalMin: Number.isFinite(body.topScorerFirstGoalMin) ? Math.max(0, Math.trunc(body.topScorerFirstGoalMin)) : 0,
  };

  const result = await prisma.actualExtraResult.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });

  return NextResponse.json({ success: true, result });
}
