import { groupMatches, knockoutStructure } from './tournament';

// Dates when Belgium plays a group stage match
const belgianGroupDates = groupMatches
  .filter(m => m.home === 'BEL' || m.away === 'BEL')
  .map(m => m.date);

// Check if today is a Belgian match day
// Also checks knockout matches if Belgium is involved (would need actual results to know)
export function isBelgianMatchDay(): boolean {
  const today = new Date().toISOString().split('T')[0];
  return belgianGroupDates.includes(today);
}

// For testing: check any specific date
export function isBelgianMatchDate(date: string): boolean {
  return belgianGroupDates.includes(date);
}

// Get Belgian match dates for display
export function getBelgianMatchDates(): string[] {
  return belgianGroupDates;
}
