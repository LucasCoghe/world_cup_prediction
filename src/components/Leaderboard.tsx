'use client';

import { useState, useEffect } from 'react';
import UserPredictions from './UserPredictions';
import HeadToHead from './HeadToHead';
import BeerToast from './BeerToast';
import BeerModal from './BeerModal';

interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
  groupPhasePoints: number;
  knockoutPoints: number;
  extraPoints: number;
  predictionsCount: number;
  beerCount: number;
  beerReasons: string[];
  hotStreak: number;
}

interface Props {
  currentUserId: string;
}

export default function Leaderboard({ currentUserId }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [completedMatchdays, setCompletedMatchdays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [h2hUsers, setH2hUsers] = useState<[string, string] | null>(null);
  const [h2hSelect, setH2hSelect] = useState<string | null>(null);
  const [beerModalUser, setBeerModalUser] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        const lb = data.leaderboard || [];
        if (new URLSearchParams(window.location.search).has('bier')) {
          for (const e of lb) {
            e.beerReasons = ['Laatste op 15 jun (0pt)', '3x op rij 0 punten'];
            e.beerCount = e.beerReasons.length;
          }
        }
        setEntries(lb);
        setCompletedMatchdays(data.completedMatchdays || 0);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-12 text-lg">Klassement laden...</div>;
  }

  if (viewingUser) {
    return <UserPredictions userId={viewingUser} onBack={() => setViewingUser(null)} />;
  }

  if (h2hUsers) {
    return <HeadToHead userA={h2hUsers[0]} userB={h2hUsers[1]} onBack={() => { setH2hUsers(null); setH2hSelect(null); }} />;
  }

  const maxBeers = Math.max(...entries.map(e => e.beerCount), 0);
  const isLastPlace = (i: number) => i === entries.length - 1 && entries.length > 1;
  const myEntry = entries.find(e => e.id === currentUserId);
  const myBeerCount = myEntry?.beerCount ?? 0;
  const myBeerReasons = myEntry?.beerReasons ?? [];

  function handleNameClick(userId: string) {
    if (h2hSelect === null) {
      setViewingUser(userId);
    } else if (h2hSelect !== userId) {
      setH2hUsers([h2hSelect, userId]);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <BeerToast currentBeerCount={myBeerCount} reasons={myBeerReasons} />
      <h2 className="text-2xl font-bold trophy-text">Klassement</h2>

      {/* Head-to-head button */}
      {entries.length >= 2 && (
        <div className="flex gap-2">
          {h2hSelect ? (
            <div className="card bg-blue-950/40 border-blue-600/30 flex items-center gap-3 w-full">
              <span className="text-blue-300 font-medium">Kies een tegenstander om te vergelijken</span>
              <button onClick={() => setH2hSelect(null)} className="btn-secondary text-xs ml-auto">Annuleer</button>
            </div>
          ) : (
            <button
              onClick={() => setH2hSelect(currentUserId)}
              className="btn-secondary text-sm"
            >
              Head-to-Head vergelijken
            </button>
          )}
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
            const isH2hSelected = h2hSelect === entry.id;
            return (
              <div
                key={entry.id}
                className={`card flex items-center gap-4 cursor-pointer ${
                  isCurrentUser ? 'card-gold' : ''
                } ${i < 3 ? 'border-gold/30' : ''} ${
                  isLast ? 'border-amber-600/50 bg-amber-950/20' : ''
                } ${isH2hSelected ? 'border-blue-500/50 bg-blue-950/20' : ''} ${
                  h2hSelect && !isH2hSelected ? 'hover:border-blue-500/30' : 'hover:border-gold/30'
                }`}
                onClick={() => handleNameClick(entry.id)}
              >
                {/* Position */}
                <div className="text-center w-10">
                  <span className={`text-xl font-bold ${i < 3 ? 'trophy-text' : 'text-gray-500'}`}>
                    {i + 1}
                  </span>
                </div>

                {/* Name */}
                <div className="flex-1">
                  <div className={`text-lg font-semibold ${
                    isH2hSelected ? 'text-blue-300' : 'text-white'
                  }`}>
                    {entry.name}
                    {isCurrentUser && (
                      <span className="text-sm text-gold ml-2">(jij)</span>
                    )}
                    {isLast && (
                      <span className="text-sm text-amber-400 ml-2">schaamt u!</span>
                    )}
                    {isH2hSelected && (
                      <span className="text-sm text-blue-400 ml-2">geselecteerd</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {entry.predictionsCount} voorspellingen
                  </div>
                </div>

                {/* Hot streak */}
                {entry.hotStreak >= 2 && (
                  <div className="flex items-center gap-0.5 bg-orange-900/40 px-2.5 py-1.5 rounded-lg border border-orange-600/30">
                    <span className="text-lg">🔥</span>
                    <span className={`font-bold text-lg ${
                      entry.hotStreak >= 5 ? 'text-orange-300' : 'text-orange-400/80'
                    }`}>
                      {entry.hotStreak}
                    </span>
                  </div>
                )}

                {/* Beer count - clickable for own user */}
                <button
                  type="button"
                  className="flex items-center gap-1 bg-amber-900/40 px-3 py-1.5 rounded-lg border border-amber-600/30 cursor-pointer hover:bg-amber-900/60"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setBeerModalUser(entry.id); }}
                >
                  <span className="text-lg">🍺</span>
                  <span className={`font-bold text-lg ${
                    entry.beerCount === maxBeers && maxBeers > 0 ? 'text-amber-300' : 'text-amber-400/80'
                  }`}>
                    {entry.beerCount}
                  </span>
                </button>

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
      {/* Beer reasons modal */}
      {beerModalUser && (() => {
        const modalEntry = entries.find(e => e.id === beerModalUser);
        if (!modalEntry) return null;
        return (
          <BeerModal
            userId={modalEntry.id}
            userName={modalEntry.name}
            currentUserId={currentUserId}
            reasons={modalEntry.beerReasons}
            onClose={() => setBeerModalUser(null)}
          />
        );
      })()}
    </div>
  );
}
