'use client';

import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
  groupPhasePoints: number;
  knockoutPoints: number;
  extraPoints: number;
  predictionsCount: number;
  beerCount: number;
}

interface Props {
  currentUserId: string;
}

export default function Leaderboard({ currentUserId }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [completedMatchdays, setCompletedMatchdays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        setEntries(data.leaderboard || []);
        setCompletedMatchdays(data.completedMatchdays || 0);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-12 text-lg">Klassement laden...</div>;
  }

  const maxBeers = Math.max(...entries.map(e => e.beerCount), 0);
  const isLastPlace = (i: number) => i === entries.length - 1 && entries.length > 1;

  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-2xl font-bold trophy-text">Klassement</h2>

      {/* Beer banner */}
      {completedMatchdays > 0 && entries.length > 1 && (
        <div className="card bg-amber-950/40 border-amber-600/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍺</span>
            <div>
              <div className="text-amber-300 font-bold text-lg">Pintjesrekening</div>
              <div className="text-amber-200/70 text-sm">
                Na elke speeldag drinkt de laatste een pint! {completedMatchdays} speeldag{completedMatchdays !== 1 ? 'en' : ''} gespeeld.
              </div>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <p className="text-lg">Nog geen deelnemers. Registreer en begin met voorspellen!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const isCurrentUser = entry.id === currentUserId;
            const isLast = isLastPlace(i);
            return (
              <div
                key={entry.id}
                className={`card flex items-center gap-4 ${
                  isCurrentUser ? 'card-gold' : ''
                } ${i < 3 ? 'border-gold/30' : ''} ${
                  isLast ? 'border-amber-600/50 bg-amber-950/20' : ''
                }`}
              >
                {/* Position */}
                <div className="text-center w-10">
                  <span className={`text-xl font-bold ${i < 3 ? 'trophy-text' : 'text-gray-500'}`}>
                    {i + 1}
                  </span>
                </div>

                {/* Name */}
                <div className="flex-1">
                  <div className="text-lg font-semibold text-white">
                    {entry.name}
                    {isCurrentUser && (
                      <span className="text-sm text-gold ml-2">(jij)</span>
                    )}
                    {isLast && (
                      <span className="text-sm text-amber-400 ml-2">schaamt u!</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {entry.predictionsCount} voorspellingen
                  </div>
                </div>

                {/* Beer count */}
                {entry.beerCount > 0 && (
                  <div className="flex items-center gap-1 bg-amber-900/40 px-3 py-1.5 rounded-lg border border-amber-600/30">
                    <span className="text-lg">🍺</span>
                    <span className={`font-bold text-lg ${
                      entry.beerCount === maxBeers && maxBeers > 0 ? 'text-amber-300' : 'text-amber-400/80'
                    }`}>
                      {entry.beerCount}
                    </span>
                  </div>
                )}

                {/* Points breakdown */}
                <div className="hidden sm:flex gap-6 text-sm text-gray-400">
                  <div className="text-center">
                    <div className="font-medium text-white text-base">{entry.groupPhasePoints}</div>
                    <div>Groep</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-white text-base">{entry.knockoutPoints}</div>
                    <div>Knockout</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-white text-base">{entry.extraPoints}</div>
                    <div>Extra</div>
                  </div>
                </div>

                {/* Total */}
                <div className="text-right">
                  <div className="text-3xl font-bold trophy-text">{entry.totalPoints}</div>
                  <div className="text-sm text-gray-500">punten</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
