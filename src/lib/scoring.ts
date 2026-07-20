// Points calculation based on Sporza WK Pronostiek rules + joker system
import { MatchScore, resolveKnockoutBracket } from './standings';
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

// Vergelijk spelersnamen soepel: sommigen vullen voor- en achternaam in,
// anderen enkel de achternaam. We vergelijken daarom enkel op de achternaam
// (het laatste woord), zonder rekening te houden met hoofdletters of accenten.
// Bv. "Kylian Mbappé", "mbappe" en "Mbappé" matchen allemaal.
export function normalizeScorerName(name: string): string {
  const cleaned = name
    .normalize('NFD')                       // splits accenten af (é -> e + combining teken)
    .replace(/[̀-ͯ]/g, '')        // verwijder de combining accenttekens
    .toLowerCase()
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens[tokens.length - 1] : '';
}

// Vergelijk een voorspelde topschutter met het echte antwoord. Het echte
// antwoord kan meerdere namen bevatten (bv. een gedeelde topschutter),
// gescheiden door komma, puntkomma, slash of een nieuwe regel. De voorspelling
// is juist zodra de achternaam met één van die namen overeenkomt.
export function scorerNamesMatch(predName: string, actualName: string): boolean {
  const pred = normalizeScorerName(predName);
  if (pred === '') return false;
  return actualName
    .split(/[,;/\n]+/)
    .map(n => normalizeScorerName(n))
    .some(n => n !== '' && n === pred);
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

// Determine which side advances (1 = home, -1 = away, 0 = unresolved).
// Een beslissende score bepaalt de winnaar; advancingTeam telt enkel bij een
// echt gelijkspel (penalty's). Zo overschrijft een achtergebleven
// advancingTeam-keuze (van toen het nog een gelijkspel was) nooit de score.
function getAdvancingSide(score: MatchScore, homeTeam?: string, awayTeam?: string): 1 | -1 | 0 {
  if (score.homeScore > score.awayScore) return 1;
  if (score.awayScore > score.homeScore) return -1;
  if (score.advancingTeam && homeTeam && awayTeam) {
    if (score.advancingTeam === homeTeam) return 1;
    if (score.advancingTeam === awayTeam) return -1;
  }
  return 0;
}

// Did the prediction get the winner/outcome right?
//   Group:    same result sign (incl. a correctly predicted draw).
//   Knockout: same advancing side (handles penalty shootouts via advancingTeam).
export function isCorrectWinner(
  pred: MatchScore,
  actual: MatchScore,
  isKnockout: boolean,
  actualHomeTeam?: string,
  actualAwayTeam?: string,
): boolean {
  if (isKnockout) {
    const predSide = getAdvancingSide(pred, actualHomeTeam, actualAwayTeam);
    const actualSide = getAdvancingSide(actual, actualHomeTeam, actualAwayTeam);
    return predSide !== 0 && predSide === actualSide;
  }
  return getOutcome(pred.homeScore, pred.awayScore) === getOutcome(actual.homeScore, actual.awayScore);
}

// Sporza knockout scoring (cumulatief, de bonussen stapelen):
//   +10pt = juiste winnaar (wie doorgaat, ook na penalty's)
//    +6pt = exacte score na 90/120 min — los van de (penalty)winnaar
//    +4pt = juist doelsaldo na 90/120 min — los van de winnaar
// Een exacte score impliceert een juist doelsaldo, dus een perfecte
// voorspelling met de juiste winnaar levert 10+6+4 = 20 op. Een correct
// getipt gelijkspel met de verkeerde penaltywinnaar levert nog 6+4 = 10 op.
function scoreKnockoutMatch(
  pred: MatchScore,
  actual: MatchScore,
  actualHomeTeam?: string,
  actualAwayTeam?: string,
): { points: number; reason: string; correctWinner: boolean } {
  let points = 0;
  const reasons: string[] = [];

  const predSide = getAdvancingSide(pred, actualHomeTeam, actualAwayTeam);
  const actualSide = getAdvancingSide(actual, actualHomeTeam, actualAwayTeam);
  const correctWinner = predSide !== 0 && predSide === actualSide;

  if (correctWinner) {
    points += 10;
    reasons.push('Juiste winnaar');
  }

  // Score-bonussen op basis van de stand na 90/120 min, onafhankelijk van wie
  // er na de penalty's doorgaat. Exacte score en juist doelsaldo stapelen.
  const exactScore = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
  if (exactScore) {
    points += 6;
    reasons.push('Exacte score');
  }
  const predDiff = goalDiff(pred.homeScore, pred.awayScore);
  const actualDiff = goalDiff(actual.homeScore, actual.awayScore);
  if (predDiff === actualDiff) {
    points += 4;
    reasons.push('Juist doelsaldo');
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
        matchPoints -= 5;
        reason += ' (Joker -5)';
      }
    }

    groupPhasePoints += matchPoints;
    breakdown.push({ matchNumber: i, points: matchPoints, reason });
  }

  // === KNOCKOUT PHASE (matches 73+) ===
  // Resolve actual bracket to know who actually played each knockout match
  // (needed for penalty-shootout winner detection via advancingTeam).
  const actualBracket = resolveKnockoutBracket(actualResults);
  const actualTeamsMap = new Map<number, { homeTeam: string | null; awayTeam: string | null }>();
  for (const b of actualBracket) {
    actualTeamsMap.set(b.matchNumber, { homeTeam: b.homeTeam, awayTeam: b.awayTeam });
  }

  for (let i = TOTAL_GROUP_MATCHES + 1; i <= TOTAL_MATCHES; i++) {
    const pred = predMap.get(i);
    const actual = actualMap.get(i);
    if (!pred || !actual) continue;

    const teams = actualTeamsMap.get(i);
    const result = scoreKnockoutMatch(pred, actual, teams?.homeTeam ?? undefined, teams?.awayTeam ?? undefined);
    let matchPoints = result.points;
    let reason = result.reason;

    const isJoker = jokerMatches?.has(i) ?? false;
    if (isJoker) {
      if (result.correctWinner) {
        matchPoints += 5;
        reason += ' (Joker +5)';
      } else {
        matchPoints -= 5;
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
    if (scorerNamesMatch(extraPrediction.topScorer, actualExtra.topScorer)) {
      extraPoints += 10;
      breakdown.push({ matchNumber: 0, points: 10, reason: 'Juiste Topschutter' });
    }
    if (scorerNamesMatch(extraPrediction.belgianTopScorer, actualExtra.belgianTopScorer)) {
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
  isKnockout?: boolean,
  actualHomeTeam?: string,
  actualAwayTeam?: string,
): number {
  const result = isKnockout
    ? scoreKnockoutMatch(pred, actual, actualHomeTeam, actualAwayTeam)
    : scoreGroupMatch(pred, actual);
  let points = result.points;
  if (joker) {
    points += result.correctWinner ? 5 : -5;
  }
  return points;
}
