// Run with: npx tsx scripts/simulate-results.ts
// Generates realistic actual results for all 104 matches
import { PrismaClient } from '@prisma/client';
import { groups, groupMatches, knockoutStructure } from '../src/lib/tournament';

const prisma = new PrismaClient();

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const rng = makeRng(2026);

function genResult(): [number, number] {
  const r = rng();
  if (r < 0.15) return [0, 0];
  if (r < 0.30) return [1, 1];
  if (r < 0.40) return [2, 1];
  if (r < 0.50) return [1, 0];
  if (r < 0.58) return [0, 1];
  if (r < 0.66) return [1, 2];
  if (r < 0.72) return [2, 0];
  if (r < 0.78) return [3, 1];
  if (r < 0.83) return [0, 2];
  if (r < 0.88) return [2, 2];
  if (r < 0.92) return [3, 0];
  if (r < 0.95) return [3, 2];
  if (r < 0.98) return [4, 1];
  return [1, 3];
}

interface TeamStanding {
  code: string; played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number;
}

function calcStandings(results: Map<number, { homeScore: number; awayScore: number }>): Record<string, TeamStanding[]> {
  const out: Record<string, TeamStanding[]> = {};
  for (const [groupName, teamCodes] of Object.entries(groups)) {
    const standings: TeamStanding[] = teamCodes.map(code => ({
      code, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    }));
    for (const match of groupMatches.filter(m => m.group === groupName)) {
      const r = results.get(match.matchNumber);
      if (!r) continue;
      const home = standings.find(s => s.code === match.home)!;
      const away = standings.find(s => s.code === match.away)!;
      home.played++; away.played++;
      home.goalsFor += r.homeScore; home.goalsAgainst += r.awayScore;
      away.goalsFor += r.awayScore; away.goalsAgainst += r.homeScore;
      if (r.homeScore > r.awayScore) { home.won++; away.lost++; home.points += 3; }
      else if (r.homeScore < r.awayScore) { away.won++; home.lost++; away.points += 3; }
      else { home.drawn++; away.drawn++; home.points++; away.points++; }
    }
    standings.forEach(s => s.goalDiff = s.goalsFor - s.goalsAgainst);
    standings.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    out[groupName] = standings;
  }
  return out;
}

function getBestThirds(standings: Record<string, TeamStanding[]>) {
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
  const gm = source.match(/^(\d)([\w])$/);
  if (gm) return standings[gm[2]]?.[parseInt(gm[1]) - 1]?.code ?? null;
  if (source.startsWith('3RD_')) {
    const possible = source.slice(4).split('');
    return bestThirds.find(bt => possible.includes(bt.group))?.team.code ?? null;
  }
  if (source.startsWith('W')) return winners.get(parseInt(source.slice(1))) ?? null;
  if (source.startsWith('L')) return losers.get(parseInt(source.slice(1))) ?? null;
  return null;
}

async function main() {
  // Delete existing results
  await prisma.actualResult.deleteMany();
  console.log('Bestaande uitslagen verwijderd.\n');

  const allResults = new Map<number, { homeScore: number; awayScore: number }>();

  // Group stage
  for (const match of groupMatches) {
    const [h, a] = genResult();
    allResults.set(match.matchNumber, { homeScore: h, awayScore: a });
    await prisma.actualResult.create({
      data: { matchNumber: match.matchNumber, homeScore: h, awayScore: a },
    });
  }
  console.log(`${groupMatches.length} groepswedstrijden uitslagen gegenereerd`);

  // Resolve knockout
  const standings = calcStandings(allResults);
  const bestThirds = getBestThirds(standings);
  const winners = new Map<number, string>();
  const losers = new Map<number, string>();

  console.log('\nGroepswinnaars:');
  for (const [g, teams] of Object.entries(standings)) {
    console.log(`  Groep ${g}: 1. ${teams[0].code} (${teams[0].points}p)  2. ${teams[1].code} (${teams[1].points}p)  3. ${teams[2].code} (${teams[2].points}p)`);
  }

  for (const km of knockoutStructure) {
    const homeTeam = resolveSource(km.homeSource, standings, bestThirds, winners, losers);
    const awayTeam = resolveSource(km.awaySource, standings, bestThirds, winners, losers);

    const [h, a] = genResult();
    let advancingTeam: string | undefined;

    if (h === a && homeTeam && awayTeam) {
      advancingTeam = rng() < 0.5 ? homeTeam : awayTeam;
    }

    allResults.set(km.matchNumber, { homeScore: h, awayScore: a });
    await prisma.actualResult.create({
      data: { matchNumber: km.matchNumber, homeScore: h, awayScore: a, advancingTeam },
    });

    if (homeTeam && awayTeam) {
      let winner: string, loser: string;
      if (h > a) { winner = homeTeam; loser = awayTeam; }
      else if (a > h) { winner = awayTeam; loser = homeTeam; }
      else { winner = advancingTeam === homeTeam ? homeTeam : awayTeam; loser = winner === homeTeam ? awayTeam : homeTeam; }
      winners.set(km.matchNumber, winner);
      losers.set(km.matchNumber, loser);
    }
  }
  console.log(`\n${knockoutStructure.length} knockout-uitslagen gegenereerd`);

  // Print finale
  const finaleWinner = winners.get(104);
  console.log(`\nWerelkampioen: ${finaleWinner}`);
  console.log(`\n--- Klaar! Alle 104 uitslagen zijn ingevoerd ---`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
