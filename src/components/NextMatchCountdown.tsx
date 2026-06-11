'use client';

import { useEffect, useMemo, useState } from 'react';
import { groupMatches, knockoutStructure, teams, getRoundName } from '@/lib/tournament';
import type { PredictionsState } from '@/hooks/usePredictions';
import FlagIcon from './FlagIcon';

interface UpcomingMatch {
  matchNumber: number;
  kickoff: Date;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string;
  awayLabel: string;
  involvesBelgium: boolean;
  isKnockout: boolean;
  roundLabel?: string;
}

const LIVE_BUFFER_MS = 150 * 60 * 1000; // banner stays during/just-after match

function buildUpcoming(
  koResolved: Record<number, { homeTeam: string | null; awayTeam: string | null }>,
  now: Date,
): UpcomingMatch[] {
  const all: UpcomingMatch[] = [];

  for (const m of groupMatches) {
    const kickoff = new Date(`${m.date}T${m.time}:00+02:00`);
    const home = teams[m.home];
    const away = teams[m.away];
    all.push({
      matchNumber: m.matchNumber,
      kickoff,
      homeCode: m.home,
      awayCode: m.away,
      homeLabel: home?.name ?? m.home,
      awayLabel: away?.name ?? m.away,
      involvesBelgium: m.home === 'BEL' || m.away === 'BEL',
      isKnockout: false,
    });
  }

  for (const km of knockoutStructure) {
    const kickoff = new Date(`${km.date}T${km.time}:00+02:00`);
    const resolved = koResolved[km.matchNumber];
    const homeCode = resolved?.homeTeam ?? null;
    const awayCode = resolved?.awayTeam ?? null;
    const home = homeCode ? teams[homeCode] : null;
    const away = awayCode ? teams[awayCode] : null;
    all.push({
      matchNumber: km.matchNumber,
      kickoff,
      homeCode,
      awayCode,
      homeLabel: home?.name ?? homeCode ?? km.homeSource,
      awayLabel: away?.name ?? awayCode ?? km.awaySource,
      involvesBelgium: homeCode === 'BEL' || awayCode === 'BEL',
      isKnockout: true,
      roundLabel: getRoundName(km.round),
    });
  }

  return all
    .filter(m => m.kickoff.getTime() + LIVE_BUFFER_MS > now.getTime())
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}d ${hours}u ${minutes}m`;
  if (hours > 0) return `${hours}u ${minutes}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function formatKickoffLabel(d: Date): string {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Brussels',
  }).format(d);
}

function formatDayHeader(d: Date): string {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Brussels',
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Brussels',
  }).format(d);
}

interface Props {
  predictions: PredictionsState;
  onNavigateToMatch: (matchNumber: number, isKnockout: boolean) => void;
}

const MINIMIZED_KEY = 'next-match-banner-minimized';
const EXPANDED_KEY = 'next-match-banner-expanded';
const PANEL_SIZE = 5;

export default function NextMatchCountdown({ predictions, onNavigateToMatch }: Props) {
  const predictedMatchNumbers = useMemo(
    () => new Set(predictions.scores.keys()),
    [predictions.scores]
  );

  const [now, setNow] = useState<Date>(() => new Date());
  const [koResolved, setKoResolved] = useState<Record<number, { homeTeam: string | null; awayTeam: string | null }>>({});
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Load minimized/expanded preference from localStorage on mount
  useEffect(() => {
    try {
      const storedMin = localStorage.getItem(MINIMIZED_KEY);
      if (storedMin === '1') setMinimized(true);
      const storedExp = localStorage.getItem(EXPANDED_KEY);
      if (storedExp === '1') setExpanded(true);
    } catch {}
  }, []);

  const toggleMinimized = (next: boolean) => {
    setMinimized(next);
    try {
      localStorage.setItem(MINIMIZED_KEY, next ? '1' : '0');
    } catch {}
  };

  const toggleExpanded = (next: boolean) => {
    setExpanded(next);
    try {
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
    } catch {}
  };

  useEffect(() => {
    fetch('/api/knockout-teams')
      .then(r => r.ok ? r.json() : { teams: {} })
      .then(d => setKoResolved(d.teams || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const upcoming = useMemo(() => buildUpcoming(koResolved, now), [koResolved, now]);

  // Always show the very next upcoming match.
  const featured = upcoming[0] ?? null;

  if (!featured) return null;

  const msUntil = featured.kickoff.getTime() - now.getTime();
  const msSinceKickoff = -msUntil;
  const isBel = featured.involvesBelgium;
  const isLive = msUntil <= 0 && msSinceKickoff < LIVE_BUFFER_MS;

  // Minimized: tiny one-line pill, click to expand. No navigation in this state.
  if (minimized) {
    return (
      <div className="mx-auto max-w-6xl px-4 my-2">
        <button
          type="button"
          onClick={() => toggleMinimized(false)}
          className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 flex items-center gap-3 text-xs transition-colors cursor-pointer"
          aria-label="Toon volgende match"
        >
          <span className="text-white/70 uppercase tracking-wider">Volgende match</span>
          <span className="text-white/85 font-mono ml-auto whitespace-nowrap">
            {isLive ? 'LIVE' : formatCountdown(msUntil)}
          </span>
          <span className="text-white/40" aria-hidden>▾</span>
        </button>
      </div>
    );
  }

  const matchTitle = (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {featured.homeCode && <FlagIcon teamCode={featured.homeCode} size={18} />}
      <span>{featured.homeLabel}</span>
      <span className="text-white/50">–</span>
      <span>{featured.awayLabel}</span>
      {featured.awayCode && <FlagIcon teamCode={featured.awayCode} size={18} />}
    </span>
  );

  // Knockout matches with unresolved teams aren't predictable yet — hide the badge in that case.
  const isPredictable = !featured.isKnockout || (featured.homeCode !== null && featured.awayCode !== null);
  const hasPredicted = predictedMatchNumbers.has(featured.matchNumber);
  const predictionBadge = isPredictable ? (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5 ${
        hasPredicted
          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${hasPredicted ? 'bg-emerald-400' : 'bg-amber-400'}`}
        aria-hidden
      />
      {hasPredicted ? 'Voorspeld' : 'Nog niet voorspeld'}
    </span>
  ) : null;

  const minimizeButton = (
    <button
      type="button"
      onClick={() => toggleMinimized(true)}
      className="absolute top-2 right-6 w-7 h-7 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Minimaliseer"
      title="Minimaliseer"
    >
      <span aria-hidden className="text-base leading-none">−</span>
    </button>
  );

  // Panel matches (next N upcoming) — shared between live and pre-match state.
  // We skip the live match since predicting it is already locked.
  const panelMatches = upcoming.slice(isLive ? 1 : 0, (isLive ? 1 : 0) + PANEL_SIZE);
  const canExpand = panelMatches.length > 0;

  // Live state
  if (isLive) {
    return (
      <>
        <div className="mx-auto max-w-6xl px-4 my-3 relative">
          <button
            type="button"
            onClick={() => canExpand ? toggleExpanded(!expanded) : onNavigateToMatch(featured.matchNumber, featured.isKnockout)}
            className="w-full text-left rounded-xl border px-4 py-3 pr-12 flex items-center justify-between gap-3 flex-wrap animate-pulse transition-transform active:scale-[0.99] hover:brightness-110 cursor-pointer"
            style={{
              background: isBel
                ? 'linear-gradient(90deg, rgba(107,21,32,0.6) 0%, rgba(0,0,0,0.6) 100%)'
                : 'linear-gradient(90deg, rgba(0,40,104,0.6) 0%, rgba(0,0,0,0.6) 100%)',
              borderColor: isBel ? 'rgba(239,68,68,0.5)' : 'rgba(253,206,5,0.4)',
            }}
            aria-expanded={canExpand ? expanded : undefined}
          >
            <div className="flex flex-col gap-1">
              <div className={`text-xs uppercase tracking-wider inline-flex items-center gap-2 ${isBel ? 'text-red-300' : 'text-amber-300'}`}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                  LIVE{featured.isKnockout && featured.roundLabel ? ` · ${featured.roundLabel}` : ''}
                </span>
                {canExpand && (
                  <span className="text-white/50" aria-hidden>
                    {expanded ? '▴' : '▾'}
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-white">{matchTitle}</div>
              {predictionBadge && <div>{predictionBadge}</div>}
            </div>
            <div className="text-sm text-white/80">Voorspellingen vergrendeld</div>
          </button>
          {minimizeButton}
        </div>

        {canExpand && expanded && (
          <UpcomingPanel
            matches={panelMatches}
            predictions={predictions}
            predictedMatchNumbers={predictedMatchNumbers}
            onNavigateToMatch={onNavigateToMatch}
          />
        )}
      </>
    );
  }

  // Pre-match state
  const isUrgent = msUntil < 60 * 60 * 1000;
  const isSoon = msUntil < 12 * 60 * 60 * 1000;

  const headerText = isUrgent
    ? 'Voorspelling vergrendelt binnenkort!'
    : isBel
      ? (isSoon ? 'België speelt vandaag' : 'Volgende match — Belgie!')
      : 'Volgende match';

  return (
    <>
      <div className={`mx-auto max-w-6xl px-4 my-3 relative ${isUrgent ? 'animate-pulse' : ''}`}>
        <button
          type="button"
          onClick={() => canExpand ? toggleExpanded(!expanded) : onNavigateToMatch(featured.matchNumber, featured.isKnockout)}
          className="w-full text-left rounded-xl border px-4 py-3 pr-12 flex items-center justify-between gap-3 flex-wrap transition-transform active:scale-[0.99] hover:brightness-110 cursor-pointer"
          style={{
            background: isBel
              ? 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(107,21,32,0.45) 50%, rgba(253,206,5,0.35) 100%)'
              : 'linear-gradient(90deg, rgba(6,13,31,0.85) 0%, rgba(0,40,104,0.5) 100%)',
            borderColor: isUrgent ? '#fdce05' : 'rgba(255,255,255,0.12)',
          }}
          aria-expanded={canExpand ? expanded : undefined}
        >
          <div className="flex flex-col gap-1">
            <div className="text-xs uppercase tracking-wider text-white/70 inline-flex items-center gap-2">
              <span>
                {headerText}{featured.isKnockout && featured.roundLabel ? ` · ${featured.roundLabel}` : ''}
              </span>
              {canExpand && (
                <span className="text-white/50" aria-hidden>
                  {expanded ? '▴' : '▾'}
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-white">{matchTitle}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/80">{formatKickoffLabel(featured.kickoff)}</span>
              {predictionBadge}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-white/70 uppercase">Aftrap over</div>
            <div className={`font-mono font-bold text-xl ${isUrgent ? 'text-yellow-300' : 'text-white'}`}>
              {formatCountdown(msUntil)}
            </div>
          </div>
        </button>
        {minimizeButton}
      </div>

      {canExpand && expanded && (
        <UpcomingPanel
          matches={panelMatches}
          predictions={predictions}
          predictedMatchNumbers={predictedMatchNumbers}
          onNavigateToMatch={onNavigateToMatch}
        />
      )}
    </>
  );
}

function UpcomingPanel({
  matches,
  predictions,
  predictedMatchNumbers,
  onNavigateToMatch,
}: {
  matches: UpcomingMatch[];
  predictions: PredictionsState;
  predictedMatchNumbers: Set<number>;
  onNavigateToMatch: (matchNumber: number, isKnockout: boolean) => void;
}) {
  const byDate = useMemo(() => {
    const result: Array<{ key: string; label: string; matches: UpcomingMatch[] }> = [];
    for (const m of matches) {
      const key = `${m.kickoff.getFullYear()}-${m.kickoff.getMonth()}-${m.kickoff.getDate()}`;
      const last = result[result.length - 1];
      if (last && last.key === key) {
        last.matches.push(m);
      } else {
        result.push({ key, label: formatDayHeader(m.kickoff), matches: [m] });
      }
    }
    return result;
  }, [matches]);

  return (
    <div className="mx-auto max-w-6xl px-4 mb-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-white/60">
            Snel voorspellen
          </div>
          {predictions.saving && (
            <span className="text-xs text-gold/80">Opslaan...</span>
          )}
        </div>
        <div className="space-y-4">
          {byDate.map(group => (
            <div key={group.key}>
              <div className="text-[11px] font-semibold text-gold/70 uppercase mb-2 capitalize tracking-wider">
                {group.label}
              </div>
              <div className="space-y-2">
                {group.matches.map(m => (
                  <PanelMatchRow
                    key={m.matchNumber}
                    match={m}
                    predictions={predictions}
                    isPredicted={predictedMatchNumbers.has(m.matchNumber)}
                    onNavigateToMatch={onNavigateToMatch}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelMatchRow({
  match,
  predictions,
  isPredicted,
  onNavigateToMatch,
}: {
  match: UpcomingMatch;
  predictions: PredictionsState;
  isPredicted: boolean;
  onNavigateToMatch: (matchNumber: number, isKnockout: boolean) => void;
}) {
  const pred = predictions.scores.get(match.matchNumber);
  const locked = predictions.lockedMatches.has(match.matchNumber) || predictions.userLocked;
  const isJoker = predictions.jokers.has(match.matchNumber);
  const time = formatTime(match.kickoff);
  const teamsResolved = match.homeCode != null && match.awayCode != null;

  // Knockout match with unresolved teams: navigate-only
  if (match.isKnockout && !teamsResolved) {
    return (
      <button
        type="button"
        onClick={() => onNavigateToMatch(match.matchNumber, true)}
        className="w-full flex items-center gap-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 p-2.5 text-left transition-colors"
      >
        <span className="text-xs text-white/50 w-12 tabular-nums shrink-0">{time}</span>
        <span className="text-sm flex-1 text-white/70 truncate">
          {match.homeLabel} – {match.awayLabel}
        </span>
        <span className="text-xs text-blue-300 shrink-0">Voorspel &rarr;</span>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-2.5 border transition-colors ${
        locked
          ? 'opacity-50 bg-white/[0.02] border-white/5'
          : isJoker
            ? 'ring-1 ring-purple-500/60 bg-purple-950/20 border-purple-500/30'
            : isPredicted
              ? 'bg-white/[0.04] border-emerald-500/10'
              : 'bg-white/[0.03] border-white/5'
      }`}
    >
      <span className="text-xs text-white/50 w-12 tabular-nums shrink-0">{time}</span>

      <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
        <span className="hidden sm:inline-block text-sm font-medium truncate min-w-0">{match.homeLabel}</span>
        {match.homeCode && <FlagIcon teamCode={match.homeCode} size={18} />}
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
            predictions.setScore(match.matchNumber, val, pred?.awayScore ?? 0);
          }}
          onFocus={e => e.target.select()}
          placeholder="-"
        />
        <span className="text-gray-500 font-bold text-sm">-</span>
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
            predictions.setScore(match.matchNumber, pred?.homeScore ?? 0, val);
          }}
          onFocus={e => e.target.select()}
          placeholder="-"
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {match.awayCode && <FlagIcon teamCode={match.awayCode} size={18} />}
        <span className="hidden sm:inline-block text-sm font-medium truncate min-w-0">{match.awayLabel}</span>
      </div>

      {!locked && (
        <button
          type="button"
          onClick={() => predictions.toggleJoker(match.matchNumber)}
          className={`text-base px-2 py-1 rounded shrink-0 transition-all ${
            isJoker
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-white/5 text-gray-500 hover:bg-purple-500/20 hover:text-purple-300'
          }`}
          title={isJoker ? 'Joker verwijderen' : 'Joker inzetten'}
          aria-label={isJoker ? 'Joker verwijderen' : 'Joker inzetten'}
        >
          &#x1F0CF;
        </button>
      )}
    </div>
  );
}
