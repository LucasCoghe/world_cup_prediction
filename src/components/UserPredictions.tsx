'use client';

import { useState, useEffect } from 'react';
import { teams, getRoundName } from '@/lib/tournament';
import FlagIcon from './FlagIcon';

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
  const isGroupMatch = pred.group !== null;
  const joker = pred.jokerUsed && isGroupMatch;

  if (predOutcome !== actualOutcome) {
    const pts = joker ? -1 : 0;
    return { points: pts, label: `${pts} pt` };
  }
  const exact = pred.homeScore === pred.actualHome && pred.awayScore === pred.actualAway;
  const base = exact ? 3 : 1;
  const pts = joker ? base + 2 : base;
  return { points: pts, label: `${pts} pt` };
}

export default function UserPredictions({ userId, onBack }: Props) {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [extra, setExtra] = useState<ExtraPrediction | null>(null);
  const [userName, setUserName] = useState('');
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

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary text-sm">&larr; Terug</button>
        <h2 className="text-2xl font-bold trophy-text">Voorspellingen van {userName}</h2>
      </div>

      <div className="card bg-white/5">
        <div className="text-sm text-gray-400">
          {predictions.length} voorspellingen &middot; {totalPoints} punten (uit gespeelde wedstrijden)
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
                    pts ? (pts.points >= 3 ? 'bg-green-950/30' : pts.points >= 1 ? 'bg-yellow-950/20' : 'bg-red-950/20') : 'bg-white/5'
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
                          pts.points >= 3 ? 'text-green-400' : pts.points >= 1 ? 'text-yellow-400' : 'text-red-400'
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
                    pts ? (pts.points === 3 ? 'bg-green-950/30' : pts.points === 1 ? 'bg-yellow-950/20' : 'bg-red-950/20') : 'bg-white/5'
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
                          pts.points === 3 ? 'text-green-400' : pts.points === 1 ? 'text-yellow-400' : 'text-red-400'
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
