// WK 2026 Tournament Configuration
// 48 teams, 12 groups of 4, top 2 + 8 best 3rd = 32 knockout

export interface Team {
  code: string;
  name: string;
  flag: string;
}

export interface GroupMatch {
  matchNumber: number;
  date: string;
  time: string;
  home: string; // team code
  away: string; // team code
  group: string;
}

export interface KnockoutMatch {
  matchNumber: number;
  date: string;
  time: string;
  round: 'R32' | 'R16' | 'QF' | 'SF' | '3P' | 'F';
  homeSource: string; // e.g. "1A" or "W49"
  awaySource: string; // e.g. "2B" or "W50"
}

// All 48 teams
export const teams: Record<string, Team> = {
  // Group A
  MEX: { code: 'MEX', name: 'Mexico', flag: '🇲🇽' },
  RSA: { code: 'RSA', name: 'Zuid-Afrika', flag: '🇿🇦' },
  KOR: { code: 'KOR', name: 'Zuid-Korea', flag: '🇰🇷' },
  CZE: { code: 'CZE', name: 'Tsjechie', flag: '🇨🇿' },
  // Group B
  CAN: { code: 'CAN', name: 'Canada', flag: '🇨🇦' },
  BIH: { code: 'BIH', name: 'Bosnie & Herzegovina', flag: '🇧🇦' },
  QAT: { code: 'QAT', name: 'Qatar', flag: '🇶🇦' },
  SUI: { code: 'SUI', name: 'Zwitserland', flag: '🇨🇭' },
  // Group C
  BRA: { code: 'BRA', name: 'Brazilie', flag: '🇧🇷' },
  MAR: { code: 'MAR', name: 'Marokko', flag: '🇲🇦' },
  HAI: { code: 'HAI', name: 'Haiti', flag: '🇭🇹' },
  SCO: { code: 'SCO', name: 'Schotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  // Group D
  USA: { code: 'USA', name: 'Verenigde Staten', flag: '🇺🇸' },
  PAR: { code: 'PAR', name: 'Paraguay', flag: '🇵🇾' },
  AUS: { code: 'AUS', name: 'Australie', flag: '🇦🇺' },
  TUR: { code: 'TUR', name: 'Turkije', flag: '🇹🇷' },
  // Group E
  GER: { code: 'GER', name: 'Duitsland', flag: '🇩🇪' },
  CUW: { code: 'CUW', name: 'Curacao', flag: '🇨🇼' },
  CIV: { code: 'CIV', name: 'Ivoorkust', flag: '🇨🇮' },
  ECU: { code: 'ECU', name: 'Ecuador', flag: '🇪🇨' },
  // Group F
  NED: { code: 'NED', name: 'Nederland', flag: '🇳🇱' },
  JPN: { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  TUN: { code: 'TUN', name: 'Tunesie', flag: '🇹🇳' },
  SWE: { code: 'SWE', name: 'Zweden', flag: '🇸🇪' },
  // Group G
  BEL: { code: 'BEL', name: 'Belgie', flag: '🇧🇪' },
  EGY: { code: 'EGY', name: 'Egypte', flag: '🇪🇬' },
  IRN: { code: 'IRN', name: 'Iran', flag: '🇮🇷' },
  NZL: { code: 'NZL', name: 'Nieuw-Zeeland', flag: '🇳🇿' },
  // Group H
  ESP: { code: 'ESP', name: 'Spanje', flag: '🇪🇸' },
  CPV: { code: 'CPV', name: 'Kaapverdie', flag: '🇨🇻' },
  KSA: { code: 'KSA', name: 'Saudi-Arabie', flag: '🇸🇦' },
  URU: { code: 'URU', name: 'Uruguay', flag: '🇺🇾' },
  // Group I
  FRA: { code: 'FRA', name: 'Frankrijk', flag: '🇫🇷' },
  SEN: { code: 'SEN', name: 'Senegal', flag: '🇸🇳' },
  IRQ: { code: 'IRQ', name: 'Irak', flag: '🇮🇶' },
  NOR: { code: 'NOR', name: 'Noorwegen', flag: '🇳🇴' },
  // Group J
  ARG: { code: 'ARG', name: 'Argentinie', flag: '🇦🇷' },
  ALG: { code: 'ALG', name: 'Algerije', flag: '🇩🇿' },
  AUT: { code: 'AUT', name: 'Oostenrijk', flag: '🇦🇹' },
  JOR: { code: 'JOR', name: 'Jordanie', flag: '🇯🇴' },
  // Group K
  POR: { code: 'POR', name: 'Portugal', flag: '🇵🇹' },
  COD: { code: 'COD', name: 'DR Congo', flag: '🇨🇩' },
  UZB: { code: 'UZB', name: 'Oezbekistan', flag: '🇺🇿' },
  COL: { code: 'COL', name: 'Colombia', flag: '🇨🇴' },
  // Group L
  ENG: { code: 'ENG', name: 'Engeland', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  CRO: { code: 'CRO', name: 'Kroatie', flag: '🇭🇷' },
  GHA: { code: 'GHA', name: 'Ghana', flag: '🇬🇭' },
  PAN: { code: 'PAN', name: 'Panama', flag: '🇵🇦' },
};

export const groups: Record<string, string[]> = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'QAT', 'SUI'],
  C: ['BRA', 'MAR', 'HAI', 'SCO'],
  D: ['USA', 'PAR', 'AUS', 'TUR'],
  E: ['GER', 'CUW', 'CIV', 'ECU'],
  F: ['NED', 'JPN', 'TUN', 'SWE'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'KSA', 'URU'],
  I: ['FRA', 'SEN', 'IRQ', 'NOR'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'],
  K: ['POR', 'COD', 'UZB', 'COL'],
  L: ['ENG', 'CRO', 'GHA', 'PAN'],
};

// All 72 group stage matches with real WK 2026 dates/times (CEST, UTC+2)
export const groupMatches: GroupMatch[] = [
  // === Matchday 1 ===
  // June 11
  { matchNumber: 1, date: '2026-06-11', time: '21:00', home: 'MEX', away: 'RSA', group: 'A' },
  // June 12
  { matchNumber: 2, date: '2026-06-12', time: '04:00', home: 'KOR', away: 'CZE', group: 'A' },
  { matchNumber: 3, date: '2026-06-12', time: '21:00', home: 'CAN', away: 'BIH', group: 'B' },
  // June 13
  { matchNumber: 4, date: '2026-06-13', time: '03:00', home: 'USA', away: 'PAR', group: 'D' },
  { matchNumber: 5, date: '2026-06-13', time: '21:00', home: 'QAT', away: 'SUI', group: 'B' },
  // June 14
  { matchNumber: 6, date: '2026-06-14', time: '00:00', home: 'BRA', away: 'MAR', group: 'C' },
  { matchNumber: 7, date: '2026-06-14', time: '03:00', home: 'HAI', away: 'SCO', group: 'C' },
  { matchNumber: 8, date: '2026-06-14', time: '06:00', home: 'AUS', away: 'TUR', group: 'D' },
  { matchNumber: 9, date: '2026-06-14', time: '19:00', home: 'GER', away: 'CUW', group: 'E' },
  { matchNumber: 10, date: '2026-06-14', time: '22:00', home: 'NED', away: 'JPN', group: 'F' },
  // June 15
  { matchNumber: 11, date: '2026-06-15', time: '01:00', home: 'CIV', away: 'ECU', group: 'E' },
  { matchNumber: 12, date: '2026-06-15', time: '04:00', home: 'SWE', away: 'TUN', group: 'F' },
  { matchNumber: 13, date: '2026-06-15', time: '18:00', home: 'ESP', away: 'CPV', group: 'H' },
  { matchNumber: 14, date: '2026-06-15', time: '21:00', home: 'BEL', away: 'EGY', group: 'G' },
  // June 16
  { matchNumber: 15, date: '2026-06-16', time: '00:00', home: 'KSA', away: 'URU', group: 'H' },
  { matchNumber: 16, date: '2026-06-16', time: '03:00', home: 'IRN', away: 'NZL', group: 'G' },
  { matchNumber: 17, date: '2026-06-16', time: '21:00', home: 'FRA', away: 'SEN', group: 'I' },
  // June 17
  { matchNumber: 18, date: '2026-06-17', time: '00:00', home: 'IRQ', away: 'NOR', group: 'I' },
  { matchNumber: 19, date: '2026-06-17', time: '03:00', home: 'ARG', away: 'ALG', group: 'J' },
  { matchNumber: 20, date: '2026-06-17', time: '06:00', home: 'AUT', away: 'JOR', group: 'J' },
  { matchNumber: 21, date: '2026-06-17', time: '19:00', home: 'POR', away: 'COD', group: 'K' },
  { matchNumber: 22, date: '2026-06-17', time: '22:00', home: 'ENG', away: 'CRO', group: 'L' },
  // June 18
  { matchNumber: 23, date: '2026-06-18', time: '01:00', home: 'GHA', away: 'PAN', group: 'L' },
  { matchNumber: 24, date: '2026-06-18', time: '04:00', home: 'UZB', away: 'COL', group: 'K' },

  // === Matchday 2 ===
  // June 18
  { matchNumber: 25, date: '2026-06-18', time: '18:00', home: 'CZE', away: 'RSA', group: 'A' },
  { matchNumber: 26, date: '2026-06-18', time: '21:00', home: 'SUI', away: 'BIH', group: 'B' },
  // June 19
  { matchNumber: 27, date: '2026-06-19', time: '00:00', home: 'CAN', away: 'QAT', group: 'B' },
  { matchNumber: 28, date: '2026-06-19', time: '03:00', home: 'MEX', away: 'KOR', group: 'A' },
  { matchNumber: 29, date: '2026-06-19', time: '21:00', home: 'USA', away: 'AUS', group: 'D' },
  // June 20
  { matchNumber: 30, date: '2026-06-20', time: '00:00', home: 'SCO', away: 'MAR', group: 'C' },
  { matchNumber: 31, date: '2026-06-20', time: '02:30', home: 'BRA', away: 'HAI', group: 'C' },
  { matchNumber: 32, date: '2026-06-20', time: '05:00', home: 'TUR', away: 'PAR', group: 'D' },
  { matchNumber: 33, date: '2026-06-20', time: '19:00', home: 'NED', away: 'SWE', group: 'F' },
  { matchNumber: 34, date: '2026-06-20', time: '22:00', home: 'GER', away: 'CIV', group: 'E' },
  // June 21
  { matchNumber: 35, date: '2026-06-21', time: '02:00', home: 'ECU', away: 'CUW', group: 'E' },
  { matchNumber: 36, date: '2026-06-21', time: '06:00', home: 'TUN', away: 'JPN', group: 'F' },
  { matchNumber: 37, date: '2026-06-21', time: '18:00', home: 'ESP', away: 'KSA', group: 'H' },
  { matchNumber: 38, date: '2026-06-21', time: '21:00', home: 'BEL', away: 'IRN', group: 'G' },
  // June 22
  { matchNumber: 39, date: '2026-06-22', time: '00:00', home: 'URU', away: 'CPV', group: 'H' },
  { matchNumber: 40, date: '2026-06-22', time: '03:00', home: 'NZL', away: 'EGY', group: 'G' },
  { matchNumber: 41, date: '2026-06-22', time: '19:00', home: 'ARG', away: 'AUT', group: 'J' },
  { matchNumber: 42, date: '2026-06-22', time: '23:00', home: 'FRA', away: 'IRQ', group: 'I' },
  // June 23
  { matchNumber: 43, date: '2026-06-23', time: '02:00', home: 'NOR', away: 'SEN', group: 'I' },
  { matchNumber: 44, date: '2026-06-23', time: '05:00', home: 'JOR', away: 'ALG', group: 'J' },
  { matchNumber: 45, date: '2026-06-23', time: '19:00', home: 'POR', away: 'UZB', group: 'K' },
  { matchNumber: 46, date: '2026-06-23', time: '22:00', home: 'ENG', away: 'GHA', group: 'L' },
  // June 24
  { matchNumber: 47, date: '2026-06-24', time: '01:00', home: 'PAN', away: 'CRO', group: 'L' },
  { matchNumber: 48, date: '2026-06-24', time: '04:00', home: 'COL', away: 'COD', group: 'K' },

  // === Matchday 3 ===
  // June 24
  { matchNumber: 49, date: '2026-06-24', time: '21:00', home: 'SUI', away: 'CAN', group: 'B' },
  { matchNumber: 50, date: '2026-06-24', time: '21:00', home: 'BIH', away: 'QAT', group: 'B' },
  // June 25
  { matchNumber: 51, date: '2026-06-25', time: '00:00', home: 'MAR', away: 'HAI', group: 'C' },
  { matchNumber: 52, date: '2026-06-25', time: '00:00', home: 'SCO', away: 'BRA', group: 'C' },
  { matchNumber: 53, date: '2026-06-25', time: '03:00', home: 'RSA', away: 'KOR', group: 'A' },
  { matchNumber: 54, date: '2026-06-25', time: '03:00', home: 'CZE', away: 'MEX', group: 'A' },
  { matchNumber: 55, date: '2026-06-25', time: '22:00', home: 'CUW', away: 'CIV', group: 'E' },
  { matchNumber: 56, date: '2026-06-25', time: '22:00', home: 'ECU', away: 'GER', group: 'E' },
  // June 26
  { matchNumber: 57, date: '2026-06-26', time: '01:00', home: 'TUN', away: 'NED', group: 'F' },
  { matchNumber: 58, date: '2026-06-26', time: '01:00', home: 'JPN', away: 'SWE', group: 'F' },
  { matchNumber: 59, date: '2026-06-26', time: '04:00', home: 'TUR', away: 'USA', group: 'D' },
  { matchNumber: 60, date: '2026-06-26', time: '04:00', home: 'PAR', away: 'AUS', group: 'D' },
  { matchNumber: 61, date: '2026-06-26', time: '21:00', home: 'NOR', away: 'FRA', group: 'I' },
  { matchNumber: 62, date: '2026-06-26', time: '21:00', home: 'SEN', away: 'IRQ', group: 'I' },
  // June 27
  { matchNumber: 63, date: '2026-06-27', time: '02:00', home: 'CPV', away: 'KSA', group: 'H' },
  { matchNumber: 64, date: '2026-06-27', time: '02:00', home: 'URU', away: 'ESP', group: 'H' },
  { matchNumber: 65, date: '2026-06-27', time: '05:00', home: 'NZL', away: 'BEL', group: 'G' },
  { matchNumber: 66, date: '2026-06-27', time: '05:00', home: 'EGY', away: 'IRN', group: 'G' },
  { matchNumber: 67, date: '2026-06-27', time: '23:00', home: 'PAN', away: 'ENG', group: 'L' },
  { matchNumber: 68, date: '2026-06-27', time: '23:00', home: 'CRO', away: 'GHA', group: 'L' },
  // June 28
  { matchNumber: 69, date: '2026-06-28', time: '01:30', home: 'COL', away: 'POR', group: 'K' },
  { matchNumber: 70, date: '2026-06-28', time: '01:30', home: 'COD', away: 'UZB', group: 'K' },
  { matchNumber: 71, date: '2026-06-28', time: '04:00', home: 'ALG', away: 'AUT', group: 'J' },
  { matchNumber: 72, date: '2026-06-28', time: '04:00', home: 'JOR', away: 'ARG', group: 'J' },
];

// Knockout bracket structure for WK 2026 (times in CEST, UTC+2)
// R32: matches 73-88, R16: 89-96, QF: 97-100, SF: 101-102, 3P: 103, F: 104
export const knockoutStructure: KnockoutMatch[] = [
  // Round of 32 (16 matches)
  { matchNumber: 73, date: '2026-06-28', time: '21:00', round: 'R32', homeSource: '2A', awaySource: '2B' },
  { matchNumber: 74, date: '2026-06-29', time: '22:30', round: 'R32', homeSource: '1E', awaySource: '3RD_ABCDF' },
  { matchNumber: 75, date: '2026-06-30', time: '03:00', round: 'R32', homeSource: '1F', awaySource: '2C' },
  { matchNumber: 76, date: '2026-06-29', time: '19:00', round: 'R32', homeSource: '1C', awaySource: '2F' },
  { matchNumber: 77, date: '2026-06-30', time: '23:00', round: 'R32', homeSource: '1I', awaySource: '3RD_CDFGH' },
  { matchNumber: 78, date: '2026-06-30', time: '19:00', round: 'R32', homeSource: '2E', awaySource: '2I' },
  { matchNumber: 79, date: '2026-07-01', time: '03:00', round: 'R32', homeSource: '1A', awaySource: '3RD_CEFHI' },
  { matchNumber: 80, date: '2026-07-01', time: '18:00', round: 'R32', homeSource: '1L', awaySource: '3RD_EHIJK' },
  { matchNumber: 81, date: '2026-07-02', time: '02:00', round: 'R32', homeSource: '1D', awaySource: '3RD_BEFIJ' },
  { matchNumber: 82, date: '2026-07-01', time: '22:00', round: 'R32', homeSource: '1G', awaySource: '3RD_AEHIJ' },
  { matchNumber: 83, date: '2026-07-03', time: '01:00', round: 'R32', homeSource: '2K', awaySource: '2L' },
  { matchNumber: 84, date: '2026-07-02', time: '21:00', round: 'R32', homeSource: '1H', awaySource: '2J' },
  { matchNumber: 85, date: '2026-07-03', time: '05:00', round: 'R32', homeSource: '1B', awaySource: '3RD_EFGIJ' },
  { matchNumber: 86, date: '2026-07-04', time: '00:00', round: 'R32', homeSource: '1J', awaySource: '2H' },
  { matchNumber: 87, date: '2026-07-04', time: '03:30', round: 'R32', homeSource: '1K', awaySource: '3RD_DEIJL' },
  { matchNumber: 88, date: '2026-07-03', time: '20:00', round: 'R32', homeSource: '2D', awaySource: '2G' },

  // Round of 16 (8 matches)
  { matchNumber: 89, date: '2026-07-04', time: '23:00', round: 'R16', homeSource: 'W74', awaySource: 'W77' },
  { matchNumber: 90, date: '2026-07-04', time: '19:00', round: 'R16', homeSource: 'W73', awaySource: 'W75' },
  { matchNumber: 91, date: '2026-07-05', time: '22:00', round: 'R16', homeSource: 'W76', awaySource: 'W78' },
  { matchNumber: 92, date: '2026-07-06', time: '02:00', round: 'R16', homeSource: 'W79', awaySource: 'W80' },
  { matchNumber: 93, date: '2026-07-06', time: '21:00', round: 'R16', homeSource: 'W83', awaySource: 'W84' },
  { matchNumber: 94, date: '2026-07-07', time: '02:00', round: 'R16', homeSource: 'W81', awaySource: 'W82' },
  { matchNumber: 95, date: '2026-07-07', time: '18:00', round: 'R16', homeSource: 'W86', awaySource: 'W88' },
  { matchNumber: 96, date: '2026-07-07', time: '22:00', round: 'R16', homeSource: 'W85', awaySource: 'W87' },

  // Quarter-finals (4 matches)
  { matchNumber: 97, date: '2026-07-09', time: '22:00', round: 'QF', homeSource: 'W89', awaySource: 'W90' },
  { matchNumber: 98, date: '2026-07-10', time: '21:00', round: 'QF', homeSource: 'W93', awaySource: 'W94' },
  { matchNumber: 99, date: '2026-07-11', time: '23:00', round: 'QF', homeSource: 'W91', awaySource: 'W92' },
  { matchNumber: 100, date: '2026-07-12', time: '03:00', round: 'QF', homeSource: 'W95', awaySource: 'W96' },

  // Semi-finals (2 matches)
  { matchNumber: 101, date: '2026-07-14', time: '21:00', round: 'SF', homeSource: 'W97', awaySource: 'W98' },
  { matchNumber: 102, date: '2026-07-15', time: '21:00', round: 'SF', homeSource: 'W99', awaySource: 'W100' },

  // Third place match
  { matchNumber: 103, date: '2026-07-18', time: '23:00', round: '3P', homeSource: 'L101', awaySource: 'L102' },

  // Final
  { matchNumber: 104, date: '2026-07-19', time: '21:00', round: 'F', homeSource: 'W101', awaySource: 'W102' },
];

export const TOTAL_GROUP_MATCHES = 72;
export const TOTAL_MATCHES = 104;

// All predictions deadline = kickoff of match 1
export const TOURNAMENT_DEADLINE = new Date(`${groupMatches[0].date}T${groupMatches[0].time}:00+02:00`);

// Extra-vragen deadline = middernacht na de eerste matchdag (einde openingsdag, CEST)
export const EXTRA_DEADLINE = (() => {
  const d = new Date(`${groupMatches[0].date}T00:00:00+02:00`);
  d.setDate(d.getDate() + 1);
  return d;
})();

export function isExtraLocked(): boolean {
  return new Date() >= EXTRA_DEADLINE;
}

export function getMatchKickoff(matchNumber: number): Date | null {
  const gm = groupMatches.find(m => m.matchNumber === matchNumber);
  if (gm) return new Date(`${gm.date}T${gm.time}:00+02:00`);
  const km = knockoutStructure.find(m => m.matchNumber === matchNumber);
  if (km) return new Date(`${km.date}T${km.time}:00+02:00`);
  return null;
}

export function isMatchLocked(matchNumber: number): boolean {
  const kickoff = getMatchKickoff(matchNumber);
  if (!kickoff) return false;
  return new Date() >= kickoff;
}

export function getLockedMatches(): Set<number> {
  const locked = new Set<number>();
  const now = new Date();
  for (const m of groupMatches) {
    const kickoff = new Date(`${m.date}T${m.time}:00+02:00`);
    if (now >= kickoff) locked.add(m.matchNumber);
  }
  for (const m of knockoutStructure) {
    const kickoff = new Date(`${m.date}T${m.time}:00+02:00`);
    if (now >= kickoff) locked.add(m.matchNumber);
  }
  return locked;
}

// Format a deadline nicely: "za 14 jun 21:00"
export function formatDeadline(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00+02:00`);
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${time}`;
}

// Turn a raw knockout source code into a readable Dutch label, used when the
// actual team isn't known yet. Examples:
//   "1A"          -> "1e groep A"
//   "2B"          -> "2e groep B"
//   "3RD_ABCDF"   -> "Beste 3e (A/B/C/D/F)"
//   "W73"         -> "Winnaar wedstrijd 73"
//   "L101"        -> "Verliezer wedstrijd 101"
export function formatSourceLabel(source: string): string {
  if (/^[12][A-L]$/.test(source)) {
    return `${source[0]}e groep ${source[1]}`;
  }
  if (source.startsWith('3RD_')) {
    return `Beste 3e (${source.slice(4).split('').join('/')})`;
  }
  if (/^W\d+$/.test(source)) {
    return `Winnaar wedstrijd ${source.slice(1)}`;
  }
  if (/^L\d+$/.test(source)) {
    return `Verliezer wedstrijd ${source.slice(1)}`;
  }
  return source;
}

export function getRoundName(round: string): string {
  const names: Record<string, string> = {
    R32: 'Ronde van 32',
    R16: 'Achtste Finales',
    QF: 'Kwartfinales',
    SF: 'Halve Finales',
    '3P': 'Troostfinale',
    F: 'Finale',
  };
  return names[round] || round;
}
