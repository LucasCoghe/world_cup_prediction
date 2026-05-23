'use client';

import { useState, useEffect } from 'react';
import { teams, getRoundName } from '@/lib/tournament';
import FlagIcon from './FlagIcon';

interface MatchPrediction {
  matchNumber: number;
  homeScore: number;
  awayScore: number;
  group: string | null;
  round: string | null;
  home: string;
  away: string;
  resolvedHome: string | null;
  resolvedAway: string | null;
  actualHome: number | null;
  actualAway: number | null;
}

interface UserData {
  userName: string;
  predictions: MatchPrediction[];
}

interface Props {
  userA: string;
  userB: string;
  onBack: () => void;
}

function getPoints(pred: MatchPrediction): number | null {
  if (pred.actualHome === null || pred.actualAway === null) return null;
  const predOutcome = Math.sign(pred.homeScore - pred.awayScore);
  const actualOutcome = Math.sign(pred.actualHome - pred.actualAway);
  if (predOutcome !== actualOutcome) return 0;
  if (pred.homeScore === pred.actualHome && pred.awayScore === pred.actualAway) return 3;
  return 1;
}

function pointsColor(pts: number | null): string {
  if (pts === null) return 'text-gray-500';
  if (pts === 3) return 'text-green-400';
  if (pts === 1) return 'text-yellow-400';
  return 'text-red-400';
}

function TeamLabel({ code, size = 14 }: { code: string; size?: number }) {
  const team = teams[code];
  if (!team) return <span className="text-gray-500">{code}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <FlagIcon teamCode={code} size={size} />
      <span>{team.name}</span>
    </span>
  );
}

export default function HeadToHead({ userA, userB, onBack }: Props) {
  const [dataA, setDataA] = useState<UserData | null>(null);
  const [dataB, setDataB] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/predictions/${userA}`).then(r => r.json()),
      fetch(`/api/predictions/${userB}`).then(r => r.json()),
    ]).then(([a, b]) => {
      setDataA({ userName: a.userName, predictions: a.predictions || [] });
      setDataB({ userName: b.userName, predictions: b.predictions || [] });
      setLoading(false);
    });
  }, [userA, userB]);

  if (loading) return <div className="text-center text-gray-400 py-12">Laden...</div>;
  if (!dataA || !dataB) return <div className="text-center text-gray-400 py-12">Kon data niet laden</div>;

  const predMapA = new Map(dataA.predictions.map(p => [p.matchNumber, p]));
  const predMapB = new Map(dataB.predictions.map(p => [p.matchNumber, p]));

  const allMatchNumbers = [...new Set([...predMapA.keys(), ...predMapB.keys()])].sort((a, b) => a - b);

  let winsA = 0, winsB = 0, draws = 0;
  let totalA = 0, totalB = 0;

  for (const mn of allMatchNumbers) {
    const pA = predMapA.get(mn);
    const pB = predMapB.get(mn);
    const ptA = pA ? getPoints(pA) : null;
    const ptB = pB ? getPoints(pB) : null;
    if (ptA !== null) totalA += ptA;
    if (ptB !== null) totalB += ptB;
    if (ptA !== null && ptB !== null) {
      if (ptA > ptB) winsA++;
      else if (ptB > ptA) winsB++;
      else draws++;
    }
  }

  function renderGroupMatch(mn: number) {
    const pA = predMapA.get(mn);
    const pB = predMapB.get(mn);
    const ref = pA || pB;
    if (!ref) return null;

    const ptA = pA ? getPoints(pA) : null;
    const ptB = pB ? getPoints(pB) : null;

    return (
      <div key={mn} className="flex items-center gap-2 py-1.5 px-2 rounded bg-white/5 text-sm">
        <span className="text-xs text-gray-600 w-7">#{mn}</span>
        <div className={`w-12 text-center font-bold ${pointsColor(ptA)}`}>
          {pA ? `${pA.homeScore}-${pA.awayScore}` : '-'}
        </div>
        <div className="flex-1 text-center text-xs text-gray-400">
          <span className="inline-flex items-center justify-center gap-1">
            <TeamLabel code={ref.home} />
            <span className="mx-1">vs</span>
            <TeamLabel code={ref.away} />
          </span>
          {ref.actualHome !== null && (
            <span className="text-gray-600 ml-1">({ref.actualHome}-{ref.actualAway})</span>
          )}
        </div>
        <div className={`w-12 text-center font-bold ${pointsColor(ptB)}`}>
          {pB ? `${pB.homeScore}-${pB.awayScore}` : '-'}
        </div>
      </div>
    );
  }

  function renderKnockoutMatch(mn: number) {
    const pA = predMapA.get(mn);
    const pB = predMapB.get(mn);
    if (!pA && !pB) return null;

    const ptA = pA ? getPoints(pA) : null;
    const ptB = pB ? getPoints(pB) : null;

    const homeA = pA?.resolvedHome;
    const awayA = pA?.resolvedAway;
    const homeB = pB?.resolvedHome;
    const awayB = pB?.resolvedAway;
    const ref = pA || pB;

    return (
      <div key={mn} className="py-2 px-2 rounded bg-white/5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-7">#{mn}</span>

          {/* Player A: team + score */}
          <div className="flex-1 text-right">
            {homeA && awayA ? (
              <span className="text-xs text-gray-400 mr-2">
                <TeamLabel code={homeA} /> - <TeamLabel code={awayA} />
              </span>
            ) : (
              <span className="text-xs text-gray-600 mr-2">{ref?.home} vs {ref?.away}</span>
            )}
            <span className={`font-bold ${pointsColor(ptA)}`}>
              {pA ? `${pA.homeScore}-${pA.awayScore}` : '-'}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Player B: score + team */}
          <div className="flex-1 text-left">
            <span className={`font-bold ${pointsColor(ptB)}`}>
              {pB ? `${pB.homeScore}-${pB.awayScore}` : '-'}
            </span>
            {homeB && awayB ? (
              <span className="text-xs text-gray-400 ml-2">
                <TeamLabel code={homeB} /> - <TeamLabel code={awayB} />
              </span>
            ) : (
              <span className="text-xs text-gray-600 ml-2">{ref?.home} vs {ref?.away}</span>
            )}
          </div>
        </div>
        {ref && ref.actualHome !== null && ref.actualAway !== null && (
          <div className="text-center text-xs text-gray-600 mt-1">
            Uitslag: {ref.actualHome}-{ref.actualAway}
          </div>
        )}
      </div>
    );
  }

  const groupMatchNums = allMatchNumbers.filter(mn => (predMapA.get(mn) || predMapB.get(mn))?.group);
  const knockoutMatchNums = allMatchNumbers.filter(mn => (predMapA.get(mn) || predMapB.get(mn))?.round);
  const groupsList = [...new Set(groupMatchNums.map(mn => (predMapA.get(mn) || predMapB.get(mn))?.group).filter(Boolean))] as string[];
  const roundsList = [...new Set(knockoutMatchNums.map(mn => (predMapA.get(mn) || predMapB.get(mn))?.round).filter(Boolean))] as string[];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary text-sm">&larr; Terug</button>
        <h2 className="text-2xl font-bold trophy-text">Head-to-Head</h2>
      </div>

      {/* Score banner */}
      <div className="card bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-xl font-bold text-white">{dataA.userName}</div>
            <div className="text-3xl font-bold trophy-text mt-1">{totalA}</div>
            <div className="text-sm text-gray-500">punten</div>
          </div>
          <div className="text-center px-6">
            <div className="text-sm text-gray-500 mb-1">Wedstrijden gewonnen</div>
            <div className="text-2xl font-bold">
              <span className={winsA > winsB ? 'text-green-400' : 'text-white'}>{winsA}</span>
              <span className="text-gray-600 mx-2">-</span>
              <span className="text-gray-400">{draws}</span>
              <span className="text-gray-600 mx-2">-</span>
              <span className={winsB > winsA ? 'text-green-400' : 'text-white'}>{winsB}</span>
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="text-xl font-bold text-white">{dataB.userName}</div>
            <div className="text-3xl font-bold trophy-text mt-1">{totalB}</div>
            <div className="text-sm text-gray-500">punten</div>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-2 text-sm font-medium text-gray-400">
        <span className="w-7"></span>
        <span className="w-12 text-center">{dataA.userName}</span>
        <span className="flex-1 text-center">Wedstrijd</span>
        <span className="w-12 text-center">{dataB.userName}</span>
      </div>

      {/* Group matches */}
      {groupsList.sort().map(group => (
        <div key={group} className="card">
          <h3 className="text-sm font-semibold text-gold mb-2">Groep {group}</h3>
          <div className="space-y-1">
            {groupMatchNums
              .filter(mn => (predMapA.get(mn) || predMapB.get(mn))?.group === group)
              .map(mn => renderGroupMatch(mn))}
          </div>
        </div>
      ))}

      {/* Knockout matches */}
      {roundsList.map(round => (
        <div key={round} className="card">
          <h3 className="text-sm font-semibold text-gold mb-2">{getRoundName(round)}</h3>
          <div className="space-y-1.5">
            {knockoutMatchNums
              .filter(mn => (predMapA.get(mn) || predMapB.get(mn))?.round === round)
              .map(mn => renderKnockoutMatch(mn))}
          </div>
        </div>
      ))}
    </div>
  );
}
