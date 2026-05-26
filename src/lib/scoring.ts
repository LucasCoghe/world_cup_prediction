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

  // === KNOCKOUT PHASE ===
  const roundPoints: Record<string, { team: number; composition: number }> = {
    R32: { team: 2, composition: 2 },
    R16: { team: 2, composition: 2 },
    QF: { team: 3, composition: 3 },
    SF: { team: 4, composition: 4 },
    '3P': { team: 4, composition: 4 },
    F: { team: 5, composition: 5 },
  };

  // Build sets of actual teams per round, and actual matchups per round
  const actualTeamsPerRound = new Map<string, Set<string>>();
  const actualMatchupsPerRound = new Map<string, Set<string>>();
  for (const km of knockoutStructure) {
    const resolved = actualBracket.find(b => b.matchNumber === km.matchNumber);
    if (!resolved) continue;
    if (!actualTeamsPerRound.has(km.round)) {
      actualTeamsPerRound.set(km.round, new Set());
      actualMatchupsPerRound.set(km.round, new Set());
    }
    const roundTeams = actualTeamsPerRound.get(km.round)!;
    const roundMatchups = actualMatchupsPerRound.get(km.round)!;
    if (resolved.homeTeam) roundTeams.add(resolved.homeTeam);
    if (resolved.awayTeam) roundTeams.add(resolved.awayTeam);
    if (resolved.homeTeam && resolved.awayTeam) {
      const key = [resolved.homeTeam, resolved.awayTeam].sort().join('-');
      roundMatchups.add(key);
    }
  }

  // Track which teams/matchups already scored to avoid double counting
  const scoredTeams = new Map<string, Set<string>>();
  const scoredMatchups = new Map<string, Set<string>>();

  for (const km of knockoutStructure) {
    if (!actualMap.has(km.matchNumber)) continue;

    const predResolved = predBracket.find(b => b.matchNumber === km.matchNumber);
    const actualResolved = actualBracket.find(b => b.matchNumber === km.matchNumber);
    if (!predResolved || !actualResolved) continue;

    const rp = roundPoints[km.round];
    if (!rp) continue;

    const roundActualTeams = actualTeamsPerRound.get(km.round) || new Set();
    const roundActualMatchups = actualMatchupsPerRound.get(km.round) || new Set();
    if (!scoredTeams.has(km.round)) scoredTeams.set(km.round, new Set());
    if (!scoredMatchups.has(km.round)) scoredMatchups.set(km.round, new Set());

    let matchPoints = 0;
    let reasons: string[] = [];

    // Team points: check if predicted teams are anywhere in this round
    const predTeamsList = [predResolved.homeTeam, predResolved.awayTeam].filter(Boolean) as string[];
    let correctTeamsInMatch = 0;
    for (const t of predTeamsList) {
      if (roundActualTeams.has(t) && !scoredTeams.get(km.round)!.has(t)) {
        scoredTeams.get(km.round)!.add(t);
        matchPoints += rp.team;
        correctTeamsInMatch++;
        reasons.push(`Juiste ${km.round}-deelnemer`);
      }
    }

    // Composition: check if these two teams play each other anywhere in this round
    if (predTeamsList.length === 2) {
      const matchupKey = [...predTeamsList].sort().join('-');
      if (roundActualMatchups.has(matchupKey) && !scoredMatchups.get(km.round)!.has(matchupKey)) {
        scoredMatchups.get(km.round)!.add(matchupKey);
        matchPoints += rp.composition;
        reasons.push('Juiste samenstelling');

        // Score prediction points only if composition correct AND same match
        const actualTeamsInMatch = new Set([actualResolved.homeTeam, actualResolved.awayTeam].filter(Boolean));
        const bothInThisMatch = predTeamsList.every(t => actualTeamsInMatch.has(t));
        if (bothInThisMatch) {
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
  actual: MatchScore,
  joker?: boolean
): number {
  const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
  const actualOutcome = Math.sign(actual.homeScore - actual.awayScore);
  if (predOutcome !== actualOutcome) return joker ? -1 : 0;
  const base = (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) ? 3 : 1;
  return joker ? base + 2 : base;
}
