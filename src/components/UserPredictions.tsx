'use client';

import { useState, useEffect } from 'react';
import { teams, getRoundName } from '@/lib/tournament';
import FlagIcon from './FlagIcon';
import { getCosmetic } from '@/lib/cosmetics';

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
  actualHome: number | null;
  actualAway: number | null;
}

interface ExtraPrediction {
  topScorer: string;
  belgianTopScorer: string;
  worldChampion: string;
  topScorerGoals: number;
  topScorerFirstGoalMin: number;
}

interface Props {
  userId: string;
  onBack: () => void;
}

function getPointsForMatch(pred: MatchPrediction): { points: number; label: string } | null {
  if (pred.actualHome === null || pred.actualAway === null) return null;
  const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
  const actualOutcome = Math.sign(pred.actualHome - pred.actualAway);
  const isKnockout = pred.round !== null;

  if (isKnockout) {
    let pts = 0;
    if (predOutcome === actualOutcome) {
      pts += 10;
      const exact = pred.homeScore === pred.actualHome && pred.awayScore === pred.actualAway;
      if (exact) {
        pts += 6;
      } else if ((pred.homeScore - pred.awayScore) === (pred.actualHome - pred.actualAway)) {
        pts += 4;
      }
    }
    if (pred.jokerUsed) pts += predOutcome === actualOutcome ? 5 : -5;
    return { points: pts, label: `${pts} pt` };
  }

  if (predOutcome !== actualOutcome) {
    const pts = pred.jokerUsed ? -5 : 0;
    return { points: pts, label: `${pts} pt` };
  }
  const exact = pred.homeScore === pred.actualHome && pred.awayScore === pred.actualAway;
  const predDiff = pred.homeScore - pred.awayScore;
  const actualDiff = pred.actualHome - pred.actualAway;
  let base = 5;
  if (exact) base = 10;
  else if (predDiff === actualDiff) base = 7;
  const pts = pred.jokerUsed ? base + 5 : base;
  return { points: pts, label: `${pts} pt` };
}

export default function UserPredictions({ userId, onBack }: Props) {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [extra, setExtra] = useState<ExtraPrediction | null>(null);
  const [userName, setUserName] = useState('');
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
          setUserName(data.userName || '');
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

  const groupPreds = predictions.filter(p => p.group).sort((a, b) => a.matchNumber - b.matchNumber);
  const knockoutPreds = predictions.filter(p => p.round).sort((a, b) => a.matchNumber - b.matchNumber);
  const groups = [...new Set(groupPreds.map(p => p.group!))].sort();
  const rounds = [...new Set(knockoutPreds.map(p => p.round!))];

  const totalPoints = predictions.reduce((sum, p) => {
    const pts = getPointsForMatch(p);
    return sum + (pts?.points || 0);
  }, 0);

  const hotStreak = (() => {
    let streak = 0;
    for (const p of groupPreds) {
      if (p.actualHome === null || p.actualAway === null) continue;
      const predOut = Math.sign(p.homeScore - p.awayScore);
      const actOut = Math.sign(p.actualHome - p.actualAway);
      streak = predOut === actOut ? streak + 1 : 0;
    }
    return streak;
  })();

  const exactScoresCount = groupPreds.filter(p =>
    p.actualHome !== null &&
    p.actualAway !== null &&
    p.homeScore === p.actualHome &&
    p.awayScore === p.actualAway
  ).length;
  const hatTricks = Math.floor(exactScoresCount / 3);

  const titleCos = getCosmetic(cosmetics?.title);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary text-sm">&larr; Terug</button>
        <div className="flex flex-col">
          {titleCos?.title && <span className="cos-title">{titleCos.title}</span>}
          <h2 className="text-2xl font-bold trophy-text">
            Voorspellingen van{' '}
            <span className={hotStreak >= 2 ? 'fire-text' : ''}>{userName}</span>
          </h2>
        </div>
      </div>

      <div className="card bg-white/5">
        <div className="text-sm text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{predictions.length} voorspellingen &middot; {totalPoints} punten (uit gespeelde wedstrijden)</span>
          {hotStreak >= 2 && (
            <span className="fire-text font-bold">🔥 {hotStreak}x op rij juist</span>
          )}
          {exactScoresCount > 0 && (
            <span className="text-emerald-300 font-medium">🎯 {exactScoresCount} exacte score{exactScoresCount > 1 ? 's' : ''}</span>
          )}
          {hatTricks > 0 && (
            <span className="text-emerald-400 font-bold">🎩 {hatTricks} hattrick{hatTricks > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Extra predictions */}
      {extra && (extra.topScorer || extra.worldChampion || extra.belgianTopScorer) && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gold mb-3">Extra voorspellingen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {extra.worldChampion && (
              <div className="flex justify-between"><span className="text-gray-400">Wereldkampioen</span><span>{extra.worldChampion}</span></div>
            )}
            {extra.topScorer && (
              <div className="flex justify-between"><span className="text-gray-400">Topschutter</span><span>{extra.topScorer}</span></div>
            )}
            {extra.topScorerGoals > 0 && (
              <div className="flex justify-between"><span className="text-gray-400">Aantal goals topschutter</span><span>{extra.topScorerGoals}</span></div>
            )}
            {extra.belgianTopScorer && (
              <div className="flex justify-between"><span className="text-gray-400">Belgische topschutter</span><span>{extra.belgianTopScorer}</span></div>
            )}
            {extra.topScorerFirstGoalMin > 0 && (
              <div className="flex justify-between"><span className="text-gray-400">Eerste goal topschutter (min)</span><span>{extra.topScorerFirstGoalMin}&apos;</span></div>
            )}
          </div>
        </div>
      )}

      {/* Group stage predictions */}
      {groups.map(group => {
        const matches = groupPreds.filter(p => p.group === group);
        return (
          <div key={group} className="card">
            <h3 className="text-sm font-semibold text-gold mb-3">Groep {group}</h3>
            <div className="space-y-1.5">
              {matches.map(p => {
                const home = teams[p.home];
                const away = teams[p.away];
                const pts = getPointsForMatch(p);
                return (
                  <div key={p.matchNumber} className={`flex items-center gap-2 py-1.5 px-2 rounded ${
                    pts ? (pts.points >= 10 ? 'bg-green-950/30' : pts.points >= 5 ? 'bg-yellow-950/20' : 'bg-red-950/20') : 'bg-white/5'
                  } ${p.jokerUsed ? 'ring-1 ring-purple-500/40' : ''}`}>
                    <span className="text-xs text-gray-500 w-7">
                      {p.jokerUsed ? <span className="text-purple-400 font-bold" title="Joker">J</span> : `#${p.matchNumber}`}
                    </span>
                    <div className="flex items-center gap-1 flex-1 justify-end text-sm">
                      <span>{home?.name || p.home}</span>
                      <FlagIcon teamCode={p.home} size={16} />
                    </div>
                    <span className="font-bold w-14 text-center">{p.homeScore} - {p.awayScore}</span>
                    <div className="flex items-center gap-1 flex-1 text-sm">
                      <FlagIcon teamCode={p.away} size={16} />
                      <span>{away?.name || p.away}</span>
                    </div>
                    {pts !== null && (
                      <div className="flex items-center gap-2 w-20 justify-end">
                        <span className="text-xs text-gray-500">({p.actualHome}-{p.actualAway})</span>
                        <span className={`text-xs font-bold ${
                          pts.points >= 10 ? 'text-green-400' : pts.points >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{pts.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Knockout predictions */}
      {rounds.map(round => {
        const matches = knockoutPreds.filter(p => p.round === round);
        return (
          <div key={round} className="card">
            <h3 className="text-sm font-semibold text-gold mb-3">{getRoundName(round)}</h3>
            <div className="space-y-1.5">
              {matches.map(p => {
                const pts = getPointsForMatch(p);
                return (
                  <div key={p.matchNumber} className={`flex items-center gap-2 py-1.5 px-2 rounded ${
                    pts ? (pts.points >= 10 ? 'bg-green-950/30' : pts.points >= 5 ? 'bg-yellow-950/20' : 'bg-red-950/20') : 'bg-white/5'
                  }`}>
                    <span className="text-xs text-gray-500 w-7">#{p.matchNumber}</span>
                    <div className="flex items-center gap-1 flex-1 justify-end text-sm">
                      <span className="text-gray-400">{p.home}</span>
                    </div>
                    <span className="font-bold w-14 text-center">{p.homeScore} - {p.awayScore}</span>
                    <div className="flex items-center gap-1 flex-1 text-sm">
                      <span className="text-gray-400">{p.away}</span>
                    </div>
                    {pts !== null && (
                      <div className="flex items-center gap-2 w-20 justify-end">
                        <span className="text-xs text-gray-500">({p.actualHome}-{p.actualAway})</span>
                        <span className={`text-xs font-bold ${
                          pts.points >= 10 ? 'text-green-400' : pts.points >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{pts.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
