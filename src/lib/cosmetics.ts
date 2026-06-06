export type CosmeticCategory = 'name_color' | 'row_style' | 'title';

export interface Cosmetic {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  price: number;
  nameClassName?: string;
  rowClassName?: string;
  title?: string;
}

export const COSMETICS: Cosmetic[] = [
  // Name colors (sorted by price)
  { id: 'name_silver',  category: 'name_color', name: 'Zilveren Naam',       description: 'Een subtiele glans',    price: 150,  nameClassName: 'cos-name-silver' },
  { id: 'name_gold',    category: 'name_color', name: 'Gouden Naam',         description: 'Glanzend goud',         price: 250,  nameClassName: 'cos-name-gold' },
  { id: 'name_fire',    category: 'name_color', name: 'Vuur Naam',           description: 'On fire',               price: 400,  nameClassName: 'cos-name-fire' },
  { id: 'name_ice',     category: 'name_color', name: 'IJs Naam',            description: 'Koeler dan ijs',        price: 400,  nameClassName: 'cos-name-ice' },
  { id: 'name_matrix',  category: 'name_color', name: 'Matrix',              description: 'Digitale code-vibe',    price: 500,  nameClassName: 'cos-name-matrix' },
  { id: 'name_stars',   category: 'name_color', name: 'Sterrenhemel',        description: 'Twinkelende sterren',   price: 600,  nameClassName: 'cos-name-stars' },
  { id: 'name_belgian', category: 'name_color', name: 'Belgische Driekleur', description: 'Voor de Duivels',       price: 800,  nameClassName: 'cos-name-belgian' },
  { id: 'name_rainbow', category: 'name_color', name: 'Regenboog',           description: 'Legendarische status',  price: 2500, nameClassName: 'cos-name-rainbow' },

  // Row styles (sorted by price)
  { id: 'row_gold_border', category: 'row_style', name: 'Gouden Rand',     description: 'Subtiele gouden glow',               price: 300,  rowClassName: 'cos-row-gold' },
  { id: 'row_fire_glow',   category: 'row_style', name: 'Vurige Rand',     description: 'Vlammende gloed rond je rij',        price: 600,  rowClassName: 'cos-row-fire' },
  { id: 'row_ice_fill',    category: 'row_style', name: 'IJs Rand',        description: 'Bevroren kristal-rand',              price: 700,  rowClassName: 'cos-row-ice' },
  { id: 'row_blood',       category: 'row_style', name: 'Bloed',           description: 'Druppelend rood (schandpaal-stijl)', price: 750,  rowClassName: 'cos-row-blood' },
  { id: 'row_galaxy',      category: 'row_style', name: 'Galaxy Rand',     description: 'Buitenaardse paarse glow',           price: 900,  rowClassName: 'cos-row-galaxy' },
  { id: 'row_belgian_fill',category: 'row_style', name: 'Belgische Vlag',  description: 'Wapperende driekleur',               price: 1000, rowClassName: 'cos-row-belgian' },
  { id: 'row_confetti',    category: 'row_style', name: 'Confetti',        description: 'Vrolijke gekleurde dotjes',          price: 1200, rowClassName: 'cos-row-confetti' },
  { id: 'row_disco',       category: 'row_style', name: 'Disco',           description: 'Schuivende discolampen',             price: 1400, rowClassName: 'cos-row-disco' },
  { id: 'row_champagne',   category: 'row_style', name: 'Champagne',       description: 'Opstijgende gouden bubbels',         price: 1600, rowClassName: 'cos-row-champagne' },
  { id: 'row_lightning',   category: 'row_style', name: 'Bliksem',         description: 'Onverwachte witte flits',            price: 2000, rowClassName: 'cos-row-lightning' },
  { id: 'row_rainbow_fill',category: 'row_style', name: 'Regenboog Rand',  description: 'Alle kleuren tegelijk',              price: 2500, rowClassName: 'cos-row-rainbow' },
  { id: 'row_holo',        category: 'row_style', name: 'Holografisch',    description: 'Pareloplichtende schitter',          price: 3000, rowClassName: 'cos-row-holo' },
  { id: 'row_neon',        category: 'row_style', name: 'Neon Border',     description: 'Cyaan pulserende rand',              price: 3500, rowClassName: 'cos-row-neon' },

  // Titles (sorted by price)
  { id: 'title_keeper',     category: 'title', name: 'Klassen-keeper', description: 'Voor de stoppers',        price: 200,  title: '🧤 Klassen-keeper' },
  { id: 'title_bankzitter', category: 'title', name: 'Bankzitter',     description: 'Voor de eeuwige reserve', price: 200,  title: '🪑 Bankzitter' },
  { id: 'title_bondscoach', category: 'title', name: 'Bondscoach',     description: 'Bemoeit zich met alles',  price: 250,  title: '📋 Bondscoach' },
  { id: 'title_pintje',     category: 'title', name: 'Pintjes-koning', description: 'Drinkt veel pinten',      price: 300,  title: '🍺 Pintjes-koning' },
  { id: 'title_kdb',        category: 'title', name: 'De Bruyne',      description: 'Koninklijke status',      price: 400,  title: '👑 De Bruyne' },
  { id: 'title_legend',     category: 'title', name: 'De Legende',     description: 'Iconisch',                price: 500,  title: '⭐ De Legende' },
  { id: 'title_goat',       category: 'title', name: 'G.O.A.T.',       description: 'Greatest of all time',    price: 5000, title: '🐐 G.O.A.T.' },
];

const COSMETICS_BY_ID: Record<string, Cosmetic> = Object.fromEntries(COSMETICS.map(c => [c.id, c]));

export function getCosmetic(id: string | null | undefined): Cosmetic | null {
  if (!id) return null;
  return COSMETICS_BY_ID[id] || null;
}

export function getCosmeticsByCategory(category: CosmeticCategory): Cosmetic[] {
  return COSMETICS.filter(c => c.category === category);
}

export interface UserCosmeticsEquipped {
  nameColor: string | null;
  rowStyle: string | null;
  title: string | null;
}

export const EMPTY_EQUIPPED: UserCosmeticsEquipped = {
  nameColor: null,
  rowStyle: null,
  title: null,
};
