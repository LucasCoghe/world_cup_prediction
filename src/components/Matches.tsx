'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  groupMatches,
  knockoutStructure,
  teams,
  getRoundName,
  formatDeadline,
  formatSourceLabel,
  TOTAL_GROUP_MATCHES,
} from '@/lib/tournament';
import { calculateGroupStandings, getBestThirdPlaced } from '@/lib/standings';
import { calculateMatchPoints } from '@/lib/scoring';
import type { PredictionsState } from '@/hooks/usePredictions';
import FlagIcon from './FlagIcon';

interface Props {
  predictions: PredictionsState;
  targetMatchNumber?: number | null;
  targetNonce?: number;
}

interface UnifiedMatch {
  matchNumber: number;
  kickoff: Date;
  date: string;
  time: string;
  homeCode: string | null;
  awayCode: string | null;
  homeName: string;
  awayName: string;
  homeSource?: string;
  awaySource?: string;
  involvesBelgium: boolean;
  isKnockout: boolean;
  group?: string;
  round?: string;
}

interface ActualResultMap {
  [matchNumber: number]: {
    homeScore: number;
    awayScore: number;
    advancingTeam: string | null;
    live: boolean;
  };
}

interface OtherPrediction {
  userName: string;
  homeScore: number;
  awayScore: number;
  jokerUsed: boolean;
}

type FilterKind = 'all' | 'live' | 'played' | 'belgium';
type ViewMode = 'timeline' | 'standen';

const LIVE_BUFFER_MS = 150 * 60 * 1000;
const MAX_GROUP_JOKERS = 3;
const MAX_KNOCKOUT_JOKERS = 2;

const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function todayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayHeader(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Brussels',
  }).format(d);
}

export default function Matches({ predictions, targetMatchNumber, targetNonce }: Props) {
  const [view, setView] = useState<ViewMode>('timeline');
  const [filter, setFilter] = useState<FilterKind>('all');
  const [activeGroup, setActiveGroup] = useState('A');
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const [koResolved, setKoResolved] = useState<Record<number, { homeTeam: string | null; awayTeam: string | null }>>({});
  const [results, setResults] = useState<ActualResultMap>({});
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [allPredictions, setAllPredictions] = useState<Record<number, OtherPrediction[]>>({});

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/knockout-teams').then(r => r.ok ? r.json() : { teams: {} }).then(d => setKoResolved(d.teams || {})).catch(() => {});
    fetch('/api/results').then(r => r.ok ? r.json() : { results: [] }).then(d => {
      const map: ActualResultMap = {};
      for (const r of d.results || []) {
        map[r.matchNumber] = {
          homeScore: r.homeScore,
          awayScore: r.awayScore,
          advancingTeam: r.advancingTeam ?? null,
          live: !!r.live,
        };
      }
      setResults(map);
    }).catch(() => {}).finally(() => setResultsLoaded(true));
    fetch('/api/all-predictions').then(r => r.ok ? r.json() : { predictions: {} }).then(d => setAllPredictions(d.predictions || {})).catch(() => {});
  }, []);

  const unifiedMatches = useMemo<UnifiedMatch[]>(() => {
    const list: UnifiedMatch[] = [];
    for (const m of groupMatches) {
      const home = teams[m.home];
      const away = teams[m.away];
      list.push({
        matchNumber: m.matchNumber,
        kickoff: new Date(`${m.date}T${m.time}:00+02:00`),
        date: m.date,
        time: m.time,
        homeCode: m.home,
        awayCode: m.away,
        homeName: home?.name ?? m.home,
        awayName: away?.name ?? m.away,
        involvesBelgium: m.home === 'BEL' || m.away === 'BEL',
        isKnockout: false,
        group: m.group,
      });
    }
    for (const km of knockoutStructure) {
      const resolved = koResolved[km.matchNumber];
      const homeCode = resolved?.homeTeam ?? null;
      const awayCode = resolved?.awayTeam ?? null;
      const home = homeCode ? teams[homeCode] : null;
      const away = awayCode ? teams[awayCode] : null;
      list.push({
        matchNumber: km.matchNumber,
        kickoff: new Date(`${km.date}T${km.time}:00+02:00`),
        date: km.date,
        time: km.time,
        homeCode,
        awayCode,
        homeName: home?.name ?? homeCode ?? formatSourceLabel(km.homeSource),
        awayName: away?.name ?? awayCode ?? formatSourceLabel(km.awaySource),
        homeSource: km.homeSource,
        awaySource: km.awaySource,
        involvesBelgium: homeCode === 'BEL' || awayCode === 'BEL',
        isKnockout: true,
        round: km.round,
      });
    }
    return list.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  }, [koResolved]);

  const isLive = useCallback((m: UnifiedMatch): boolean => {
    const r = results[m.matchNumber];
    if (r?.live) return true;
    const since = now.getTime() - m.kickoff.getTime();
    return since >= 0 && since < LIVE_BUFFER_MS && !r;
  }, [results, now]);

  const todayStr = todayKey(now);

  const filteredMatches = useMemo(() => {
    return unifiedMatches.filter(m => {
      if (filter === 'live') return isLive(m);
      if (filter === 'played') {
        const r = results[m.matchNumber];
        return r && !r.live;
      }
      if (filter === 'belgium') return m.involvesBelgium;
      return true;
    });
  }, [unifiedMatches, filter, results, isLive]);

  const sections = useMemo(() => {
    const live: UnifiedMatch[] = [];
    const todays: UnifiedMatch[] = [];
    const upcoming: UnifiedMatch[] = [];
    const played: UnifiedMatch[] = [];

    for (const m of filteredMatches) {
      if (isLive(m)) {
        live.push(m);
        continue;
      }
      const r = results[m.matchNumber];
      if (r && !r.live) {
        played.push(m);
        continue;
      }
      if (m.date === todayStr) {
        todays.push(m);
        continue;
      }
      if (m.kickoff.getTime() > now.getTime()) {
        upcoming.push(m);
      } else {
        played.push(m);
      }
    }

    played.sort((a, b) => b.kickoff.getTime() - a.kickoff.getTime());

    return { live, todays, upcoming, played };
  }, [filteredMatches, isLive, results, todayStr, now]);

  // Group upcoming/played/today matches by date for display
  const groupByDate = (list: UnifiedMatch[]): Array<{ key: string; label: string; matches: UnifiedMatch[] }> => {
    const result: Array<{ key: string; label: string; matches: UnifiedMatch[] }> = [];
    for (const m of list) {
      const last = result[result.length - 1];
      if (last && last.key === m.date) {
        last.matches.push(m);
      } else {
        result.push({ key: m.date, label: formatDayHeader(m.date), matches: [m] });
      }
    }
    return result;
  };

  useEffect(() => {
    if (targetMatchNumber == null) return;
    setView('timeline');
    setExpandedMatch(targetMatchNumber);
    const id = setTimeout(() => {
      const el = document.getElementById(`m-row-${targetMatchNumber}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    return () => clearTimeout(id);
  }, [targetMatchNumber, targetNonce]);

  const groupJokersUsed = [...predictions.jokers].filter(m => m <= TOTAL_GROUP_MATCHES).length;
  const knockoutJokersUsed = [...predictions.jokers].filter(m => m > TOTAL_GROUP_MATCHES).length;

  // Standen sub-view — gebaseerd op echte uitslagen, niet voorspellingen
  const actualScores = useMemo(() => {
    const list: { matchNumber: number; homeScore: number; awayScore: number; advancingTeam?: string }[] = [];
    for (const [numStr, r] of Object.entries(results)) {
      list.push({
        matchNumber: Number(numStr),
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        advancingTeam: r.advancingTeam ?? undefined,
      });
    }
    return list;
  }, [results]);
  const standings = useMemo(() => calculateGroupStandings(actualScores), [actualScores]);
  const bestThirds = useMemo(() => getBestThirdPlaced(standings), [standings]);
  const currentStanding = standings[activeGroup] || [];
  const hasResults = actualScores.length > 0;

  const FILTER_CHIPS: Array<{ id: FilterKind; label: string }> = [
    { id: 'all', label: 'Alles' },
    { id: 'live', label: 'Live' },
    { id: 'played', label: 'Gespeeld' },
    { id: 'belgium', label: 'Belgie' },
  ];

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Matchen</h2>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>Groep-jokers: <span className={`font-bold ${MAX_GROUP_JOKERS - groupJokersUsed === 0 ? 'text-red-400' : 'text-gold'}`}>{MAX_GROUP_JOKERS - groupJokersUsed}/{MAX_GROUP_JOKERS}</span></span>
          <span>KO-jokers: <span className={`font-bold ${MAX_KNOCKOUT_JOKERS - knockoutJokersUsed === 0 ? 'text-red-400' : 'text-gold'}`}>{MAX_KNOCKOUT_JOKERS - knockoutJokersUsed}/{MAX_KNOCKOUT_JOKERS}</span></span>
          {predictions.saving && <span className="text-gold">Opslaan...</span>}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
        <button
          onClick={() => setView('timeline')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'timeline' ? 'bg-gold/20 text-gold' : 'text-gray-400 hover:text-white'}`}
        >
          Tijdlijn
        </button>
        <button
          onClick={() => setView('standen')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'standen' ? 'bg-gold/20 text-gold' : 'text-gray-400 hover:text-white'}`}
        >
          Standen
        </button>
      </div>

      {predictions.duplicateJokerGroups.length > 0 && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-sm text-red-300">
          <strong className="text-red-400">Let op!</strong> Je hebt meerdere jokers in dezelfde groep ({predictions.duplicateJokerGroups.map(g => `Groep ${g}`).join(', ')}). Verwijder er een per groep, anders kan je niet opslaan.
        </div>
      )}

      {view === 'timeline' && (
        <>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                  filter === chip.id
                    ? 'bg-gold/20 text-gold border-gold/40'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {!resultsLoaded ? (
            <div className="text-center text-gray-500 py-12 text-sm">Matchen laden...</div>
          ) : (
          <div className="space-y-6">
            {sections.live.length === 0 && sections.todays.length === 0 && sections.upcoming.length === 0 && sections.played.length === 0 && (
              <div className="card text-center text-gray-500 py-8">
                Geen matchen gevonden met deze filter.
              </div>
            )}

            {sections.live.length > 0 && (
              <Section title="Live nu" accent="red">
                {sections.live.map(m => (
                  <MatchRow
                    key={m.matchNumber}
                    match={m}
                    predictions={predictions}
                    result={results[m.matchNumber]}
                    otherPredictions={allPredictions[m.matchNumber]}
                    expanded={expandedMatch === m.matchNumber}
                    onToggleExpand={() => setExpandedMatch(expandedMatch === m.matchNumber ? null : m.matchNumber)}
                  />
                ))}
              </Section>
            )}

            {sections.todays.length > 0 && (
              <Section title="Vandaag">
                {groupByDate(sections.todays).map(group => (
                  <div key={group.key} className="space-y-2">
                    {group.matches.map(m => (
                      <MatchRow
                        key={m.matchNumber}
                        match={m}
                        predictions={predictions}
                        result={results[m.matchNumber]}
                        otherPredictions={allPredictions[m.matchNumber]}
                        expanded={expandedMatch === m.matchNumber}
                        onToggleExpand={() => setExpandedMatch(expandedMatch === m.matchNumber ? null : m.matchNumber)}
                      />
                    ))}
                  </div>
                ))}
              </Section>
            )}

            {sections.upcoming.length > 0 && (
              <Section title="Komende matchen">
                {groupByDate(sections.upcoming).map(group => (
                  <div key={group.key} className="space-y-2">
                    <h4 className="text-xs uppercase tracking-wider text-gold/70 font-semibold pl-1 capitalize">
                      {group.label}
                    </h4>
                    {group.matches.map(m => (
                      <MatchRow
                        key={m.matchNumber}
                        match={m}
                        predictions={predictions}
                        result={results[m.matchNumber]}
                        otherPredictions={allPredictions[m.matchNumber]}
                        expanded={expandedMatch === m.matchNumber}
                        onToggleExpand={() => setExpandedMatch(expandedMatch === m.matchNumber ? null : m.matchNumber)}
                      />
                    ))}
                  </div>
                ))}
              </Section>
            )}

            {sections.played.length > 0 && (
              <Section title="Recent gespeeld">
                {groupByDate(sections.played).map(group => (
                  <div key={group.key} className="space-y-2">
                    <h4 className="text-xs uppercase tracking-wider text-gold/70 font-semibold pl-1 capitalize">
                      {group.label}
                    </h4>
                    {group.matches.map(m => (
                      <MatchRow
                        key={m.matchNumber}
                        match={m}
                        predictions={predictions}
                        result={results[m.matchNumber]}
                        otherPredictions={allPredictions[m.matchNumber]}
                        expanded={expandedMatch === m.matchNumber}
                        onToggleExpand={() => setExpandedMatch(expandedMatch === m.matchNumber ? null : m.matchNumber)}
                      />
                    ))}
                  </div>
                ))}
              </Section>
            )}
          </div>
          )}
        </>
      )}

      {view === 'standen' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-400">
            Echte tussenstanden op basis van gespeelde uitslagen. Voor je eigen voorspelde stand: zie de Simulator.
          </p>
          {!hasResults && (
            <div className="card text-center text-gray-500 py-6 text-sm">
              Nog geen gespeelde matchen. Standen verschijnen zodra de eerste uitslagen binnen zijn.
            </div>
          )}
          {/* Group selector */}
          <div className="flex flex-wrap gap-2">
            {groupLabels.map(g => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`w-11 h-11 rounded-lg font-bold text-base transition-all ${
                  activeGroup === g ? 'tab-active' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="card">
            <h3 className="text-base font-semibold mb-3 text-gold uppercase tracking-wide">
              Stand Groep {activeGroup}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full group-table">
                <thead>
                  <tr className="border-b border-white/10 text-sm text-gold uppercase">
                    <th className="text-left py-2 pl-3 pr-1 w-10">#</th>
                    <th className="text-left py-2 pl-3">Team</th>
                    <th className="text-center py-2 px-2">W</th>
                    <th className="text-center py-2 px-2">G</th>
                    <th className="text-center py-2 px-2">V</th>
                    <th className="text-center py-2 px-2">DV</th>
                    <th className="text-center py-2 px-2">DT</th>
                    <th className="text-center py-2 px-2">DS</th>
                    <th className="text-center py-2 px-2 font-bold">Ptn</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStanding.map((team, i) => {
                    const t = teams[team.code];
                    return (
                      <tr
                        key={team.code}
                        className={`border-b border-white/5 ${
                          i < 2 ? 'qualify-1' : i === 2 ? 'qualify-3' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-3 pr-1 text-gray-500 w-8">{i + 1}</td>
                        <td className="py-2.5 pl-2 pr-2 text-sm font-medium">
                          <span className="flex items-center gap-1.5">
                            {t && <FlagIcon teamCode={t.code} size={16} />}
                            <span className="leading-tight">{t?.name}</span>
                          </span>
                        </td>
                        <td className="text-center">{team.won}</td>
                        <td className="text-center">{team.drawn}</td>
                        <td className="text-center">{team.lost}</td>
                        <td className="text-center">{team.goalsFor}</td>
                        <td className="text-center">{team.goalsAgainst}</td>
                        <td className="text-center">{team.goalDiff > 0 ? '+' : ''}{team.goalDiff}</td>
                        <td className="text-center font-bold text-white text-base">{team.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pitch-light inline-block"></span>
                Ronde van 32
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-600 inline-block"></span>
                Mogelijke kwalificatie (beste 3e)
              </span>
            </div>
          </div>

          <div className="card">
            <h3 className="text-base font-semibold mb-3 text-gold uppercase tracking-wide">
              Beste Derden (top 8 gaan door)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {bestThirds.map((bt, i) => {
                const t = teams[bt.team.code];
                return (
                  <div
                    key={bt.team.code}
                    className={`flex items-center gap-2 p-2.5 rounded-lg min-w-0 ${
                      i < 8 ? 'bg-yellow-600/10 border border-yellow-600/30' : 'bg-white/5'
                    }`}
                  >
                    <span className="text-sm text-gray-500 shrink-0">{i + 1}.</span>
                    {t && <FlagIcon teamCode={t.code} size={14} />}
                    <span className="text-sm font-medium truncate min-w-0 flex-1">{t?.name}</span>
                    <span className="text-sm text-gray-500 shrink-0">{bt.team.points}p</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: 'red';
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={`text-sm uppercase tracking-wider font-semibold mb-2 ${accent === 'red' ? 'text-red-300' : 'text-white/70'}`}>
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MatchRow({
  match,
  predictions,
  result,
  otherPredictions,
  expanded,
  onToggleExpand,
}: {
  match: UnifiedMatch;
  predictions: PredictionsState;
  result?: ActualResultMap[number];
  otherPredictions?: OtherPrediction[];
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const pred = predictions.scores.get(match.matchNumber);
  const locked = predictions.lockedMatches.has(match.matchNumber) || predictions.userLocked;
  const isJoker = predictions.jokers.has(match.matchNumber);
  const isKO = match.isKnockout;
  const teamsKnown = match.homeCode != null && match.awayCode != null;
  const deadline = formatDeadline(match.date, match.time);
  const isPlayed = result && !result.live;
  const isLive = result?.live === true;
  const groupJokersUsed = [...predictions.jokers].filter(m => m <= TOTAL_GROUP_MATCHES).length;
  const knockoutJokersUsed = [...predictions.jokers].filter(m => m > TOTAL_GROUP_MATCHES).length;
  const groupAlreadyHasJoker = !isJoker && !isKO && match.group ? predictions.groupHasJoker(match.group) : false;
  const jokerCapReached = isKO
    ? knockoutJokersUsed >= MAX_KNOCKOUT_JOKERS
    : groupJokersUsed >= MAX_GROUP_JOKERS;
  const canToggleJoker = !locked && teamsKnown && (isJoker || (!jokerCapReached && !groupAlreadyHasJoker));

  const earnedPoints = isPlayed && pred
    ? calculateMatchPoints(
        { matchNumber: match.matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore },
        { matchNumber: match.matchNumber, homeScore: result.homeScore, awayScore: result.awayScore, advancingTeam: result.advancingTeam ?? undefined },
        isJoker,
        isKO,
        match.homeCode ?? undefined,
        match.awayCode ?? undefined,
      )
    : null;

  // Knockout draw resolver
  const predIsDraw = pred && pred.homeScore === pred.awayScore;

  return (
    <div id={`m-row-${match.matchNumber}`}>
      <div
        className={`match-row rounded-lg p-3 ${locked && !isLive ? (isPlayed ? '' : 'opacity-60') : ''} ${
          isJoker ? 'ring-2 ring-purple-500/60 bg-purple-950/15' : ''
        } ${isLive ? 'ring-1 ring-red-500/50 bg-red-950/15' : ''}`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-gray-500">#{match.matchNumber}</span>
            {match.group && <span className="text-xs text-gold/70 font-medium">Groep {match.group}</span>}
            {match.round && <span className="text-xs text-purple-300 font-medium">{getRoundName(match.round)}</span>}
            {isJoker && <span className="text-[10px] font-bold text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">JOKER</span>}
          </div>
          <span className={`deadline-text text-xs ${locked ? 'locked' : ''}`}>
            {isLive ? (
              <span className="text-red-300 font-bold inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            ) : isPlayed ? (
              <span className="text-emerald-300/80">Beeindigd · {deadline}</span>
            ) : locked ? `Afgesloten · ${deadline}` : `Aftrap · ${deadline}`}
          </span>
        </div>

        {!teamsKnown && isKO ? (
          <div className="text-center text-gray-500 py-2 text-sm italic">
            {formatSourceLabel(match.homeSource!)} vs {formatSourceLabel(match.awaySource!)} — teams nog niet bekend
          </div>
        ) : (
          <>
            {/* Match row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
                <span className="text-sm font-medium text-right leading-tight truncate">{match.homeName}</span>
                {match.homeCode && <FlagIcon teamCode={match.homeCode} />}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="score-input"
                  value={pred ? String(pred.homeScore) : ''}
                  disabled={locked}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const val = raw === '' ? 0 : parseInt(raw);
                    if (val > 20) return;
                    predictions.setScore(match.matchNumber, val, pred?.awayScore ?? 0, pred?.advancingTeam);
                  }}
                  onFocus={e => e.target.select()}
                  placeholder="-"
                />
                <span className="text-gray-500 font-bold text-base">-</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="score-input"
                  value={pred ? String(pred.awayScore) : ''}
                  disabled={locked}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const val = raw === '' ? 0 : parseInt(raw);
                    if (val > 20) return;
                    predictions.setScore(match.matchNumber, pred?.homeScore ?? 0, val, pred?.advancingTeam);
                  }}
                  onFocus={e => e.target.select()}
                  placeholder="-"
                />
              </div>

              <div className="flex-1 min-w-0 flex items-center gap-2">
                {match.awayCode && <FlagIcon teamCode={match.awayCode} />}
                <span className="text-sm font-medium leading-tight truncate">{match.awayName}</span>
              </div>
            </div>

            {/* Knockout draw resolver */}
            {isKO && predIsDraw && !locked && teamsKnown && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <span className="text-xs text-yellow-400 text-center">Gelijkspel - wie gaat door?</span>
                <div className="flex flex-wrap justify-center gap-2 w-full">
                  <button
                    onClick={() => predictions.setScore(match.matchNumber, pred!.homeScore, pred!.awayScore, match.homeCode || undefined)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                      pred?.advancingTeam === match.homeCode ? 'bg-pitch-light text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {match.homeCode && <FlagIcon teamCode={match.homeCode} size={14} />} {match.homeName}
                  </button>
                  <button
                    onClick={() => predictions.setScore(match.matchNumber, pred!.homeScore, pred!.awayScore, match.awayCode || undefined)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                      pred?.advancingTeam === match.awayCode ? 'bg-pitch-light text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {match.awayCode && <FlagIcon teamCode={match.awayCode} size={14} />} {match.awayName}
                  </button>
                </div>
              </div>
            )}

            {/* Actual result + points */}
            {isPlayed && (
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap bg-emerald-950/20 border border-emerald-700/30 rounded-md px-3 py-1.5 text-sm">
                <span className="text-emerald-300">
                  Uitslag: <span className="font-bold">{result.homeScore} - {result.awayScore}</span>
                  {result.advancingTeam && <span className="text-emerald-400/70 ml-2 text-xs">(door: {teams[result.advancingTeam]?.name || result.advancingTeam})</span>}
                </span>
                {pred && earnedPoints != null && (
                  <span className={`font-bold ${earnedPoints > 0 ? 'text-gold' : 'text-gray-500'}`}>
                    {earnedPoints > 0 ? '+' : ''}{earnedPoints} pt
                  </span>
                )}
                {!pred && <span className="text-gray-500 text-xs">geen voorspelling</span>}
              </div>
            )}

            {/* Joker toggle */}
            {!locked && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => predictions.toggleJoker(match.matchNumber)}
                  disabled={!canToggleJoker}
                  className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                    isJoker
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : canToggleJoker
                        ? 'bg-white/10 text-gray-400 hover:bg-purple-500/20 hover:text-purple-300'
                        : 'bg-white/5 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <span>&#x1F0CF;</span>
                  <span>{isJoker ? 'Joker verwijderen' : 'Joker inzetten'}</span>
                </button>
              </div>
            )}

            {/* Expand others' predictions */}
            {otherPredictions && otherPredictions.length > 0 && (
              <button
                onClick={onToggleExpand}
                className="w-full mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
              >
                <span>{expanded ? '▲' : '▼'}</span>
                <span>{expanded ? 'Verberg' : 'Toon'} voorspellingen ({otherPredictions.length})</span>
              </button>
            )}
          </>
        )}
      </div>

      {expanded && otherPredictions && (
        <div className="mx-1 mb-1 bg-white/5 rounded-b-lg border border-white/10 border-t-0 px-3 py-2">
          <div className="divide-y divide-white/10">
            {otherPredictions.map((mp, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-gray-400">
                  {mp.userName}
                  {mp.jokerUsed && <span className="ml-1 text-purple-400 font-bold text-xs">JOKER</span>}
                </span>
                <span className="font-mono font-medium text-white">
                  {mp.homeScore} - {mp.awayScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
