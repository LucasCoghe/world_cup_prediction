import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { calculateMatchPoints, isCorrectWinner, scorerNamesMatch } from '@/lib/scoring';
import { MatchScore, resolveKnockoutBracket } from '@/lib/standings';
import { groupMatches, knockoutStructure, teams, getRoundName, TOTAL_GROUP_MATCHES } from '@/lib/tournament';

// Persoonlijk eindoverzicht van het toernooi voor de ingelogde speler.
// Rang + punten + bier komen uit /api/leaderboard (zodat het exact overeenkomt
// met wat de speler in het klassement ziet); trefzekerheid en records worden
// hier lokaal berekend uit de eigen voorspellingen tegenover de echte uitslagen.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const actualResults = await prisma.actualResult.findMany();
  if (actualResults.length === 0) {
    return NextResponse.json({ available: false });
  }

  // Rang + punten + bier uit het klassement halen.
  const board = await fetchLeaderboard(req);
  const rank = board.findIndex(e => e.id === user.userId) + 1;
  const me = board.find(e => e.id === user.userId);
  if (!me || rank === 0) {
    return NextResponse.json({ available: false });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { predictions: true, extraPredictions: true },
  });
  if (!dbUser) {
    return NextResponse.json({ available: false });
  }

  const actualExtra = await prisma.actualExtraResult.findUnique({ where: { id: 'singleton' } });

  // Uitslagen indexeren.
  const actualMap = new Map<number, MatchScore>();
  for (const r of actualResults) {
    actualMap.set(r.matchNumber, {
      matchNumber: r.matchNumber,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      advancingTeam: r.advancingTeam ?? undefined,
    });
  }
  const playedMatchNumbers = [...actualMap.keys()].sort((a, b) => a - b);

  // Knockout-bracket oplossen voor de echte thuis/uit-teams (penalty-winnaars).
  const actualBracket = resolveKnockoutBracket([...actualMap.values()]);
  const koTeams = new Map<number, { home?: string; away?: string }>();
  for (const b of actualBracket) {
    koTeams.set(b.matchNumber, { home: b.homeTeam ?? undefined, away: b.awayTeam ?? undefined });
  }

  // Statische matchinfo (datum + labels) opzoeken.
  const groupInfo = new Map(groupMatches.map(m => [m.matchNumber, m]));
  const koInfo = new Map(knockoutStructure.map(m => [m.matchNumber, m]));

  function matchLabel(matchNumber: number): string {
    if (matchNumber <= TOTAL_GROUP_MATCHES) {
      const gm = groupInfo.get(matchNumber);
      if (!gm) return `Match ${matchNumber}`;
      return `${teams[gm.home]?.name || gm.home} - ${teams[gm.away]?.name || gm.away}`;
    }
    const resolved = koTeams.get(matchNumber);
    const km = koInfo.get(matchNumber);
    const home = resolved?.home ? (teams[resolved.home]?.name || resolved.home) : (km?.homeSource ?? '?');
    const away = resolved?.away ? (teams[resolved.away]?.name || resolved.away) : (km?.awaySource ?? '?');
    const roundLabel = km ? getRoundName(km.round) : '';
    return `${home} - ${away}${roundLabel ? ` (${roundLabel})` : ''}`;
  }

  function matchDate(matchNumber: number): string {
    return (groupInfo.get(matchNumber)?.date) || (koInfo.get(matchNumber)?.date) || '';
  }

  const predMap = new Map<number, { homeScore: number; awayScore: number; advancingTeam?: string; jokerUsed: boolean }>();
  for (const p of dbUser.predictions) {
    predMap.set(p.matchNumber, {
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      advancingTeam: p.advancingTeam ?? undefined,
      jokerUsed: p.jokerUsed,
    });
  }

  // === TREFZEKERHEID + RECORDS ===
  let predictedCount = 0;      // matches met uitslag waarvoor ik een voorspelling had
  let exactScores = 0;
  let correctWinners = 0;
  let matchPointsTotal = 0;    // punten enkel uit matches (zonder extra vragen)
  let jokerNet = 0;
  let jokersUsed = 0;

  const pointsPerDate = new Map<string, number>();
  let bestPrediction: { label: string; predicted: string; actual: string; points: number } | null = null;
  let worstPrediction: { label: string; predicted: string; actual: string; goalError: number } | null = null;

  for (const matchNumber of playedMatchNumbers) {
    const pred = predMap.get(matchNumber);
    const actual = actualMap.get(matchNumber);
    if (!actual) continue;

    const date = matchDate(matchNumber);

    if (!pred) {
      // Geen voorspelling telt als 0 punten voor de dag.
      if (date) pointsPerDate.set(date, pointsPerDate.get(date) || 0);
      continue;
    }

    predictedCount++;
    const isKo = matchNumber > TOTAL_GROUP_MATCHES;
    const kt = isKo ? koTeams.get(matchNumber) : undefined;

    const predScore: MatchScore = { matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore, advancingTeam: pred.advancingTeam };
    const pts = calculateMatchPoints(predScore, actual, pred.jokerUsed, isKo, kt?.home, kt?.away);
    matchPointsTotal += pts;

    if (date) pointsPerDate.set(date, (pointsPerDate.get(date) || 0) + pts);

    const correct = isCorrectWinner(predScore, actual, isKo, kt?.home, kt?.away);
    if (correct) correctWinners++;

    const exact = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
    if (exact) exactScores++;

    if (pred.jokerUsed) {
      jokersUsed++;
      jokerNet += correct ? 5 : -5;
    }

    if (!bestPrediction || pts > bestPrediction.points) {
      bestPrediction = {
        label: matchLabel(matchNumber),
        predicted: `${pred.homeScore}-${pred.awayScore}`,
        actual: `${actual.homeScore}-${actual.awayScore}`,
        points: pts,
      };
    }

    const goalError = Math.abs(pred.homeScore - actual.homeScore) + Math.abs(pred.awayScore - actual.awayScore);
    if (!correct && (!worstPrediction || goalError > worstPrediction.goalError)) {
      worstPrediction = {
        label: matchLabel(matchNumber),
        predicted: `${pred.homeScore}-${pred.awayScore}`,
        actual: `${actual.homeScore}-${actual.awayScore}`,
        goalError,
      };
    }
  }

  // Beste dag = kalenderdag met de meeste punten.
  let bestDay: { date: string; points: number } | null = null;
  for (const [date, points] of pointsPerDate) {
    if (!bestDay || points > bestDay.points) bestDay = { date, points };
  }

  const accuracy = predictedCount > 0 ? Math.round((correctWinners / predictedCount) * 100) : 0;
  const avgPoints = predictedCount > 0 ? Math.round((matchPointsTotal / predictedCount) * 10) / 10 : 0;

  // === EXTRA VRAGEN ===
  const ep = dbUser.extraPredictions;
  const extraResults = {
    worldChampion: buildExtraResult(
      ep?.worldChampion ? (teams[ep.worldChampion]?.name || ep.worldChampion) : '',
      !!(actualExtra?.worldChampion),
      !!(ep && actualExtra && ep.worldChampion && ep.worldChampion === actualExtra.worldChampion),
    ),
    topScorer: buildExtraResult(
      ep?.topScorer || '',
      !!(actualExtra?.topScorer),
      !!(ep && actualExtra && scorerNamesMatch(ep.topScorer, actualExtra.topScorer)),
    ),
    belgianTopScorer: buildExtraResult(
      ep?.belgianTopScorer || '',
      !!(actualExtra?.belgianTopScorer),
      !!(ep && actualExtra && scorerNamesMatch(ep.belgianTopScorer, actualExtra.belgianTopScorer)),
    ),
  };

  return NextResponse.json({
    available: true,
    name: me.name,
    rank,
    totalPlayers: board.length,
    points: {
      total: me.totalPoints,
      group: me.groupPhasePoints,
      knockout: me.knockoutPoints,
      extra: me.extraPoints,
    },
    accuracy: {
      predictedCount,
      exactScores,
      correctWinners,
      accuracyPct: accuracy,
      avgPoints,
    },
    records: {
      bestStreak: me.bestStreak ?? 0,
      bestDay,
      jokerNet,
      jokersUsed,
      bestPrediction,
      worstPrediction,
    },
    beer: {
      drunk: me.beerCount ?? 0,
      confirmed: me.beerConfirmedCount ?? 0,
      given: me.beerGiveCount ?? 0,
    },
    extra: extraResults,
  });
}

function buildExtraResult(prediction: string, answered: boolean, correct: boolean) {
  return { prediction, answered, correct };
}

interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
  groupPhasePoints: number;
  knockoutPoints: number;
  extraPoints: number;
  beerCount: number;
  beerConfirmedCount: number;
  beerGiveCount: number;
  bestStreak: number;
}

async function fetchLeaderboard(req: Request): Promise<LeaderboardEntry[]> {
  const baseUrl = new URL(req.url).origin;
  const cookieHeader = req.headers.get('cookie') || '';
  const res = await fetch(`${baseUrl}/api/leaderboard`, { headers: { cookie: cookieHeader } });
  const data = await res.json();
  return data.leaderboard || [];
}
