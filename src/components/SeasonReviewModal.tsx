'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'season_review_seen';

function ordinal(n: number): string {
  const ste = n === 1 || n === 8 || (n >= 20 && n % 10 === 0);
  return `${n}${ste ? 'ste' : 'de'}`;
}

interface Props {
  onNavigate?: (tabId: string) => void;
}

// Eenmalige pop-up na afloop van het toernooi: toont de finale plaats en linkt
// door naar de "Mijn Seizoen"-tab met het volledige eindoverzicht.
export default function SeasonReviewModal({ onNavigate }: Props) {
  const [info, setInfo] = useState<{ rank: number; totalPlayers: number; points: number } | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { return; }

    fetch('/api/season-stats')
      .then(r => r.json())
      .then(d => {
        if (d?.available) {
          setInfo({ rank: d.rank, totalPlayers: d.totalPlayers, points: d.points.total });
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    setClosing(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setTimeout(() => setInfo(null), 200);
  }

  function goToStats() {
    onNavigate?.('season');
    dismiss();
  }

  if (!info) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={dismiss}
    >
      <div
        className={`relative max-w-sm w-full rounded-2xl border border-gold/30 shadow-2xl transition-transform duration-200 ${closing ? 'scale-95' : 'scale-100'}`}
        style={{ background: 'linear-gradient(180deg, #0b1026 0%, #060d1f 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-8 text-center">
          <div className="text-sm uppercase tracking-wider text-gold/80">Het toernooi zit erop</div>
          <div className="text-6xl font-bold trophy-text my-3">{ordinal(info.rank)}</div>
          <div className="text-gray-300">plaats van de {info.totalPlayers} — {info.points} punten</div>

          <button
            onClick={goToStats}
            className="mt-6 w-full px-4 py-2.5 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-bold rounded-lg shadow active:scale-95 transition-all"
          >
            Bekijk mijn stats
          </button>
          <button
            onClick={dismiss}
            className="mt-2 w-full px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
