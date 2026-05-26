// Points calculation based on the Stockx rules adapted for WK 2026
import { MatchScore } from './standings';
import { TOTAL_GROUP_MATCHES, TOTAL_MATCHES } from './tournament';

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
  actualExtra?: { topScorer: string; belgianTopScorer: string; worldChampion: string; topScorerGoals: number; topScorerFirstGoalMin: number },
  jokerMatches?: Set<number>
): ScoringResult {
  const breakdown: PointBreakdown[] = [];
  let groupPhasePoints = 0;
  let knockoutPoints = 0;
  let extraPoints = 0;

  const predMap = new Map<number, MatchScore>();
  for (const p of predictions) predMap.set(p.matchNumber, p);

  const actualMap = new Map<number, MatchScore>();
  for (const a of actualResults) actualMap.set(a.matchNumber, a);

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

    const isJoker = jokerMatches?.has(i) ?? false;
    if (isJoker) {
      if (matchPoints > 0) {
        matchPoints += 2;
        groupPhasePoints += matchPoints;
        breakdown.push({ matchNumber: i, points: matchPoints, reason: (matchPoints === 5 ? 'Juiste uitslag' : 'Juiste uitkomst') + ' (Joker +2)' });
      } else {
        groupPhasePoints -= 1;
        breakdown.push({ matchNumber: i, points: -1, reason: 'Joker fout (-1)' });
      }
    } else if (matchPoints > 0) {
      groupPhasePoints += matchPoints;
      breakdown.push({ matchNumber: i, points: matchPoints, reason: matchPoints === 3 ? 'Juiste uitslag' : 'Juiste uitkomst' });
    }
  }

  // === KNOCKOUT PHASE (matches 73+) — same scoring as group phase + jokers ===
  for (let i = TOTAL_GROUP_MATCHES + 1; i <= TOTAL_MATCHES; i++) {
    const pred = predMap.get(i);
    const actual = actualMap.get(i);
    if (!pred || !actual) continue;

    let matchPoints = 0;

    const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
    const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);

    if (predOutcome === actualOutcome) {
      matchPoints += 1;
      if (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) {
        matchPoints += 2;
      }
    }

    const isJoker = jokerMatches?.has(i) ?? false;
    if (isJoker) {
      if (matchPoints > 0) {
        matchPoints += 2;
        knockoutPoints += matchPoints;
        breakdown.push({ matchNumber: i, points: matchPoints, reason: (matchPoints === 5 ? 'Juiste uitslag' : 'Juiste uitkomst') + ' (Joker +2)' });
      } else {
        knockoutPoints -= 1;
        breakdown.push({ matchNumber: i, points: -1, reason: 'Joker fout (-1)' });
      }
    } else if (matchPoints > 0) {
      knockoutPoints += matchPoints;
      breakdown.push({ matchNumber: i, points: matchPoints, reason: matchPoints === 3 ? 'Juiste uitslag' : 'Juiste uitkomst' });
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
  actual: MatchScore,
  joker?: boolean
): number {
  const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
  const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);
  if (predOutcome !== actualOutcome) return joker ? -1 : 0;
  const base = (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) ? 3 : 1;
  return joker ? base + 2 : base;
}
