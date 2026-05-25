import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePoints, calculateMatchPoints } from '@/lib/scoring';
import { MatchScore } from '@/lib/standings';
import { groupMatches, knockoutStructure, TOTAL_GROUP_MATCHES } from '@/lib/tournament';

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
    const leaderboard = users.map(u => ({
      id: u.id,
      name: u.name,
      totalPoints: 0,
      groupPhasePoints: 0,
      knockoutPoints: 0,
      extraPoints: 0,
      predictionsCount: u.predictions.length,
      beerCount: 0,
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

  // Beer counter: only for group phase matchdays (per-day points, not cumulative)
  const beerCounts = new Map<string, number>();
  for (const userId of users.map(u => u.id)) beerCounts.set(userId, 0);

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
        const pred = u.predictions.find(p => p.matchNumber === actual.matchNumber);
        if (pred) {
          dayPoints += calculateMatchPoints(
            { matchNumber: pred.matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore },
            actual,
          );
        }
      }
      return { id: u.id, points: dayPoints };
    });

    if (standings.length < 2) continue;

    const minPoints = Math.min(...standings.map(s => s.points));
    for (const s of standings) {
      if (s.points === minPoints) {
        beerCounts.set(s.id, (beerCounts.get(s.id) || 0) + 1);
      }
    }
  }

  // Knockout rondebier: per volledige ronde, wie het minst scoort drinkt
  const matchesByRound = new Map<string, number[]>();
  for (const km of knockoutStructure) {
    const list = matchesByRound.get(km.round) || [];
    list.push(km.matchNumber);
    matchesByRound.set(km.round, list);
  }

  for (const [round, matchNums] of matchesByRound) {
    const allHaveResults = matchNums.every(n => resultMatchNumbers.has(n));
    if (!allHaveResults) continue;

    const resultsBeforeRound = actualScores.filter(r => !matchNums.includes(r.matchNumber));
    const resultsIncludingRound = actualScores.filter(r =>
      resultsBeforeRound.some(rb => rb.matchNumber === r.matchNumber) || matchNums.includes(r.matchNumber)
    );

    const standings = users.map(u => {
      const preds: MatchScore[] = u.predictions.map(p => ({
        matchNumber: p.matchNumber,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        advancingTeam: p.advancingTeam || undefined,
      }));
      const pointsBefore = calculatePoints(preds, resultsBeforeRound).totalPoints;
      const pointsAfter = calculatePoints(preds, resultsIncludingRound).totalPoints;
      return { id: u.id, points: pointsAfter - pointsBefore };
    });

    if (standings.length < 2) continue;

    const minPoints = Math.min(...standings.map(s => s.points));
    for (const s of standings) {
      if (s.points === minPoints) {
        beerCounts.set(s.id, (beerCounts.get(s.id) || 0) + 1);
      }
    }
  }

  // === BESCHAMENDE REEKS: 3x op rij 0 punten = extra bier (alleen groepsfase) ===
  const playedGroupMatches = [...resultMatchNumbers].filter(n => n <= TOTAL_GROUP_MATCHES).sort((a, b) => a - b);
  const hotStreaks = new Map<string, number>();
  for (const u of users) {
    const predMap = new Map<number, MatchScore>();
    for (const p of u.predictions) {
      predMap.set(p.matchNumber, { matchNumber: p.matchNumber, homeScore: p.homeScore, awayScore: p.awayScore });
    }
    let consecutiveZeros = 0;
    let streak = 0;
    for (const matchNum of playedGroupMatches) {
      const pred = predMap.get(matchNum);
      const actual = actualScores.find(a => a.matchNumber === matchNum);
      if (!pred || !actual) {
        consecutiveZeros++;
        streak = 0;
      } else {
        const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
        const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);
        streak = predOutcome === actualOutcome ? streak + 1 : 0;
        consecutiveZeros = calculateMatchPoints(pred, actual) === 0 ? consecutiveZeros + 1 : 0;
      }
      if (consecutiveZeros > 0 && consecutiveZeros % 3 === 0) {
        beerCounts.set(u.id, (beerCounts.get(u.id) || 0) + 1);
      }
    }
    hotStreaks.set(u.id, streak);
  }

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

    const scoring = calculatePoints(predScores, actualScores, extra);

    return {
      id: u.id,
      name: u.name,
      totalPoints: scoring.totalPoints,
      groupPhasePoints: scoring.groupPhasePoints,
      knockoutPoints: scoring.knockoutPoints,
      extraPoints: scoring.extraPoints,
      predictionsCount: u.predictions.length,
      beerCount: beerCounts.get(u.id) || 0,
      hotStreak: hotStreaks.get(u.id) || 0,
    };
  });

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ leaderboard, completedMatchdays: completedDates.length });
}
