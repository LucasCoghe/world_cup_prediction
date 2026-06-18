'use client';

import { useState, useEffect } from 'react';
import UserPredictions from './UserPredictions';
import HeadToHead from './HeadToHead';
import BeerToast from './BeerToast';
import BeerModal from './BeerModal';
import Avatar from './Avatar';
import { getCosmetic } from '@/lib/cosmetics';
import { getStreakTier } from '@/lib/streak';

interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  groupPhasePoints: number;
  knockoutPoints: number;
  extraPoints: number;
  predictionsCount: number;
  beerCount: number;
  beerConfirmedCount: number;
  beerReasons: string[];
  beerGiveCount: number;
  beerGiveReasons: string[];
  beerGivePending: number;
  hotStreak: number;
  cosmetics?: { nameColor: string | null; rowStyle: string | null; title: string | null };
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

  const fetchLeaderboard = () => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        const lb = data.leaderboard || [];
        setEntries(lb);
        setCompletedMatchdays(data.completedMatchdays || 0);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeaderboard();
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

  const remainingBeers = (e: LeaderboardEntry) => Math.max(0, e.beerCount - e.beerConfirmedCount);
  const maxBeers = Math.max(...entries.map(remainingBeers), 0);
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
            const rowCos = getCosmetic(entry.cosmetics?.rowStyle);
            const titleCos = getCosmetic(entry.cosmetics?.title);
            const streakTier = getStreakTier(entry.hotStreak);
            return (
              <div
                key={entry.id}
                className={`card !p-3 sm:!p-6 flex items-center gap-2 sm:gap-4 cursor-pointer ${
                  isCurrentUser ? 'card-gold' : ''
                } ${i < 5 ? 'border-gold/30' : ''} ${
                  isLast ? 'border-amber-600/50 bg-amber-950/20' : ''
                } ${isH2hSelected ? 'border-blue-500/50 bg-blue-950/20' : ''} ${
                  h2hSelect && !isH2hSelected ? 'hover:border-blue-500/30' : 'hover:border-gold/30'
                } ${rowCos?.rowClassName ?? ''}`}
                onClick={() => handleNameClick(entry.id)}
              >
                {/* Position */}
                <div className="text-center w-6 sm:w-10 shrink-0">
                  <span className={`text-xl font-bold ${i < 5 ? 'trophy-text' : 'text-gray-500'}`}>
                    {i + 1}
                  </span>
                </div>

                <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={36} />

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {titleCos?.title && (
                    <div className="cos-title truncate">{titleCos.title}</div>
                  )}
                  <div className={`text-lg font-semibold truncate ${
                    streakTier ? streakTier.className : isH2hSelected ? 'text-blue-300' : 'text-white'
                  }`}>
                    {entry.name}
                  </div>
                  {streakTier?.label && (
                    <div className={`text-[10px] font-bold tracking-widest ${streakTier.className}`}>
                      {streakTier.emoji} {streakTier.label}
                    </div>
                  )}
                  {(isCurrentUser || isLast || isH2hSelected) && (
                    <div className="text-sm flex items-center gap-2 flex-wrap">
                      {isCurrentUser && <span className="text-gold">(jij)</span>}
                      {isLast && <span className="text-amber-400">schaamt u!</span>}
                      {isH2hSelected && <span className="text-blue-400">geselecteerd</span>}
                    </div>
                  )}
                </div>

                {/* Beer give count */}
                {entry.beerGivePending > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 bg-emerald-900/40 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-600/30 cursor-pointer hover:bg-emerald-900/60"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setBeerModalUser(entry.id); }}
                    title="Biertjes uit te delen"
                  >
                    <span className="text-base sm:text-lg">🎁</span>
                    <span className="font-bold text-base sm:text-lg text-emerald-400">{entry.beerGivePending}</span>
                  </button>
                )}

                {/* Beer count - clickable for own user */}
                <button
                  type="button"
                  className="flex items-center gap-1 bg-amber-900/40 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-amber-600/30 cursor-pointer hover:bg-amber-900/60"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setBeerModalUser(entry.id); }}
                >
                  <span className="text-base sm:text-lg">🍺</span>
                  <span className={`font-bold text-base sm:text-lg ${
                    remainingBeers(entry) === maxBeers && maxBeers > 0 ? 'text-amber-300' : 'text-amber-400/80'
                  }`}>
                    {remainingBeers(entry)}
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
                <div className="text-right shrink-0">
                  <div className="text-2xl sm:text-3xl font-bold trophy-text leading-none">{entry.totalPoints}</div>
                  <div className="text-xs sm:text-sm text-gray-500">punten</div>
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
            giveReasons={modalEntry.beerGiveReasons}
            allUsers={entries.map(e => ({ id: e.id, name: e.name }))}
            onClose={() => { setBeerModalUser(null); fetchLeaderboard(); }}
          />
        );
      })()}
    </div>
  );
}
