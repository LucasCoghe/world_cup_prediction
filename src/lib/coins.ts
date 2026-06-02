import { prisma } from './db';
import { calculatePoints } from './scoring';
import { MatchScore } from './standings';

export const DAILY_BONUS = 50;

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function syncPredictionCoins(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { predictions: true, extraPredictions: true },
  });
  if (!user) return 0;

  const actualResults = await prisma.actualResult.findMany();
  if (actualResults.length === 0) return user.coinsBalance;

  const actualScores: MatchScore[] = actualResults.map(r => ({
    matchNumber: r.matchNumber,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    advancingTeam: r.advancingTeam || undefined,
  }));

  const predScores: MatchScore[] = user.predictions.map(p => ({
    matchNumber: p.matchNumber,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    advancingTeam: p.advancingTeam || undefined,
  }));

  const extra = user.extraPredictions ? {
    topScorer: user.extraPredictions.topScorer,
    belgianTopScorer: user.extraPredictions.belgianTopScorer,
    worldChampion: user.extraPredictions.worldChampion,
    topScorerGoals: user.extraPredictions.topScorerGoals,
    topScorerFirstGoalMin: user.extraPredictions.topScorerFirstGoalMin,
  } : undefined;

  const jokerMatches = new Set(user.predictions.filter(p => p.jokerUsed).map(p => p.matchNumber));
  const scoring = calculatePoints(predScores, actualScores, extra, undefined, jokerMatches);

  const earnable = Math.max(0, scoring.totalPoints);
  const alreadyClaimed = user.predictionPointsClaimed;
  if (earnable <= alreadyClaimed) return user.coinsBalance;

  const delta = earnable - alreadyClaimed;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      coinsBalance: { increment: delta },
      predictionPointsClaimed: earnable,
    },
  });
  return updated.coinsBalance;
}

export async function canClaimDaily(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastDailyClaim: true },
  });
  if (!user) return false;
  if (!user.lastDailyClaim) return true;
  return dateString(user.lastDailyClaim) !== todayString();
}

export async function claimDailyCoins(userId: string): Promise<{ claimed: boolean; amount: number; balance: number }> {
  const can = await canClaimDaily(userId);
  if (!can) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { coinsBalance: true } });
    return { claimed: false, amount: 0, balance: u?.coinsBalance ?? 0 };
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      coinsBalance: { increment: DAILY_BONUS },
      lastDailyClaim: new Date(),
    },
  });
  return { claimed: true, amount: DAILY_BONUS, balance: updated.coinsBalance };
}

export async function getEquippedCosmetics(userId: string): Promise<{ nameColor: string | null; rowStyle: string | null; title: string | null }> {
  const equipped = await prisma.userCosmetic.findMany({
    where: { userId, equipped: true },
    select: { cosmeticId: true, category: true },
  });
  const result = { nameColor: null as string | null, rowStyle: null as string | null, title: null as string | null };
  for (const c of equipped) {
    if (c.category === 'name_color') result.nameColor = c.cosmeticId;
    else if (c.category === 'row_style') result.rowStyle = c.cosmeticId;
    else if (c.category === 'title') result.title = c.cosmeticId;
  }
  return result;
}

export async function getEquippedCosmeticsForUsers(userIds: string[]): Promise<Map<string, { nameColor: string | null; rowStyle: string | null; title: string | null }>> {
  const equipped = await prisma.userCosmetic.findMany({
    where: { userId: { in: userIds }, equipped: true },
    select: { userId: true, cosmeticId: true, category: true },
  });
  const result = new Map<string, { nameColor: string | null; rowStyle: string | null; title: string | null }>();
  for (const uid of userIds) {
    result.set(uid, { nameColor: null, rowStyle: null, title: null });
  }
  for (const c of equipped) {
    const entry = result.get(c.userId);
    if (!entry) continue;
    if (c.category === 'name_color') entry.nameColor = c.cosmeticId;
    else if (c.category === 'row_style') entry.rowStyle = c.cosmeticId;
    else if (c.category === 'title') entry.title = c.cosmeticId;
  }
  return result;
}
