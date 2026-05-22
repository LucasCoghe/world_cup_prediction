'use client';

import { useState, useEffect } from 'react';

interface ShameEntry {
  userName: string;
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  predicted: string;
  actual: string;
  shameScore: number;
  date: string;
}

interface FunStats {
  schandpaal: ShameEntry[];
  streakBeers: Record<string, number>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function getShameCaption(shameScore: number): string {
  if (shameScore >= 6) return 'Ogen dicht voorspeld?';
  if (shameScore >= 5) return 'Beschamend!';
  if (shameScore >= 4) return 'Auw...';
  return 'Toch wel pijnlijk';
}

export default function Schandpaal() {
  const [stats, setStats] = useState<FunStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fun-stats')
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-12 text-lg">Laden...</div>;
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in">
      {/* Schandpaal */}
      <section>
        <h2 className="text-2xl font-bold text-red-400 mb-4">Schandpaal</h2>
        <p className="text-gray-500 text-sm mb-4">
          De slechtste voorspellingen ooit. Meer dan 3 doelpunten ernaast = schandpaal!
        </p>
        {stats.schandpaal.length === 0 ? (
          <div className="card text-center text-gray-500 py-6">
            Nog geen beschamende voorspellingen... voorlopig.
          </div>
        ) : (
          <div className="space-y-2">
            {stats.schandpaal.map((entry, i) => (
              <div
                key={`${entry.userName}-${entry.matchNumber}`}
                className={`card border-red-900/40 ${i === 0 ? 'bg-red-950/30 border-red-600/40' : ''}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div className="text-center w-8">
                      <span className={`text-lg font-bold ${i === 0 ? 'text-red-400' : 'text-gray-600'}`}>
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <div className="text-white font-semibold">{entry.userName}</div>
                      <div className="text-gray-500 text-sm">
                        {entry.homeTeam} vs {entry.awayTeam}
                        <span className="text-gray-600 ml-2">({formatDate(entry.date)})</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-red-400 font-mono font-bold text-lg">
                        {entry.predicted}
                      </div>
                      <div className="text-xs text-gray-600">voorspeld</div>
                    </div>
                    <div className="text-gray-600">vs</div>
                    <div>
                      <div className="text-emerald-400 font-mono font-bold text-lg">
                        {entry.actual}
                      </div>
                      <div className="text-xs text-gray-600">werkelijk</div>
                    </div>
                    <div className="hidden sm:block text-sm text-red-400/70 italic min-w-[140px] text-right">
                      {getShameCaption(entry.shameScore)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
