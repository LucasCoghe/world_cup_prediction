// Hot streak tiers — bepaalt de visuele behandeling van een naam op basis van
// het aantal correcte uitslagen op rij (juiste winnaar). Gebruikt door zowel
// de leaderboard als de voorspellingspagina zodat de stijlen consistent zijn.
export interface StreakTier {
  className: string;
  emoji: string;
  label: string | null; // speciaal label (null voor de basis-tier)
}

export function getStreakTier(streak: number): StreakTier | null {
  if (streak >= 10) return { className: 'mythic-text', emoji: '💎', label: 'GODLIKE' };
  if (streak >= 7) return { className: 'electric-text', emoji: '⚡', label: 'UNSTOPPABLE' };
  if (streak >= 5) return { className: 'legendary-text', emoji: '👑', label: 'LEGENDARY' };
  if (streak >= 2) return { className: 'fire-text', emoji: '🔥', label: null };
  return null;
}
