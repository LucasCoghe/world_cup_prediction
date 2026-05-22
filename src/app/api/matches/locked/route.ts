import { NextResponse } from 'next/server';
import { getLockedMatches } from '@/lib/tournament';

export async function GET() {
  const locked = getLockedMatches();
  return NextResponse.json({ locked: Array.from(locked) });
}
