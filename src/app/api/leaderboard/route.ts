import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePoints, calculateMatchPoints } from '@/lib/scoring';
import { MatchScore } from '@/lib/standings';
import { groupMatches, knockoutStructure, TOTAL_GROUP_MATCHES } from '@/lib/tournament';
import { getEquippedCosmeticsForUsers } from '@/lib/coins';

export async function GET() {
  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    include: {
      predictions: true,
      extraPredictions: true,
    },
  });

  const actualResults = await prisma.actualResult.findMany();

  if (actualResults.length === 0) {
    const cosmetics0 = await getEquippedCosmeticsForUsers(users.map(u => u.id));
    const leaderboard = users.map(u => ({
      id: u.id,
      name: u.name,
      totalPoints: 0,
      groupPhasePoints: 0,
      knockoutPoints: 0,
      extraPoints: 0,
      predictionsCount: u.predictions.length,
      beerCount: 0,
      beerReasons: [] as string[],
      hotStreak: 0,
      cosmetics: cosmetics0.get(u.id) || { nameColor: null, rowStyle: null, title: null },
    }));
    return NextResponse.json({ leaderboard });
  }

  const actualScores: MatchScore[] = actualResults.map(r => ({
    matchNumber: r.matchNumber,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    advancingTeam: r.advancingTeam || undefined,
  }));

  // Build lookup of all scheduled matches by date
  const allMatches = [
    ...groupMatches.map(m => ({ matchNumber: m.matchNumber, date: m.date })),
    ...knockoutStructure.map(m => ({ matchNumber: m.matchNumber, date: m.date })),
  ];
  const matchesByDate = new Map<string, number[]>();
  for (const m of allMatches) {
    const list = matchesByDate.get(m.date) || [];
    list.push(m.matchNumber);
    matchesByDate.set(m.date, list);
  }

  // Find completed matchdays (dates where ALL scheduled matches have results)
  const resultMatchNumbers = new Set(actualResults.map(r => r.matchNumber));
  const completedDates = [...matchesByDate.entries()]
    .filter(([, matchNums]) => matchNums.every(n => resultMatchNumbers.has(n)))
    .map(([date]) => date)
    .sort();

  // Pre-build prediction lookup maps for performance
  const userPredMaps = new Map<string, Map<number, { matchNumber: number; homeScore: number; awayScore: number; jokerUsed: boolean }>>();
  for (const u of users) {
    const predMap = new Map<number, { matchNumber: number; homeScore: number; awayScore: number; jokerUsed: boolean }>();
    for (const p of u.predictions) {
      predMap.set(p.matchNumber, { matchNumber: p.matchNumber, homeScore: p.homeScore, awayScore: p.awayScore, jokerUsed: p.jokerUsed });
    }
    userPredMaps.set(u.id, predMap);
  }

  const actualScoreMap = new Map<number, MatchScore>();
  for (const a of actualScores) actualScoreMap.set(a.matchNumber, a);

  // Beer counter with reasons
  const beerReasons = new Map<string, string[]>();
  const beerGiveReasons = new Map<string, string[]>();
  for (const userId of users.map(u => u.id)) {
    beerReasons.set(userId, []);
    beerGiveReasons.set(userId, []);
  }

  // Group phase: per matchday, lowest scorer drinks
  const groupDates = completedDates.filter(date => {
    const matchNums = matchesByDate.get(date) || [];
    return matchNums.every(n => n <= TOTAL_GROUP_MATCHES);
  });

  for (const date of groupDates) {
    const matchesOnDate = new Set(matchesByDate.get(date) || []);
    const resultsOnDate = actualScores.filter(r => matchesOnDate.has(r.matchNumber));

    const standings = users.map(u => {
      let dayPoints = 0;
      for (const actual of resultsOnDate) {
        const pred = userPredMaps.get(u.id)?.get(actual.matchNumber);
        if (pred) {
          dayPoints += calculateMatchPoints(
            { matchNumber: pred.matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore },
            actual,
            pred.jokerUsed,
          );
        }
      }
      return { id: u.id, points: dayPoints };
    });

    if (standings.length < 2) continue;

    standings.sort((a, b) => a.points - b.points);
    const threshold = standings.length >= 3 ? standings[2].points : standings[0].points;
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
    for (const s of standings) {
      if (s.points <= threshold) {
        beerReasons.get(s.id)!.push(`Onderste 3 op ${formattedDate} (${s.points}pt)`);
      }
    }

    const maxPoints = Math.max(...standings.map(s => s.points));
    for (const s of standings) {
      if (s.points === maxPoints) {
        beerGiveReasons.get(s.id)!.push(`Beste op ${formattedDate} (${maxPoints}pt)`);
      }
    }
  }

  // Knockout: per round, lowest scorer drinks
  const matchesByRound = new Map<string, number[]>();
  for (const km of knockoutStructure) {
    const list = matchesByRound.get(km.round) || [];
    list.push(km.matchNumber);
    matchesByRound.set(km.round, list);
  }

  const roundLabels: Record<string, string> = {
    R32: 'Ronde van 32', R16: 'Achtste finales', QF: 'Kwartfinales',
    SF: 'Halve finales', '3P': 'Troostfinale', F: 'Finale',
  };

  for (const [round, matchNums] of matchesByRound) {
    const allHaveResults = matchNums.every(n => resultMatchNumbers.has(n));
    if (!allHaveResults) continue;

    const roundResults = actualScores.filter(r => matchNums.includes(r.matchNumber));

    const standings = users.map(u => {
      let roundPoints = 0;
      for (const actual of roundResults) {
        const pred = userPredMaps.get(u.id)?.get(actual.matchNumber);
        if (pred) {
          roundPoints += calculateMatchPoints(
            { matchNumber: pred.matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore },
            actual,
            pred.jokerUsed,
            true,
          );
        }
      }
      return { id: u.id, points: roundPoints };
    });

    if (standings.length < 2) continue;

    standings.sort((a, b) => a.points - b.points);
    const threshold = standings.length >= 3 ? standings[2].points : standings[0].points;
    const label = roundLabels[round] || round;
    for (const s of standings) {
      if (s.points <= threshold) {
        beerReasons.get(s.id)!.push(`Onderste 3 in ${label} (${s.points}pt)`);
      }
    }
  }

  // === BESCHAMENDE REEKS: 3x op rij 0 punten = extra bier (alleen groepsfase) ===
  const playedGroupMatches = [...resultMatchNumbers].filter(n => n <= TOTAL_GROUP_MATCHES).sort((a, b) => a - b);
  const hotStreaks = new Map<string, number>();
  for (const u of users) {
    const predMap = userPredMaps.get(u.id)!;
    let consecutiveZeros = 0;
    let streak = 0;
    for (const matchNum of playedGroupMatches) {
      const pred = predMap.get(matchNum);
      const actual = actualScoreMap.get(matchNum);
      if (!pred || !actual) {
        consecutiveZeros++;
        streak = 0;
      } else {
        const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
        const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);
        streak = predOutcome === actualOutcome ? streak + 1 : 0;
        consecutiveZeros = calculateMatchPoints(pred, actual, pred.jokerUsed) <= 0 ? consecutiveZeros + 1 : 0;
      }
      if (consecutiveZeros > 0 && consecutiveZeros % 2 === 0) {
        beerReasons.get(u.id)!.push(`${consecutiveZeros}x op rij 0 punten`);
      }
    }
    hotStreaks.set(u.id, streak);
  }

  const beerGifts = await prisma.beerGift.findMany({
    include: { giver: { select: { name: true } } },
  });
  for (const gift of beerGifts) {
    beerReasons.get(gift.receiverId)?.push(`Cadeau van ${gift.giver.name} (${gift.reason})`);
  }

  const cosmeticsByUser = await getEquippedCosmeticsForUsers(users.map(u => u.id));

  const leaderboard = users.map(u => {
    const predScores: MatchScore[] = u.predictions.map(p => ({
      matchNumber: p.matchNumber,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      advancingTeam: p.advancingTeam || undefined,
    }));

    const extra = u.extraPredictions ? {
      topScorer: u.extraPredictions.topScorer,
      belgianTopScorer: u.extraPredictions.belgianTopScorer,
      worldChampion: u.extraPredictions.worldChampion,
      topScorerGoals: u.extraPredictions.topScorerGoals,
      topScorerFirstGoalMin: u.extraPredictions.topScorerFirstGoalMin,
    } : undefined;

    const jokerMatches = new Set(u.predictions.filter(p => p.jokerUsed).map(p => p.matchNumber));
    const scoring = calculatePoints(predScores, actualScores, extra, undefined, jokerMatches);

    return {
      id: u.id,
      name: u.name,
      totalPoints: scoring.totalPoints,
      groupPhasePoints: scoring.groupPhasePoints,
      knockoutPoints: scoring.knockoutPoints,
      extraPoints: scoring.extraPoints,
      predictionsCount: u.predictions.length,
      beerCount: beerReasons.get(u.id)?.length || 0,
      beerReasons: beerReasons.get(u.id) || [],
      beerGiveCount: beerGiveReasons.get(u.id)?.length || 0,
      beerGiveReasons: beerGiveReasons.get(u.id) || [],
      beerGivePending: (beerGiveReasons.get(u.id) || []).filter(r => !beerGifts.some(g => g.giverId === u.id && g.reason === r)).length,
      hotStreak: hotStreaks.get(u.id) || 0,
      cosmetics: cosmeticsByUser.get(u.id) || { nameColor: null, rowStyle: null, title: null },
    };
  });

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ leaderboard, completedMatchdays: completedDates.length });
}
