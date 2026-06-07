import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateMatchPoints } from '@/lib/scoring';
import { MatchScore } from '@/lib/standings';
import { groupMatches, knockoutStructure, teams, TOTAL_GROUP_MATCHES } from '@/lib/tournament';
import { getEquippedCosmeticsForUsers } from '@/lib/coins';

export async function GET() {
  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    include: { predictions: true },
  });

  const actualResults = await prisma.actualResult.findMany();
  if (actualResults.length === 0 || users.length === 0) {
    return NextResponse.json({ schandpaal: [], mvpPerDay: [], streakBeers: {} });
  }

  const actualMap = new Map<number, MatchScore>();
  for (const r of actualResults) {
    actualMap.set(r.matchNumber, {
      matchNumber: r.matchNumber,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
  }

  // Build match info lookup
  const allMatches = [
    ...groupMatches.map(m => ({ matchNumber: m.matchNumber, date: m.date, home: m.home, away: m.away })),
    ...knockoutStructure.map(m => ({ matchNumber: m.matchNumber, date: m.date, home: '', away: '' })),
  ];
  const matchInfoMap = new Map(allMatches.map(m => [m.matchNumber, m]));

  const resultMatchNumbers = new Set(actualResults.map(r => r.matchNumber));

  // === SCHANDPAAL: worst predictions ===
  interface ShameEntry {
    userId: string;
    userName: string;
    matchNumber: number;
    homeTeam: string;
    awayTeam: string;
    predicted: string;
    actual: string;
    shameScore: number;
    date: string;
    cosmetics?: { nameColor: string | null; rowStyle: string | null; title: string | null };
  }
  const shameEntries: ShameEntry[] = [];

  for (const user of users) {
    for (const pred of user.predictions) {
      const actual = actualMap.get(pred.matchNumber);
      if (!actual) continue;

      const matchInfo = matchInfoMap.get(pred.matchNumber);
      if (!matchInfo || !matchInfo.home) continue; // skip knockout for now

      const shameScore = Math.abs(pred.homeScore - actual.homeScore) + Math.abs(pred.awayScore - actual.awayScore);
      // Only include truly shameful predictions (off by 3+ goals total)
      if (shameScore >= 3) {
        const homeTeam = teams[matchInfo.home];
        const awayTeam = teams[matchInfo.away];
        shameEntries.push({
          userId: user.id,
          userName: user.name,
          matchNumber: pred.matchNumber,
          homeTeam: homeTeam ? `${homeTeam.flag} ${homeTeam.name}` : matchInfo.home,
          awayTeam: awayTeam ? `${awayTeam.flag} ${awayTeam.name}` : matchInfo.away,
          predicted: `${pred.homeScore}-${pred.awayScore}`,
          actual: `${actual.homeScore}-${actual.awayScore}`,
          shameScore,
          date: matchInfo.date,
        });
      }
    }
  }
  shameEntries.sort((a, b) => b.shameScore - a.shameScore);
  const schandpaal = shameEntries.slice(0, 15);

  const shameUserIds = [...new Set(schandpaal.map(s => s.userId))];
  const shameCosmetics = await getEquippedCosmeticsForUsers(shameUserIds);
  for (const entry of schandpaal) {
    entry.cosmetics = shameCosmetics.get(entry.userId) || { nameColor: null, rowStyle: null, title: null };
  }

  // === BESCHAMENDE REEKS: 3 consecutive 0-point matches = beer ===
  // Get all match numbers that have results, sorted
  const playedMatchNumbers = [...resultMatchNumbers].sort((a, b) => a - b);

  const streakBeers: Record<string, number> = {};
  for (const user of users) {
    const predMap = new Map<number, MatchScore>();
    for (const p of user.predictions) {
      predMap.set(p.matchNumber, { matchNumber: p.matchNumber, homeScore: p.homeScore, awayScore: p.awayScore });
    }

    let consecutiveZeros = 0;
    let beers = 0;

    for (const matchNum of playedMatchNumbers) {
      const pred = predMap.get(matchNum);
      const actual = actualMap.get(matchNum);
      if (!pred || !actual) {
        // No prediction = 0 points, counts toward streak
        consecutiveZeros++;
      } else {
        const predRecord = user.predictions.find(p => p.matchNumber === matchNum);
        const pts = calculateMatchPoints(pred, actual, predRecord?.jokerUsed, matchNum > TOTAL_GROUP_MATCHES);
        if (pts <= 0) {
          consecutiveZeros++;
        } else {
          consecutiveZeros = 0;
        }
      }

      // Every time they hit a multiple of 3, that's a beer
      if (consecutiveZeros > 0 && consecutiveZeros % 3 === 0) {
        beers++;
      }
    }

    streakBeers[user.id] = beers;
  }

  return NextResponse.json({ schandpaal, streakBeers });
}
