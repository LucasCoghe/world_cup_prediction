export interface PatchNoteItem {
  icon: string;
  text: string;
}

export interface PatchNote {
  id: string;
  date: string;
  title: string;
  emoji: string;
  items: PatchNoteItem[];
  cta?: { label: string; tabId: string };
}

// Voeg nieuwe entries BOVENAAN toe. Hoogste id = nieuwste.
// id format: YYYY-MM-DD-slug (helpt sorteren + dedup)
export const PATCH_NOTES: PatchNote[] = [
  {
    id: '2026-06-02-coins-shop',
    date: '2 juni 2026',
    title: 'Coin Economy + Cosmetic Shop',
    emoji: '🪙',
    items: [
      { icon: '🪙', text: 'Verdien coins: 1 per Keepie-Uppie kick, 1 per voorspellingspunt, 50/dag gratis' },
      { icon: '🎨', text: 'Nieuwe Shop tab: koop naam-kleuren (goud, vuur, regenboog, Belgische driekleur...)' },
      { icon: '✨', text: 'Rij-stijlen voor je klassement: gouden rand, vurige glow, galaxy, neon pulse' },
      { icon: '👑', text: '5 titels om te showen: De Bruyne, De Legende, G.O.A.T., Pintjes-koning, Klassen-keeper' },
      { icon: '📣', text: 'Je cosmetics zijn zichtbaar in Klassement, Chat, Schandpaal én Head-to-Head' },
    ],
    cta: { label: 'Naar de Shop', tabId: 'shop' },
  },
];

export function getLatestPatchId(): string | null {
  return PATCH_NOTES[0]?.id ?? null;
}

export function getUnseenPatches(lastSeenId: string | null): PatchNote[] {
  if (!lastSeenId) return PATCH_NOTES;
  const idx = PATCH_NOTES.findIndex(p => p.id === lastSeenId);
  if (idx === -1) return PATCH_NOTES;
  return PATCH_NOTES.slice(0, idx);
}
