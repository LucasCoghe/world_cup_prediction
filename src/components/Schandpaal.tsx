'use client';

import { useState, useEffect } from 'react';
import Avatar from './Avatar';

interface PintEntry {
  id: string;
  reason: string;
  claimedAt: string | null;
  photoUrl: string;
  drinker: { id: string; name: string; avatarUrl: string | null };
}

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v|3gp|3gpp|quicktime)(\?|$)/i.test(url);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

export default function Schandpaal() {
  const [pints, setPints] = useState<PintEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomed, setZoomed] = useState<PintEntry | null>(null);

  useEffect(() => {
    fetch('/api/beers')
      .then(r => r.json())
      .then(data => {
        const all = (data.confirmations || []) as PintEntry[];
        setPints(all.filter(p => p.photoUrl));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-12 text-lg">Laden...</div>;
  }

  const grouped = new Map<string, PintEntry[]>();
  for (const p of pints) {
    const list = grouped.get(p.drinker.id) || [];
    list.push(p);
    grouped.set(p.drinker.id, list);
  }
  const leaderboard = [...grouped.entries()]
    .map(([id, items]) => ({ id, name: items[0].drinker.name, avatarUrl: items[0].drinker.avatarUrl, count: items.length }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8 animate-in">
      <section>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">🍻 Bewijslast</h2>
        <p className="text-gray-500 text-sm mb-4">
          Alle pintjes die effectief gedronken zijn. Geen foto, geen pint geteld.
        </p>

        {pints.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">
            Nog niemand heeft een pint bewezen. Dorst?
          </div>
        ) : (
          <>
            {leaderboard.length > 1 && (
              <div className="card mb-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-2">Top drinkers</h3>
                <div className="flex flex-wrap gap-2">
                  {leaderboard.map(d => (
                    <div key={d.id} className="flex items-center gap-2 bg-white/5 rounded-full pl-1 pr-3 py-1">
                      <Avatar name={d.name} avatarUrl={d.avatarUrl} size={24} />
                      <span className="text-sm text-white">{d.name}</span>
                      <span className="text-xs font-bold text-amber-300">×{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pints.map(p => (
                <button
                  key={p.id}
                  onClick={() => setZoomed(p)}
                  className="card !p-2 text-left hover:border-amber-600/60 transition group"
                >
                  <div className="aspect-square rounded overflow-hidden bg-black/40 mb-2 relative">
                    {isVideoUrl(p.photoUrl) ? (
                      <>
                        <video
                          src={p.photoUrl}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-4xl drop-shadow pointer-events-none">▶</span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt={`Pint van ${p.drinker.name}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Avatar name={p.drinker.name} avatarUrl={p.drinker.avatarUrl} size={20} />
                    <span className="text-xs font-semibold text-white truncate">{p.drinker.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">{p.reason}</div>
                  <div className="text-[10px] text-gray-600">{formatDateTime(p.claimedAt)}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {zoomed && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomed(null)}
        >
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            {isVideoUrl(zoomed.photoUrl) ? (
              <video
                src={zoomed.photoUrl}
                className="w-full rounded-lg"
                controls
                autoPlay
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zoomed.photoUrl} alt={`Pint van ${zoomed.drinker.name}`} className="w-full rounded-lg" />
            )}
            <div className="mt-3 flex items-center gap-2 text-white">
              <Avatar name={zoomed.drinker.name} avatarUrl={zoomed.drinker.avatarUrl} size={28} />
              <div>
                <div className="font-semibold">{zoomed.drinker.name}</div>
                <div className="text-xs text-gray-400">{zoomed.reason} · {formatDateTime(zoomed.claimedAt)}</div>
              </div>
              <button
                onClick={() => setZoomed(null)}
                className="ml-auto text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
