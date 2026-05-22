// Run with: npx tsx scripts/simulate-all-predictions.ts
// Simulates 4 test players predicting ALL 104 matches + extra questions
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Seeded random for reproducibility per player
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Generate a realistic score based on player style
function genScore(rng: () => number, style: 'safe' | 'bold' | 'chaotic' | 'defensive'): [number, number] {
  const r = rng();
  switch (style) {
    case 'safe':
      // Tends to predict low-scoring, many draws
      if (r < 0.3) return [1, 1];
      if (r < 0.5) return [2, 1];
      if (r < 0.65) return [1, 0];
      if (r < 0.8) return [0, 1];
      if (r < 0.9) return [2, 0];
      return [0, 0];
    case 'bold':
      // Higher scores, home advantage
      if (r < 0.25) return [3, 1];
      if (r < 0.45) return [2, 0];
      if (r < 0.6) return [2, 1];
      if (r < 0.7) return [1, 2];
      if (r < 0.8) return [4, 2];
      if (r < 0.9) return [3, 0];
      return [0, 2];
    case 'chaotic':
      // Wild predictions
      if (r < 0.15) return [4, 3];
      if (r < 0.3) return [0, 3];
      if (r < 0.45) return [3, 2];
      if (r < 0.55) return [5, 1];
      if (r < 0.65) return [1, 4];
      if (r < 0.8) return [2, 2];
      if (r < 0.9) return [3, 3];
      return [0, 0];
    case 'defensive':
      // Low scores
      if (r < 0.3) return [1, 0];
      if (r < 0.55) return [0, 0];
      if (r < 0.7) return [0, 1];
      if (r < 0.85) return [1, 1];
      if (r < 0.95) return [2, 1];
      return [2, 0];
  }
}

// Pick advancing team for knockout draws
function pickAdvancer(rng: () => number, homeTeam: string | null, awayTeam: string | null): string | undefined {
  if (!homeTeam || !awayTeam) return undefined;
  return rng() < 0.5 ? homeTeam : awayTeam;
}

// --- Simplified bracket resolution (mirrors standings.ts logic) ---
interface GroupMatch { matchNumber: number; home: string; away: string; group: string; }
interface KnockoutMatch { matchNumber: number; round: string; homeSource: string; awaySource: string; }

// Import the actual data
import { groups, groupMatches, knockoutStructure, TOTAL_GROUP_MATCHES } from '../src/lib/tournament';

interface TeamStanding {
  code: string; played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number;
}

function calcStandings(preds: Map<number, { homeScore: number; awayScore: number }>): Record<string, TeamStanding[]> {
  const result: Record<string, TeamStanding[]> = {};
  for (const [groupName, teamCodes] of Object.entries(groups)) {
    const standings: TeamStanding[] = teamCodes.map(code => ({
      code, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    }));
    const matches = groupMatches.filter(m => m.group === groupName);
    for (const match of matches) {
      const p = preds.get(match.matchNumber);
      if (!p) continue;
      const home = standings.find(s => s.code === match.home)!;
      const away = standings.find(s => s.code === match.away)!;
      home.played++; away.played++;
      home.goalsFor += p.homeScore; home.goalsAgainst += p.awayScore;
      away.goalsFor += p.awayScore; away.goalsAgainst += p.homeScore;
      if (p.homeScore > p.awayScore) { home.won++; away.lost++; home.points += 3; }
      else if (p.homeScore < p.awayScore) { away.won++; home.lost++; away.points += 3; }
      else { home.drawn++; away.drawn++; home.points++; away.points++; }
    }
    standings.forEach(s => s.goalDiff = s.goalsFor - s.goalsAgainst);
    standings.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    result[groupName] = standings;
  }
  return result;
}

function getBestThirds(standings: Record<string, TeamStanding[]>): { group: string; team: TeamStanding }[] {
  const thirds = Object.entries(standings).map(([group, teams]) => ({ group, team: teams[2] }));
  thirds.sort((a, b) => b.team.points - a.team.points || b.team.goalDiff - a.team.goalDiff || b.team.goalsFor - a.team.goalsFor);
  return thirds.slice(0, 8);
}

function resolveSource(
  source: string,
  standings: Record<string, TeamStanding[]>,
  bestThirds: { group: string; team: TeamStanding }[],
  winners: Map<number, string>,
  losers: Map<number, string>,
): string | null {
  // Group position: "1A", "2B", etc.
  const groupPosMatch = source.match(/^(\d)([\w])$/);
  if (groupPosMatch) {
    const pos = parseInt(groupPosMatch[1]) - 1;
    const group = groupPosMatch[2];
    return standings[group]?.[pos]?.code ?? null;
  }
  // Best 3rd: "3RD_ABCDF"
  if (source.startsWith('3RD_')) {
    const possibleGroups = source.slice(4).split('');
    const match = bestThirds.find(bt => possibleGroups.includes(bt.group));
    return match?.team.code ?? null;
  }
  // Winner/Loser of match: "W73", "L101"
  if (source.startsWith('W')) {
    const mn = parseInt(source.slice(1));
    return winners.get(mn) ?? null;
  }
  if (source.startsWith('L')) {
    const mn = parseInt(source.slice(1));
    return losers.get(mn) ?? null;
  }
  return null;
}

function resolveKnockout(
  preds: Map<number, { homeScore: number; awayScore: number; advancingTeam?: string }>,
  standings: Record<string, TeamStanding[]>,
) {
  const bestThirds = getBestThirds(standings);
  const winners = new Map<number, string>();
  const losers = new Map<number, string>();
  const resolved: { matchNumber: number; homeTeam: string | null; awayTeam: string | null }[] = [];

  for (const km of knockoutStructure) {
    const homeTeam = resolveSource(km.homeSource, standings, bestThirds, winners, losers);
    const awayTeam = resolveSource(km.awaySource, standings, bestThirds, winners, losers);
    resolved.push({ matchNumber: km.matchNumber, homeTeam, awayTeam });

    const p = preds.get(km.matchNumber);
    if (homeTeam && awayTeam && p) {
      let winner: string;
      let loser: string;
      if (p.homeScore > p.awayScore) { winner = homeTeam; loser = awayTeam; }
      else if (p.awayScore > p.homeScore) { winner = awayTeam; loser = homeTeam; }
      else { winner = p.advancingTeam === homeTeam ? homeTeam : awayTeam; loser = winner === homeTeam ? awayTeam : homeTeam; }
      winners.set(km.matchNumber, winner);
      losers.set(km.matchNumber, loser);
    }
  }
  return resolved;
}

const players = [
  { name: 'Jansen', email: 'jansen@test.be', style: 'safe' as const, seed: 42, champion: 'BRA', topScorer: 'Kylian Mbappe', belTopScorer: 'Romelu Lukaku', tsGoals: 6, tsMin: 23 },
  { name: 'Pansen', email: 'pansen@test.be', style: 'bold' as const, seed: 99, champion: 'FRA', topScorer: 'Erling Haaland', belTopScorer: 'Kevin De Bruyne', tsGoals: 8, tsMin: 11 },
  { name: 'DeAnsen', email: 'deansen@test.be', style: 'chaotic' as const, seed: 7, champion: 'ARG', topScorer: 'Lionel Messi', belTopScorer: 'Leandro Trossard', tsGoals: 10, tsMin: 5 },
  { name: 'Ansen Jr.', email: 'ansenjr@test.be', style: 'defensive' as const, seed: 256, champion: 'ESP', topScorer: 'Harry Kane', belTopScorer: 'Romelu Lukaku', tsGoals: 5, tsMin: 34 },
];

async function main() {
  const hashed = await bcrypt.hash('test123', 10);

  for (const player of players) {
    console.log(`\n=== ${player.name} (${player.style}) ===`);
    const rng = makeRng(player.seed);

    // Create/update user
    const user = await prisma.user.upsert({
      where: { email: player.email },
      update: { name: player.name },
      create: { email: player.email, password: hashed, name: player.name, isAdmin: false },
    });

    // Delete existing predictions
    await prisma.matchPrediction.deleteMany({ where: { userId: user.id } });

    // Generate group stage predictions
    const allPreds = new Map<number, { homeScore: number; awayScore: number; advancingTeam?: string }>();
    const dbPreds: { userId: string; matchNumber: number; homeScore: number; awayScore: number; advancingTeam?: string }[] = [];

    for (const match of groupMatches) {
      const [h, a] = genScore(rng, player.style);
      allPreds.set(match.matchNumber, { homeScore: h, awayScore: a });
      dbPreds.push({ userId: user.id, matchNumber: match.matchNumber, homeScore: h, awayScore: a });
    }
    console.log(`  ${groupMatches.length} groepswedstrijden voorspeld`);

    // Calculate standings to resolve knockout bracket
    const standings = calcStandings(allPreds);

    // Generate knockout predictions
    const bestThirds = getBestThirds(standings);
    const winners = new Map<number, string>();
    const losers = new Map<number, string>();

    for (const km of knockoutStructure) {
      const homeTeam = resolveSource(km.homeSource, standings, bestThirds, winners, losers);
      const awayTeam = resolveSource(km.awaySource, standings, bestThirds, winners, losers);

      const [h, a] = genScore(rng, player.style);
      let advancingTeam: string | undefined;

      if (h === a && homeTeam && awayTeam) {
        advancingTeam = pickAdvancer(rng, homeTeam, awayTeam);
      }

      allPreds.set(km.matchNumber, { homeScore: h, awayScore: a, advancingTeam });
      dbPreds.push({ userId: user.id, matchNumber: km.matchNumber, homeScore: h, awayScore: a, advancingTeam });

      if (homeTeam && awayTeam) {
        let winner: string;
        let loser: string;
        if (h > a) { winner = homeTeam; loser = awayTeam; }
        else if (a > h) { winner = awayTeam; loser = homeTeam; }
        else { winner = advancingTeam === homeTeam ? homeTeam : awayTeam; loser = winner === homeTeam ? awayTeam : homeTeam; }
        winners.set(km.matchNumber, winner);
        losers.set(km.matchNumber, loser);
      }
    }
    console.log(`  ${knockoutStructure.length} knockout-wedstrijden voorspeld`);

    // Bulk insert all predictions
    await prisma.matchPrediction.createMany({ data: dbPreds });
    console.log(`  ${dbPreds.length} totale voorspellingen opgeslagen`);

    // Extra predictions
    await prisma.extraPrediction.upsert({
      where: { userId: user.id },
      update: {
        worldChampion: player.champion,
        topScorer: player.topScorer,
        belgianTopScorer: player.belTopScorer,
        topScorerGoals: player.tsGoals,
        topScorerFirstGoalMin: player.tsMin,
      },
      create: {
        userId: user.id,
        worldChampion: player.champion,
        topScorer: player.topScorer,
        belgianTopScorer: player.belTopScorer,
        topScorerGoals: player.tsGoals,
        topScorerFirstGoalMin: player.tsMin,
      },
    });
    console.log(`  Extra vragen ingevuld: kampioen=${player.champion}, topscorer=${player.topScorer}`);
  }

  console.log('\n--- Klaar! Alle 4 spelers hebben 104 wedstrijden + extra vragen voorspeld ---');
  console.log('Log in als testuser met wachtwoord: test123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
