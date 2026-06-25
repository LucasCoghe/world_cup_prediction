'use client';

import { useState, useEffect, useMemo } from 'react';

interface PlayerHistory {
  id: string;
  name: string;
  avatarUrl: string | null;
  ranks: number[];
  points: number[];
}

interface HistoryData {
  checkpoints: string[];
  players: PlayerHistory[];
}

interface Props {
  currentUserId: string;
}

// Deterministic, evenly-spread color per player.
function colorFor(index: number, total: number): string {
  const hue = Math.round((index * 360) / Math.max(1, total));
  return `hsl(${hue}, 70%, 60%)`;
}

export default function PositionChart({ currentUserId }: Props) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(currentUserId);

  useEffect(() => {
    fetch('/api/leaderboard/history')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const colors = useMemo(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    data.players.forEach((p, i) => map.set(p.id, colorFor(i, data.players.length)));
    return map;
  }, [data]);

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Grafiek laden...</div>;
  }

  if (!data || data.checkpoints.length === 0 || data.players.length === 0) {
    return (
      <div className="card text-center text-gray-500 py-8">
        <p className="text-lg">Nog geen voltooide speeldag.</p>
        <p className="text-sm mt-1">De positiegrafiek verschijnt zodra een volledige speeldag een uitslag heeft.</p>
      </div>
    );
  }

  const { checkpoints, players } = data;
  const n = players.length;
  const cols = checkpoints.length;

  // Layout
  const rowH = 26;
  const colW = Math.max(64, Math.min(110, 520 / Math.max(1, cols - 1)));
  const mTop = 28;
  const mBottom = 16;
  const mLeft = 34;
  const mRight = 150; // space for names
  const innerW = (cols - 1) * colW || colW;
  const innerH = (n - 1) * rowH || rowH;
  const width = mLeft + innerW + mRight;
  const height = mTop + innerH + mBottom;

  const x = (ci: number) => mLeft + (cols === 1 ? innerW / 2 : ci * colW);
  const y = (rank: number) => mTop + (n === 1 ? innerH / 2 : (rank - 1) * rowH);

  const sortedByFinal = [...players].sort(
    (a, b) => a.ranks[cols - 1] - b.ranks[cols - 1]
  );

  return (
    <div className="space-y-3">
      <div className="card overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          style={{ minWidth: width }}
        >
          {/* Rank guide labels (left) */}
          {Array.from({ length: n }, (_, i) => i + 1).map(rank => (
            <text
              key={`r${rank}`}
              x={mLeft - 10}
              y={y(rank) + 4}
              textAnchor="end"
              className="fill-gray-600"
              fontSize={11}
            >
              {rank}
            </text>
          ))}

          {/* Checkpoint labels (top) */}
          {checkpoints.map((label, ci) => (
            <text
              key={`c${ci}`}
              x={x(ci)}
              y={mTop - 12}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* Player lines */}
          {players.map(p => {
            const isHi = highlight === p.id;
            const dimmed = highlight !== null && !isHi;
            const stroke = colors.get(p.id) || '#888';
            const pts = p.ranks.map((rank, ci) => `${x(ci)},${y(rank)}`).join(' ');
            return (
              <g key={p.id} opacity={dimmed ? 0.18 : 1}>
                {cols > 1 && (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isHi ? 3.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {p.ranks.map((rank, ci) => (
                  <circle
                    key={ci}
                    cx={x(ci)}
                    cy={y(rank)}
                    r={isHi ? 4 : 3}
                    fill={stroke}
                  >
                    <title>{`${p.name} — ${checkpoints[ci]}: #${rank} (${p.points[ci]}pt)`}</title>
                  </circle>
                ))}
                {/* Name at end of line */}
                <text
                  x={x(cols - 1) + 10}
                  y={y(p.ranks[cols - 1]) + 4}
                  fontSize={11}
                  fontWeight={isHi ? 700 : 400}
                  fill={dimmed ? '#666' : stroke}
                >
                  {p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend / quick-highlight */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setHighlight(null)}
          className={`text-xs px-2 py-1 rounded ${highlight === null ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400'}`}
        >
          Toon alles
        </button>
        {sortedByFinal.map(p => (
          <button
            key={p.id}
            onClick={() => setHighlight(p.id)}
            className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
              highlight === p.id ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: colors.get(p.id) }} />
            {p.name}
            {p.id === currentUserId && <span className="text-gold">(jij)</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
