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
    id: '2026-06-06-cosmetics-overhaul',
    date: '6 juni 2026',
    title: 'Cosmetics Overhaul + Tweaks',
    emoji: '🎨',
    items: [
      { icon: '✨', text: '10 nieuwe cosmetics: Matrix & Sterrenhemel naam-kleuren, Bloed / Confetti / Disco / Champagne / Bliksem / Holografisch rij-stijlen, plus Bankzitter & Bondscoach titels' },
      { icon: '🌈', text: 'Bestaande cosmetics opgepoetst: IJs/Galaxy/Regenboog Rand zijn nu echt onderscheidend, Regenboog Rand toont alle kleuren tegelijk' },
      { icon: '🪙', text: 'Coin balans: dagbonus 50 → 15, voorspellingspunten geven nu 5× (was 3×). Predictions zijn duidelijk de hoofdbron' },
      { icon: '🛡️', text: 'Keepie-Uppie shield bots nu écht terug (sterke verticale bounce, gedempte zijwaartse drift) en is zeldzamer geworden — 10% spawnkans ipv 25%' },
      { icon: '📚', text: 'Spelregels duidelijker uitgelegd met concrete voorbeelden bij elke punten-categorie' },
      { icon: '🐛', text: 'Lange usernames duwen de bierteller en punten niet meer uit het klassement' },
    ],
    cta: { label: 'Naar de Shop', tabId: 'shop' },
  },
  {
    id: '2026-06-03-balance',
    date: '3 juni 2026',
    title: 'Coin Balance Update',
    emoji: '⚖️',
    items: [
      { icon: '🎯', text: 'Voorspellingspunten geven nu 3× zoveel coins — scherp gokken loont meer dan ooit' },
      { icon: '🏆', text: 'Keepie-Uppie: enkel je daghoogtepunt telt voor coins (reset elke dag) — geen gegrind meer' },
      { icon: '👑', text: 'Top-tier cosmetics duurder: Regenboog 2500, Neon 3500, G.O.A.T. 5000' },
      { icon: '✨', text: 'Mid-tier items blijven betaalbaar — alleen echte trofeeën zijn nu écht moeilijk' },
    ],
  },
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
