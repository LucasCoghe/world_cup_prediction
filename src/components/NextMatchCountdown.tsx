'use client';

import { useEffect, useMemo, useState } from 'react';
import { groupMatches, knockoutStructure, teams, getRoundName } from '@/lib/tournament';

interface UpcomingMatch {
  matchNumber: number;
  kickoff: Date;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string;
  awayLabel: string;
  homeFlag: string;
  awayFlag: string;
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
      homeFlag: home?.flag ?? '',
      awayFlag: away?.flag ?? '',
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
      homeFlag: home?.flag ?? '',
      awayFlag: away?.flag ?? '',
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

interface Props {
  predictedMatchNumbers: Set<number>;
}

export default function NextMatchCountdown({ predictedMatchNumbers }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [koResolved, setKoResolved] = useState<Record<number, { homeTeam: string | null; awayTeam: string | null }>>({});

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
  const matchTitle = `${featured.homeFlag} ${featured.homeLabel} – ${featured.awayLabel} ${featured.awayFlag}`.trim();

  // Knockout matches with unresolved teams aren't predictable yet — hide the badge in that case.
  const isPredictable = !featured.isKnockout || (featured.homeCode !== null && featured.awayCode !== null);
  const hasPredicted = predictedMatchNumbers.has(featured.matchNumber);
  const predictionBadge = isPredictable ? (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
        hasPredicted
          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
      }`}
    >
      {hasPredicted ? '✓ Voorspeld' : '⚠ Nog niet voorspeld'}
    </span>
  ) : null;

  // Live state
  if (msUntil <= 0 && msSinceKickoff < LIVE_BUFFER_MS) {
    return (
      <div className="mx-auto max-w-6xl px-4 my-3">
        <div
          className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 flex-wrap animate-pulse"
          style={{
            background: isBel
              ? 'linear-gradient(90deg, rgba(107,21,32,0.6) 0%, rgba(0,0,0,0.6) 100%)'
              : 'linear-gradient(90deg, rgba(0,40,104,0.6) 0%, rgba(0,0,0,0.6) 100%)',
            borderColor: isBel ? 'rgba(239,68,68,0.5)' : 'rgba(253,206,5,0.4)',
          }}
        >
          <div className="flex flex-col gap-1">
            <div className={`text-xs uppercase tracking-wider ${isBel ? 'text-red-300' : 'text-amber-300'}`}>
              🔴 LIVE{featured.isKnockout && featured.roundLabel ? ` · ${featured.roundLabel}` : ''}
            </div>
            <div className="text-lg font-bold text-white">{matchTitle}</div>
            {predictionBadge && <div>{predictionBadge}</div>}
          </div>
          <div className="text-sm text-white/80">Voorspellingen vergrendeld</div>
        </div>
      </div>
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
    <div className={`mx-auto max-w-6xl px-4 my-3 ${isUrgent ? 'animate-pulse' : ''}`}>
      <div
        className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: isBel
            ? 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(107,21,32,0.45) 50%, rgba(253,206,5,0.35) 100%)'
            : 'linear-gradient(90deg, rgba(6,13,31,0.85) 0%, rgba(0,40,104,0.5) 100%)',
          borderColor: isUrgent ? '#fdce05' : 'rgba(255,255,255,0.12)',
        }}
      >
        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase tracking-wider text-white/70">
            {headerText}{featured.isKnockout && featured.roundLabel ? ` · ${featured.roundLabel}` : ''}
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
      </div>
    </div>
  );
}
