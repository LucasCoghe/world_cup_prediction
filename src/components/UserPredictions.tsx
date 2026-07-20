'use client';

import { useState, useEffect } from 'react';
import { teams, getRoundName, formatSourceLabel, groupMatches, knockoutStructure } from '@/lib/tournament';
import { calculateMatchPoints, isCorrectWinner } from '@/lib/scoring';
import FlagIcon from './FlagIcon';
import Avatar from './Avatar';
import { getCosmetic } from '@/lib/cosmetics';
import { getStreakTier } from '@/lib/streak';

// Aftraptijd per matchnummer, voor chronologische sortering (knockout-nummers
// staan niet chronologisch).
const KICKOFF_MS = new Map<number, number>();
for (const m of [...groupMatches, ...knockoutStructure]) {
  KICKOFF_MS.set(m.matchNumber, new Date(`${m.date}T${m.time}:00+02:00`).getTime());
}
const kickoffMs = (matchNumber: number): number => KICKOFF_MS.get(matchNumber) ?? 0;

interface MatchPrediction {
  matchNumber: number;
  homeScore: number;
  awayScore: number;
  advancingTeam: string | null;
  jokerUsed: boolean;
  group: string | null;
  round: string | null;
  home: string;
  away: string;
  resolvedHome: string | null;
  resolvedAway: string | null;
  actualHome: number | null;
  actualAway: number | null;
  actualAdvancingTeam: string | null;
}

interface ExtraPrediction {
  topScorer: string;
  belgianTopScorer: string;
  worldChampion: string;
  topScorerGoals: number;
  topScorerFirstGoalMin: number;
}

interface ExtraCorrect {
  worldChampion: boolean | null;
  topScorer: boolean | null;
  belgianTopScorer: boolean | null;
}

// Toont "Juist"/"Fout" zodra de admin het echte antwoord heeft ingevuld
// (correct === null betekent: nog niet bekend, dus geen badge).
function Verdict({ correct }: { correct: boolean | null | undefined }) {
  if (correct === null || correct === undefined) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
      correct ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
    }`}>
      {correct ? 'Juist' : 'Fout'}
    </span>
  );
}

interface Props {
  userId: string;
  onBack: () => void;
}

// Gebruikt de gedeelde scoringlogica (incl. doorgaande ploeg / penalty-keuze),
// zodat de weergegeven punten exact gelijklopen met het klassement.
function getPointsForMatch(pred: MatchPrediction): { points: number; label: string } | null {
  if (pred.actualHome === null || pred.actualAway === null) return null;
  const isKnockout = pred.round !== null;
  const points = calculateMatchPoints(
    { matchNumber: pred.matchNumber, homeScore: pred.homeScore, awayScore: pred.awayScore, advancingTeam: pred.advancingTeam ?? undefined },
    { matchNumber: pred.matchNumber, homeScore: pred.actualHome, awayScore: pred.actualAway, advancingTeam: pred.actualAdvancingTeam ?? undefined },
    pred.jokerUsed,
    isKnockout,
    pred.resolvedHome ?? undefined,
    pred.resolvedAway ?? undefined,
  );
  return { points, label: `${points} pt` };
}

export default function UserPredictions({ userId, onBack }: Props) {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [extra, setExtra] = useState<ExtraPrediction | null>(null);
  const [extraCorrect, setExtraCorrect] = useState<ExtraCorrect | null>(null);
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cosmetics, setCosmetics] = useState<{ nameColor: string | null; rowStyle: string | null; title: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/predictions/${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setPredictions(data.predictions || []);
          setExtra(data.extra || null);
          setExtraCorrect(data.extraCorrect || null);
          setUserName(data.userName || '');
          setAvatarUrl(data.avatarUrl || null);
          setCosmetics(data.cosmetics || null);
        }
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div className="text-center text-gray-400 py-12">Laden...</div>;
  if (error) return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-secondary text-sm">&larr; Terug naar klassement</button>
      <div className="card text-center text-gray-400 py-8">{error}</div>
    </div>
  );

  // Gespeelde wedstrijden bovenaan (recentste aftrap eerst), daarna nog te
  // spelen (eerstvolgende aftrap eerst). Sorteren op aftraptijd, niet op
  // matchnummer — knockout-nummers staan niet chronologisch.
  const ordered = [...predictions].sort((a, b) => {
    const aPlayed = a.actualHome !== null && a.actualAway !== null;
    const bPlayed = b.actualHome !== null && b.actualAway !== null;
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;
    const ak = kickoffMs(a.matchNumber);
    const bk = kickoffMs(b.matchNumber);
    return aPlayed ? bk - ak : ak - bk;
  });

  function sectionLabel(p: MatchPrediction): string {
    if (p.group) return `Groep ${p.group}`;
    if (p.round) return getRoundName(p.round);
    return '';
  }

  const totalPoints = predictions.reduce((sum, p) => {
    const pts = getPointsForMatch(p);
    return sum + (pts?.points || 0);
  }, 0);

  // Hot streak loopt door over groep én knockout (op matchnummer-volgorde).
  const { hotStreak, bestStreak } = (() => {
    let streak = 0;
    let best = 0;
    const ordered = predictions.slice().sort((a, b) => a.matchNumber - b.matchNumber);
    for (const p of ordered) {
      if (p.actualHome === null || p.actualAway === null) continue;
      const isKnockout = p.round !== null;
      const correct = isCorrectWinner(
        { matchNumber: p.matchNumber, homeScore: p.homeScore, awayScore: p.awayScore, advancingTeam: p.advancingTeam ?? undefined },
        { matchNumber: p.matchNumber, homeScore: p.actualHome, awayScore: p.actualAway, advancingTeam: p.actualAdvancingTeam ?? undefined },
        isKnockout,
        p.resolvedHome ?? undefined,
        p.resolvedAway ?? undefined,
      );
      streak = correct ? streak + 1 : 0;
      if (streak > best) best = streak;
    }
    return { hotStreak: streak, bestStreak: best };
  })();

  // Exacte scores tellen door over groep én knockout (hattrick per 3).
  const exactScoresCount = predictions.filter(p =>
    p.actualHome !== null &&
    p.actualAway !== null &&
    p.homeScore === p.actualHome &&
    p.awayScore === p.actualAway
  ).length;
  const hatTricks = Math.floor(exactScoresCount / 3);

  const titleCos = getCosmetic(cosmetics?.title);
  const streakTier = getStreakTier(hotStreak);
  // Beste reeks ooit — tonen zodra die hoger is dan de lopende reeks (niet redundant).
  const bestTier = bestStreak >= 2 && bestStreak > hotStreak ? getStreakTier(bestStreak) : null;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3 sm:gap-4">
        <button onClick={onBack} className="btn-secondary text-sm shrink-0">&larr; Terug</button>
        <Avatar name={userName} avatarUrl={avatarUrl} size={56} />
        <div className="flex flex-col min-w-0">
          {titleCos?.title && <span className="cos-title truncate">{titleCos.title}</span>}
          <span className="text-xs text-gray-400 leading-tight">Voorspellingen van</span>
          <h2 className={`text-xl sm:text-2xl font-bold truncate ${streakTier ? streakTier.className : 'trophy-text'}`}>
            {userName}
          </h2>
        </div>
      </div>

      {(streakTier || bestTier || exactScoresCount > 0 || hatTricks > 0) && (
        <div className="card bg-white/5">
          <div className="text-sm text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            {streakTier && (
              <span className={`${streakTier.className} font-bold`}>
                {streakTier.emoji} {streakTier.label ? `${streakTier.label} · ` : ''}{hotStreak}x op rij juist
              </span>
            )}
            {bestTier && (
              <span className="font-semibold text-gray-500">
                <span>{bestTier.emoji}</span> beste reeks: {bestStreak}x op rij
              </span>
            )}
            {exactScoresCount > 0 && (
              <span className="text-emerald-300 font-medium">🎯 {exactScoresCount} exacte score{exactScoresCount > 1 ? 's' : ''}</span>
            )}
            {hatTricks > 0 && (
              <span className="text-emerald-400 font-bold">🎩 {hatTricks} hattrick{hatTricks > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Extra predictions */}
      {extra && (extra.topScorer || extra.worldChampion || extra.belgianTopScorer) && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gold mb-3">Extra voorspellingen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {extra.worldChampion && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-400">Wereldkampioen</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{teams[extra.worldChampion]?.name ?? extra.worldChampion}</span>
                  <Verdict correct={extraCorrect?.worldChampion} />
                </span>
              </div>
            )}
            {extra.topScorer && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-400">Topschutter</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{extra.topScorer}</span>
                  <Verdict correct={extraCorrect?.topScorer} />
                </span>
              </div>
            )}
            {extra.topScorerGoals > 0 && (
              <div className="flex justify-between"><span className="text-gray-400">Aantal goals topschutter</span><span>{extra.topScorerGoals}</span></div>
            )}
            {extra.belgianTopScorer && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-400">Belgische topschutter</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{extra.belgianTopScorer}</span>
                  <Verdict correct={extraCorrect?.belgianTopScorer} />
                </span>
              </div>
            )}
            {extra.topScorerFirstGoalMin > 0 && (
              <div className="flex justify-between"><span className="text-gray-400">Eerste goal topschutter (min)</span><span>{extra.topScorerFirstGoalMin}&apos;</span></div>
            )}
          </div>
        </div>
      )}

      {/* Alle voorspellingen — gespeeld bovenaan (recentste eerst), dan nog te spelen */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gold mb-3">Voorspellingen</h3>
        <div className="space-y-1.5">
          {ordered.map(p => {
            const isGroup = !!p.group;
            // Group: team codes are direct. Knockout: use the team this user
            // predicted to reach the slot (resolvedHome/Away); fall back to a
            // readable Dutch label ("Winnaar wedstrijd 73") when not yet known.
            const homeCode = isGroup ? p.home : p.resolvedHome;
            const awayCode = isGroup ? p.away : p.resolvedAway;
            const home = homeCode ? teams[homeCode] : undefined;
            const away = awayCode ? teams[awayCode] : undefined;
            const homeLabel = home?.name ?? homeCode ?? formatSourceLabel(p.home);
            const awayLabel = away?.name ?? awayCode ?? formatSourceLabel(p.away);
            const pts = getPointsForMatch(p);
            // Bij een voorspeld gelijkspel in een knockout: welke ploeg liet
            // deze speler doorgaan (penalty-keuze)?
            const advCode = !isGroup && p.homeScore === p.awayScore ? p.advancingTeam : null;
            const advTeam = advCode ? teams[advCode] : undefined;
            return (
              <div key={p.matchNumber} className={`flex flex-col gap-1 py-1.5 px-2 rounded ${
                pts ? (pts.points >= 10 ? 'bg-green-950/30' : pts.points >= 5 ? 'bg-yellow-950/20' : 'bg-red-950/20') : 'bg-white/5'
              } ${p.jokerUsed ? 'ring-1 ring-purple-500/40' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-16 shrink-0 leading-tight">
                    <span className="text-xs text-gray-500">
                      {p.jokerUsed ? <span className="text-purple-400 font-bold" title="Joker">J</span> : `#${p.matchNumber}`}
                    </span>
                    <span className="block text-[10px] text-gray-600 truncate">{sectionLabel(p)}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0 justify-end text-sm">
                    <span className={`truncate ${homeCode ? '' : 'text-gray-400'}`}>{homeLabel}</span>
                    {homeCode && <FlagIcon teamCode={homeCode} size={16} />}
                  </div>
                  <span className="font-bold w-14 shrink-0 text-center whitespace-nowrap">{p.homeScore} - {p.awayScore}</span>
                  <div className="flex items-center gap-1 flex-1 min-w-0 text-sm">
                    {awayCode && <FlagIcon teamCode={awayCode} size={16} />}
                    <span className={`truncate ${awayCode ? '' : 'text-gray-400'}`}>{awayLabel}</span>
                  </div>
                  {pts !== null && (
                    <div className="flex items-center gap-2 w-20 shrink-0 justify-end">
                      <span className="text-xs text-gray-500">({p.actualHome}-{p.actualAway})</span>
                      <span className={`text-xs font-bold ${
                        pts.points >= 10 ? 'text-green-400' : pts.points >= 5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{pts.label}</span>
                    </div>
                  )}
                </div>
                {advCode && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 pl-16">
                    <span>Gaat door:</span>
                    <FlagIcon teamCode={advCode} size={12} />
                    <span>{advTeam?.name ?? advCode}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
