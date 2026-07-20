import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePoints, calculateMatchPoints, isCorrectWinner } from '@/lib/scoring';
import { MatchScore, resolveKnockoutBracket } from '@/lib/standings';
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
  const actualExtraRow = await prisma.actualExtraResult.findUnique({ where: { id: 'singleton' } });
  const actualExtra = actualExtraRow ? {
    topScorer: actualExtraRow.topScorer,
    belgianTopScorer: actualExtraRow.belgianTopScorer,
    worldChampion: actualExtraRow.worldChampion,
    topScorerGoals: actualExtraRow.topScorerGoals,
    topScorerFirstGoalMin: actualExtraRow.topScorerFirstGoalMin,
  } : undefined;

  const confirmedCountByUser = new Map<string, number>();
  const confirmedPints = await prisma.beerConfirmation.findMany({
    where: { photoUrl: { not: null } },
    select: { drinkerId: true },
  });
  for (const c of confirmedPints) {
    confirmedCountByUser.set(c.drinkerId, (confirmedCountByUser.get(c.drinkerId) || 0) + 1);
  }

  if (actualResults.length === 0) {
    const cosmetics0 = await getEquippedCosmeticsForUsers(users.map(u => u.id));
    const leaderboard = users.map(u => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      totalPoints: 0,
      groupPhasePoints: 0,
      knockoutPoints: 0,
      extraPoints: 0,
      predictionsCount: u.predictions.length,
      beerCount: 0,
      beerConfirmedCount: confirmedCountByUser.get(u.id) || 0,
      beerReasons: [] as string[],
      hotStreak: 0,
      bestStreak: 0,
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

  // Find completed matchdays (dates where ALL scheduled matches have a FINAL result).
  // Live results show up in points/standings, but don't trigger beer counting until finalized.
  const finalResultMatchNumbers = new Set(actualResults.filter(r => !r.live).map(r => r.matchNumber));
  const completedDates = [...matchesByDate.entries()]
    .filter(([, matchNums]) => matchNums.every(n => finalResultMatchNumbers.has(n)))
    .map(([date]) => date)
    .sort();

  // Pre-build prediction lookup maps for performance
  const userPredMaps = new Map<string, Map<number, { matchNumber: number; homeScore: number; awayScore: number; jokerUsed: boolean; advancingTeam?: string }>>();
  for (const u of users) {
    const predMap = new Map<number, { matchNumber: number; homeScore: number; awayScore: number; jokerUsed: boolean; advancingTeam?: string }>();
    for (const p of u.predictions) {
      predMap.set(p.matchNumber, { matchNumber: p.matchNumber, homeScore: p.homeScore, awayScore: p.awayScore, jokerUsed: p.jokerUsed, advancingTeam: p.advancingTeam || undefined });
    }
    userPredMaps.set(u.id, predMap);
  }

  const actualScoreMap = new Map<number, MatchScore>();
  for (const a of actualScores) actualScoreMap.set(a.matchNumber, a);

  // Resolve actual knockout bracket once, for shootout winner detection
  const actualBracket = resolveKnockoutBracket(actualScores);
  const actualKoTeams = new Map<number, { home?: string; away?: string }>();
  for (const b of actualBracket) {
    actualKoTeams.set(b.matchNumber, { home: b.homeTeam ?? undefined, away: b.awayTeam ?? undefined });
  }

  // Beer counter with reasons
  const beerReasons = new Map<string, string[]>();
  const beerGiveReasons = new Map<string, string[]>();
  // Datum (YYYY-MM-DD) per uitdeel-reden, om de 🎁-badge te laten verdwijnen
  // na de dag na de speeldag. De reden zelf blijft toewijsbaar in de bier-popup.
  const beerGiveDates = new Map<string, Map<string, string>>();
  for (const userId of users.map(u => u.id)) {
    beerReasons.set(userId, []);
    beerGiveReasons.set(userId, []);
    beerGiveDates.set(userId, new Map());
  }

  // Een uitdeel-pint is "vers" (badge zichtbaar) op de speeldag zelf en de dag
  // erna; vanaf de dag daarna verdwijnt de badge (maar blijft toewijsbaar).
  const todayBrussels = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' });
  const isRecentGive = (date?: string): boolean => {
    if (!date) return true; // geen datum bekend → altijd tonen
    const diffDays = (Date.parse(`${todayBrussels}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000;
    return diffDays <= 1;
  };

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
    // Enkel de laatste (laagste score) drinkt; bij gelijkspel onderaan drinken
    // alle teams met die laagste score.
    const threshold = standings[0].points;
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
    for (const s of standings) {
      if (s.points <= threshold) {
        beerReasons.get(s.id)!.push(`Laatste op ${formattedDate} (${s.points}pt)`);
      }
    }

    const maxPoints = Math.max(...standings.map(s => s.points));
    for (const s of standings) {
      if (s.points === maxPoints) {
        const reason = `Beste op ${formattedDate} (${maxPoints}pt)`;
        beerGiveReasons.get(s.id)!.push(reason);
        beerGiveDates.get(s.id)!.set(reason, date);
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
    const allHaveResults = matchNums.every(n => finalResultMatchNumbers.has(n));
    if (!allHaveResults) continue;

    const roundResults = actualScores.filter(r => matchNums.includes(r.matchNumber));

    const standings = users.map(u => {
      let roundPoints = 0;
      for (const actual of roundResults) {
        const pred = userPredMaps.get(u.id)?.get(actual.matchNumber);
        if (pred) {
          const teams = actualKoTeams.get(actual.matchNumber);
          roundPoints += calculateMatchPoints(
            { matchNumber: pred.matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore, advancingTeam: pred.advancingTeam },
            actual,
            pred.jokerUsed,
            true,
            teams?.home,
            teams?.away,
          );
        }
      }
      return { id: u.id, points: roundPoints };
    });

    if (standings.length < 2) continue;

    standings.sort((a, b) => a.points - b.points);
    // Enkel de laatste (laagste score) drinkt; bij gelijkspel onderaan drinken
    // alle teams met die laagste score.
    const threshold = standings[0].points;
    const label = roundLabels[round] || round;
    for (const s of standings) {
      if (s.points <= threshold) {
        beerReasons.get(s.id)!.push(`Laatste in ${label} (${s.points}pt)`);
      }
    }
  }

  // === HOT STREAK + BESCHAMENDE REEKS / HATTRICK ===
  // Alles loopt door over groep én knockout:
  //   Hot streak: juiste winnaar op rij.
  //   3x op rij 0 punten = drink een pint.
  //   Elke 3 exacte scores cumulatief = deel een pint uit.
  const playedMatches = [...finalResultMatchNumbers].sort((a, b) => a - b);
  const matchDateMap = new Map<number, string>();
  for (const m of groupMatches) matchDateMap.set(m.matchNumber, m.date);
  for (const m of knockoutStructure) matchDateMap.set(m.matchNumber, m.date);
  const hotStreaks = new Map<string, number>();
  const bestStreaks = new Map<string, number>();
  for (const u of users) {
    const predMap = userPredMaps.get(u.id)!;
    let consecutiveZeros = 0;
    let streak = 0;
    let bestStreak = 0;
    let exactCount = 0;
    for (const matchNum of playedMatches) {
      const isKnockout = matchNum > TOTAL_GROUP_MATCHES;
      const teams = isKnockout ? actualKoTeams.get(matchNum) : undefined;
      const pred = predMap.get(matchNum);
      const actual = actualScoreMap.get(matchNum);

      if (!pred || !actual) {
        streak = 0;
        consecutiveZeros++;
      } else {
        const correct = isCorrectWinner(
          { matchNumber: matchNum, homeScore: pred.homeScore, awayScore: pred.awayScore, advancingTeam: pred.advancingTeam },
          actual,
          isKnockout,
          teams?.home,
          teams?.away,
        );
        streak = correct ? streak + 1 : 0;

        const pts = calculateMatchPoints(pred, actual, pred.jokerUsed, isKnockout, teams?.home, teams?.away);
        consecutiveZeros = pts <= 0 ? consecutiveZeros + 1 : 0;

        const exactScore = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
        if (exactScore) {
          exactCount++;
          if (exactCount % 3 === 0) {
            const date = matchDateMap.get(matchNum);
            const dateStr = date
              ? new Date(date + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
              : `match ${matchNum}`;
            const reason = `Hattrick: ${exactCount} exacte scores (laatst ${dateStr})`;
            beerGiveReasons.get(u.id)!.push(reason);
            if (date) beerGiveDates.get(u.id)!.set(reason, date);
          }
        }
      }
      if (streak > bestStreak) bestStreak = streak;
      if (consecutiveZeros > 0 && consecutiveZeros % 3 === 0) {
        const date = matchDateMap.get(matchNum);
        const dateStr = date
          ? new Date(date + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
          : `match ${matchNum}`;
        beerReasons.get(u.id)!.push(`${consecutiveZeros}x op rij 0 punten (tot ${dateStr})`);
      }
    }
    hotStreaks.set(u.id, streak);
    bestStreaks.set(u.id, bestStreak);
  }

  // One-time migration: rename legacy "Nx op rij 0 punten" (no date suffix)
  // confirmations to the first matching new-format reason for each user, so
  // existing photos don't become orphaned by the format change.
  const legacyStreakConfs = await prisma.beerConfirmation.findMany({
    where: {
      AND: [
        { reason: { endsWith: 'x op rij 0 punten' } },
        { NOT: { reason: { contains: '(tot ' } } },
      ],
    },
  });
  for (const conf of legacyStreakConfs) {
    const userReasons = beerReasons.get(conf.drinkerId) || [];
    const newReason = userReasons.find(r => r.startsWith(`${conf.reason} (tot `));
    if (!newReason) continue;
    try {
      await prisma.beerConfirmation.update({ where: { id: conf.id }, data: { reason: newReason } });
    } catch {
      // Unique conflict — another row already owns the new reason; leave legacy as-is.
    }
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
    const scoring = calculatePoints(predScores, actualScores, extra, actualExtra, jokerMatches);

    // Schiftingsvragen: afstand tot het echte antwoord bepaalt de volgorde bij
    // gelijke punten. Enkel actief zodra de admin het echte antwoord (>0) heeft
    // ingevuld; anders 0 voor iedereen zodat het de sortering niet beïnvloedt.
    const tbGoalsDiff = actualExtra && actualExtra.topScorerGoals > 0
      ? Math.abs((extra?.topScorerGoals ?? 0) - actualExtra.topScorerGoals) : 0;
    const tbMinDiff = actualExtra && actualExtra.topScorerFirstGoalMin > 0
      ? Math.abs((extra?.topScorerFirstGoalMin ?? 0) - actualExtra.topScorerFirstGoalMin) : 0;

    return {
      id: u.id,
      tbGoalsDiff,
      tbMinDiff,
      name: u.name,
      avatarUrl: u.avatarUrl,
      totalPoints: scoring.totalPoints,
      groupPhasePoints: scoring.groupPhasePoints,
      knockoutPoints: scoring.knockoutPoints,
      extraPoints: scoring.extraPoints,
      predictionsCount: u.predictions.length,
      beerCount: beerReasons.get(u.id)?.length || 0,
      beerConfirmedCount: confirmedCountByUser.get(u.id) || 0,
      beerReasons: beerReasons.get(u.id) || [],
      beerGiveCount: beerGiveReasons.get(u.id)?.length || 0,
      beerGiveReasons: beerGiveReasons.get(u.id) || [],
      // Badge-teller: enkel nog niet-uitgedeelde én verse uitdeel-pinten (de
      // dag na de speeldag verdwijnt de badge; toewijzen blijft kunnen via de
      // bier-popup op beerGiveReasons).
      beerGivePending: (beerGiveReasons.get(u.id) || []).filter(r =>
        !beerGifts.some(g => g.giverId === u.id && g.reason === r) &&
        isRecentGive(beerGiveDates.get(u.id)?.get(r))
      ).length,
      hotStreak: hotStreaks.get(u.id) || 0,
      bestStreak: bestStreaks.get(u.id) || 0,
      cosmetics: cosmeticsByUser.get(u.id) || { nameColor: null, rowStyle: null, title: null },
    };
  });

  leaderboard.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    a.tbGoalsDiff - b.tbGoalsDiff ||   // schiftingsvraag 1: dichtst bij aantal goals topschutter
    a.tbMinDiff - b.tbMinDiff ||       // schiftingsvraag 2: dichtst bij minuut eerste goal
    a.name.localeCompare(b.name)       // laatste redmiddel: stabiele, deterministische volgorde
  );

  // Interne tiebreak-velden niet naar de client sturen.
  const publicLeaderboard = leaderboard.map(entry => {
    const { tbGoalsDiff, tbMinDiff, ...rest } = entry;
    void tbGoalsDiff; void tbMinDiff;
    return rest;
  });

  return NextResponse.json({ leaderboard: publicLeaderboard, completedMatchdays: completedDates.length });
}
