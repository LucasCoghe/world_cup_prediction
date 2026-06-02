// Points calculation based on Sporza WK Pronostiek rules + joker system
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

function getOutcome(home: number, away: number): number {
  return Math.sign(home - away);
}

function goalDiff(home: number, away: number): number {
  return home - away;
}

// Sporza group phase scoring:
//   10pt = exact score (bullseye)
//    7pt = correct goal difference but wrong score (e.g. predict 3-1, actual 2-0)
//    5pt = correct winner but wrong goal difference
//    1pt = participation (filled in)
function scoreGroupMatch(pred: MatchScore, actual: MatchScore): { points: number; reason: string; correctWinner: boolean } {
  const predOut = getOutcome(pred.homeScore, pred.awayScore);
  const actualOut = getOutcome(actual.homeScore, actual.awayScore);

  if (predOut !== actualOut) {
    return { points: 0, reason: 'Fout', correctWinner: false };
  }

  const exactScore = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
  if (exactScore) {
    return { points: 10, reason: 'Exacte score', correctWinner: true };
  }

  const predDiff = goalDiff(pred.homeScore, pred.awayScore);
  const actualDiff = goalDiff(actual.homeScore, actual.awayScore);
  if (predDiff === actualDiff) {
    return { points: 7, reason: 'Juist doelsaldo', correctWinner: true };
  }

  return { points: 5, reason: 'Juiste winnaar', correctWinner: true };
}

// Sporza knockout scoring (cumulative):
//   +10pt = correct winner (who advances, even after penalties)
//    +6pt = exact score after 90/120 min
//    +4pt = correct goal difference (but not exact score)
//    +1pt = participation
function scoreKnockoutMatch(pred: MatchScore, actual: MatchScore): { points: number; reason: string; correctWinner: boolean } {
  let points = 0;
  const reasons: string[] = [];
  let correctWinner = false;

  const predOut = getOutcome(pred.homeScore, pred.awayScore);
  const actualOut = getOutcome(actual.homeScore, actual.awayScore);

  if (predOut === actualOut) {
    points += 10;
    reasons.unshift('Juiste winnaar');
    correctWinner = true;

    const exactScore = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
    if (exactScore) {
      points += 6;
      reasons.splice(1, 0, 'Exacte score');
    } else {
      const predDiff = goalDiff(pred.homeScore, pred.awayScore);
      const actualDiff = goalDiff(actual.homeScore, actual.awayScore);
      if (predDiff === actualDiff) {
        points += 4;
        reasons.splice(1, 0, 'Juist doelsaldo');
      }
    }
  }

  return { points, reason: reasons.length > 0 ? reasons.join(' + ') : 'Fout', correctWinner };
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

    const result = scoreGroupMatch(pred, actual);
    let matchPoints = result.points;
    let reason = result.reason;

    const isJoker = jokerMatches?.has(i) ?? false;
    if (isJoker) {
      if (result.correctWinner) {
        matchPoints += 5;
        reason += ' (Joker +5)';
      } else {
        matchPoints -= 2;
        reason += ' (Joker -5)';
      }
    }

    groupPhasePoints += matchPoints;
    breakdown.push({ matchNumber: i, points: matchPoints, reason });
  }

  // === KNOCKOUT PHASE (matches 73+) ===
  for (let i = TOTAL_GROUP_MATCHES + 1; i <= TOTAL_MATCHES; i++) {
    const pred = predMap.get(i);
    const actual = actualMap.get(i);
    if (!pred || !actual) continue;

    const result = scoreKnockoutMatch(pred, actual);
    let matchPoints = result.points;
    let reason = result.reason;

    const isJoker = jokerMatches?.has(i) ?? false;
    if (isJoker) {
      if (result.correctWinner) {
        matchPoints += 5;
        reason += ' (Joker +5)';
      } else {
        matchPoints -= 2;
        reason += ' (Joker -5)';
      }
    }

    knockoutPoints += matchPoints;
    breakdown.push({ matchNumber: i, points: matchPoints, reason });
  }

  // === EXTRA POINTS ===
  if (extraPrediction && actualExtra) {
    if (extraPrediction.worldChampion && extraPrediction.worldChampion === actualExtra.worldChampion) {
      extraPoints += 15;
      breakdown.push({ matchNumber: 0, points: 15, reason: 'Juiste Wereldkampioen' });
    }
    if (extraPrediction.topScorer && extraPrediction.topScorer === actualExtra.topScorer) {
      extraPoints += 10;
      breakdown.push({ matchNumber: 0, points: 10, reason: 'Juiste Topschutter' });
    }
    if (extraPrediction.belgianTopScorer && extraPrediction.belgianTopScorer === actualExtra.belgianTopScorer) {
      extraPoints += 10;
      breakdown.push({ matchNumber: 0, points: 10, reason: 'Juiste Belgische Topschutter' });
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

// Calculate points for a single match (used for per-match stats)
export function calculateMatchPoints(
  pred: MatchScore,
  actual: MatchScore,
  joker?: boolean,
  isKnockout?: boolean
): number {
  const result = isKnockout ? scoreKnockoutMatch(pred, actual) : scoreGroupMatch(pred, actual);
  let points = result.points;
  if (joker) {
    points += result.correctWinner ? 5 : -5;
  }
  return points;
}
