// Points calculation based on the Stockx rules adapted for WK 2026
import { MatchScore, resolveKnockoutBracket } from './standings';
import { TOTAL_GROUP_MATCHES, knockoutStructure } from './tournament';

interface ScoringResult {
  totalPoints: number;
  groupPhasePoints: number;
  knockoutPoints: number;
  extraPoints: number;
  breakdown: PointBreakdown[];
}

interface PointBreakdown {
  matchNumber: number;
  points: number;
  reason: string;
}

export function calculatePoints(
  predictions: MatchScore[],
  actualResults: MatchScore[],
  extraPrediction?: { topScorer: string; belgianTopScorer: string; worldChampion: string; topScorerGoals: number; topScorerFirstGoalMin: number },
  actualExtra?: { topScorer: string; belgianTopScorer: string; worldChampion: string; topScorerGoals: number; topScorerFirstGoalMin: number }
): ScoringResult {
  const breakdown: PointBreakdown[] = [];
  let groupPhasePoints = 0;
  let knockoutPoints = 0;
  let extraPoints = 0;

  const predMap = new Map<number, MatchScore>();
  for (const p of predictions) predMap.set(p.matchNumber, p);

  const actualMap = new Map<number, MatchScore>();
  for (const a of actualResults) actualMap.set(a.matchNumber, a);

  // Resolve brackets for both prediction and actual
  const predBracket = resolveKnockoutBracket(predictions);
  const actualBracket = resolveKnockoutBracket(actualResults);

  // === GROUP PHASE (matches 1-72) ===
  for (let i = 1; i <= TOTAL_GROUP_MATCHES; i++) {
    const pred = predMap.get(i);
    const actual = actualMap.get(i);
    if (!pred || !actual) continue;

    let matchPoints = 0;

    // Rule 1: Correct outcome (win/draw/loss) = 1p
    const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
    const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);

    if (predOutcome === actualOutcome) {
      matchPoints += 1;

      // Rule 2: Exact score = 2p extra
      if (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) {
        matchPoints += 2;
      }
    }

    if (matchPoints > 0) {
      groupPhasePoints += matchPoints;
      breakdown.push({ matchNumber: i, points: matchPoints, reason: matchPoints === 3 ? 'Juiste uitslag' : 'Juiste uitkomst' });
    }
  }

  // === KNOCKOUT PHASE ===
  const roundPoints: Record<string, { team: number; composition: number }> = {
    R32: { team: 2, composition: 2 },
    R16: { team: 2, composition: 2 },
    QF: { team: 3, composition: 3 },
    SF: { team: 4, composition: 4 },
    '3P': { team: 4, composition: 4 },
    F: { team: 5, composition: 5 },
  };

  for (const km of knockoutStructure) {
    // Only score knockout matches that have an actual result entered
    if (!actualMap.has(km.matchNumber)) continue;

    const predResolved = predBracket.find(b => b.matchNumber === km.matchNumber);
    const actualResolved = actualBracket.find(b => b.matchNumber === km.matchNumber);
    if (!predResolved || !actualResolved) continue;

    const rp = roundPoints[km.round];
    if (!rp) continue;

    let matchPoints = 0;
    let reasons: string[] = [];

    // Points for correct team in this round
    let homeCorrect = false;
    let awayCorrect = false;

    if (predResolved.homeTeam && predResolved.homeTeam === actualResolved.homeTeam) {
      matchPoints += rp.team;
      homeCorrect = true;
      reasons.push(`Juiste ${km.round}-deelnemer (thuis)`);
    }
    if (predResolved.awayTeam && predResolved.awayTeam === actualResolved.awayTeam) {
      matchPoints += rp.team;
      awayCorrect = true;
      reasons.push(`Juiste ${km.round}-deelnemer (uit)`);
    }

    // Points for correct composition (both teams correct)
    if (homeCorrect && awayCorrect) {
      matchPoints += rp.composition;
      reasons.push('Juiste samenstelling');
    }

    // Score prediction points (only if composition is correct)
    if (homeCorrect && awayCorrect) {
      const pred = predMap.get(km.matchNumber);
      const actual = actualMap.get(km.matchNumber);

      if (pred && actual) {
        const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
        const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);

        if (predOutcome === actualOutcome) {
          matchPoints += 1;
          if (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) {
            matchPoints += 2;
          }
        }
      }
    }

    if (matchPoints > 0) {
      knockoutPoints += matchPoints;
      breakdown.push({ matchNumber: km.matchNumber, points: matchPoints, reason: reasons.join(' + ') });
    }
  }

  // === EXTRA POINTS ===
  if (extraPrediction && actualExtra) {
    // World Champion = 5p
    if (extraPrediction.worldChampion && extraPrediction.worldChampion === actualExtra.worldChampion) {
      extraPoints += 5;
      breakdown.push({ matchNumber: 0, points: 5, reason: 'Juiste Wereldkampioen' });
    }
    // Top scorer = 5p
    if (extraPrediction.topScorer && extraPrediction.topScorer === actualExtra.topScorer) {
      extraPoints += 5;
      breakdown.push({ matchNumber: 0, points: 5, reason: 'Juiste Topschutter' });
    }
    // Belgian top scorer = 3p
    if (extraPrediction.belgianTopScorer && extraPrediction.belgianTopScorer === actualExtra.belgianTopScorer) {
      extraPoints += 3;
      breakdown.push({ matchNumber: 0, points: 3, reason: 'Juiste Belgische Topschutter' });
    }
  }

  return {
    totalPoints: groupPhasePoints + knockoutPoints + extraPoints,
    groupPhasePoints,
    knockoutPoints,
    extraPoints,
    breakdown,
  };
}

// Calculate points for a single group match (used for per-match stats)
export function calculateMatchPoints(
  pred: MatchScore,
  actual: MatchScore
): number {
  const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
  const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);
  if (predOutcome !== actualOutcome) return 0;
  if (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) return 3;
  return 1;
}
