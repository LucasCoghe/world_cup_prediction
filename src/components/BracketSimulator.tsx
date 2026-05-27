'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { knockoutStructure, teams, groups, TOTAL_GROUP_MATCHES } from '@/lib/tournament';
import { calculateGroupStandings, getBestThirdPlaced, type MatchScore } from '@/lib/standings';
import FlagIcon from './FlagIcon';

const MATCH_W = 105;
const CONN_W = 10;

function getRelevantTeams(source: string): string[] {
  if (source.startsWith('3RD_')) {
    return source.slice(4).split('').flatMap(g => groups[g] || []);
  }
  const group = source.match(/([A-L])$/)?.[1];
  return group ? groups[group] || [] : [];
}

const STORAGE_KEY = 'bracket_sim';

interface Props {
  groupPredictions: MatchScore[];
}

export default function BracketSimulator({ groupPredictions }: Props) {
  const [slotTeams, setSlotTeams] = useState<Record<string, string>>({});
  const [matchWinners, setMatchWinners] = useState<Record<number, string>>({});
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const autoFilled = useRef(false);

  function fillFromPredictions(): Record<string, string> {
    const onlyGroup = groupPredictions.filter(p => p.matchNumber <= TOTAL_GROUP_MATCHES);
    if (onlyGroup.length === 0) return {};

    const standings = calculateGroupStandings(onlyGroup);
    const bestThirds = getBestThirdPlaced(standings);
    const newSlots: Record<string, string> = {};

    for (const [group, sorted] of Object.entries(standings)) {
      if (sorted[0]) newSlots[`1${group}`] = sorted[0].code;
      if (sorted[1]) newSlots[`2${group}`] = sorted[1].code;
    }

    const thirdSlots: { source: string; allowedGroups: string[] }[] = [];
    for (const km of knockoutStructure) {
      for (const src of [km.homeSource, km.awaySource]) {
        if (src.startsWith('3RD_')) {
          thirdSlots.push({ source: src, allowedGroups: src.slice(4).split('') });
        }
      }
    }

    const thirdAssignment = new Map<string, string>();
    function solve(idx: number, used: Set<string>): boolean {
      if (idx >= thirdSlots.length) return true;
      const slot = thirdSlots[idx];
      for (const bt of bestThirds) {
        if (slot.allowedGroups.includes(bt.group) && !used.has(bt.team.code)) {
          used.add(bt.team.code);
          thirdAssignment.set(slot.source, bt.team.code);
          if (solve(idx + 1, used)) return true;
          used.delete(bt.team.code);
          thirdAssignment.delete(slot.source);
        }
      }
      return false;
    }
    solve(0, new Set());

    for (const [src, team] of thirdAssignment) {
      newSlots[src] = team;
    }

    return newSlots;
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.slots && Object.keys(data.slots).length > 0) {
          setSlotTeams(data.slots);
          if (data.winners) setMatchWinners(data.winners);
          setLoaded(true);
          return;
        }
      }
    } catch {}

    if (!autoFilled.current && groupPredictions.length > 0) {
      autoFilled.current = true;
      const slots = fillFromPredictions();
      if (Object.keys(slots).length > 0) setSlotTeams(slots);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ slots: slotTeams, winners: matchWinners }));
    }
  }, [slotTeams, matchWinners, loaded]);

  function getTeamForSource(source: string): string | null {
    if (source.startsWith('W')) {
      return matchWinners[parseInt(source.slice(1))] || null;
    }
    if (source.startsWith('L')) {
      const mn = parseInt(source.slice(1));
      const winner = matchWinners[mn];
      if (!winner) return null;
      const m = knockoutStructure.find(x => x.matchNumber === mn)!;
      const h = getTeamForSource(m.homeSource);
      const a = getTeamForSource(m.awaySource);
      if (!h || !a) return null;
      return winner === h ? a : h;
    }
    return slotTeams[source] || null;
  }

  function resolveTeamWith(source: string, winners: Record<number, string>): string | null {
    if (source.startsWith('W')) return winners[parseInt(source.slice(1))] || null;
    if (source.startsWith('L')) {
      const mn = parseInt(source.slice(1));
      const w = winners[mn];
      if (!w) return null;
      const m = knockoutStructure.find(x => x.matchNumber === mn)!;
      const h = resolveTeamWith(m.homeSource, winners);
      const a = resolveTeamWith(m.awaySource, winners);
      if (!h || !a) return null;
      return w === h ? a : h;
    }
    return slotTeams[source] || null;
  }

  function clearDownstream(mn: number, winners: Record<number, string>) {
    for (const m of knockoutStructure) {
      if (m.homeSource === `W${mn}` || m.awaySource === `W${mn}` ||
          m.homeSource === `L${mn}` || m.awaySource === `L${mn}`) {
        if (winners[m.matchNumber]) {
          delete winners[m.matchNumber];
          clearDownstream(m.matchNumber, winners);
        }
      }
    }
  }

  function selectWinner(mn: number, team: string) {
    setMatchWinners(prev => {
      const next = { ...prev };
      if (next[mn] === team) {
        delete next[mn];
      } else {
        next[mn] = team;
      }
      clearDownstream(mn, next);
      return next;
    });
  }

  function selectSlotTeam(source: string, team: string) {
    setSlotTeams(prev => ({ ...prev, [source]: team }));
    setActivePicker(null);
    const r32 = knockoutStructure.find(m => m.homeSource === source || m.awaySource === source);
    if (r32) {
      setMatchWinners(prev => {
        const next = { ...prev };
        delete next[r32.matchNumber];
        clearDownstream(r32.matchNumber, next);
        return next;
      });
    }
  }

  function randomFill() {
    const newSlots: Record<string, string> = {};
    const placements: Record<string, string[]> = {};

    for (const [g, t] of Object.entries(groups)) {
      const shuffled = [...t].sort(() => Math.random() - 0.5);
      placements[g] = shuffled;
      newSlots[`1${g}`] = shuffled[0];
      newSlots[`2${g}`] = shuffled[1];
    }

    const thirds = new Map(Object.entries(placements).map(([g, t]) => [g, t[2]]));
    const thirdSources = [...new Set(
      knockoutStructure.filter(m => m.round === 'R32')
        .flatMap(m => [m.homeSource, m.awaySource])
        .filter(s => s.startsWith('3RD_'))
    )].sort((a, b) =>
      a.slice(4).split('').filter(g => thirds.has(g)).length -
      b.slice(4).split('').filter(g => thirds.has(g)).length
    );

    for (const src of thirdSources) {
      const eligible = src.slice(4).split('').filter(g => thirds.has(g));
      if (eligible.length > 0) {
        const picked = eligible[Math.floor(Math.random() * eligible.length)];
        newSlots[src] = thirds.get(picked)!;
        thirds.delete(picked);
      }
    }

    setSlotTeams(newSlots);
    setMatchWinners({});
  }

  function autoSimulate() {
    const next = { ...matchWinners };
    let progress = true;
    while (progress) {
      progress = false;
      for (const m of knockoutStructure) {
        if (next[m.matchNumber]) continue;
        const h = resolveTeamWith(m.homeSource, next);
        const a = resolveTeamWith(m.awaySource, next);
        if (h && a) {
          next[m.matchNumber] = Math.random() > 0.5 ? h : a;
          progress = true;
        }
      }
    }
    setMatchWinners(next);
  }

  function resetAll() {
    setSlotTeams({});
    setMatchWinners({});
  }

  const r32Complete = knockoutStructure
    .filter(m => m.round === 'R32')
    .every(m => slotTeams[m.homeSource] && slotTeams[m.awaySource]);

  const champion = matchWinners[104];

  // --- Render helpers ---

  function renderTeamRow(
    source: string, teamCode: string | null,
    isWinner: boolean, isEliminated: boolean,
    isR32: boolean, onClick: () => void,
  ) {
    if (!teamCode) {
      return (
        <button
          className={`w-full px-1.5 py-1 text-left text-[10px] leading-5 truncate ${
            isR32 ? 'text-gray-500 hover:bg-white/10 cursor-pointer' : 'text-gray-700'
          }`}
          onClick={isR32 ? onClick : undefined}
          title={source}
        >
          {source.startsWith('3RD_') ? `3e ${source.slice(4)}` : source}
        </button>
      );
    }
    const team = teams[teamCode];
    return (
      <button
        className={`w-full px-1.5 py-1 flex items-center gap-1 text-left text-[10px] leading-5 transition-all ${
          isWinner ? 'bg-pitch/40 text-white font-bold' :
          isEliminated ? 'opacity-30' : 'hover:bg-white/10 cursor-pointer'
        }`}
        onClick={onClick}
        title={team?.name}
      >
        <span className="flex-shrink-0">
          <FlagIcon teamCode={teamCode} size={14} />
        </span>
        <span className="truncate">{team?.name || teamCode}</span>
      </button>
    );
  }

  function renderMatchCard(matchNumber: number) {
    const match = knockoutStructure.find(m => m.matchNumber === matchNumber)!;
    const home = getTeamForSource(match.homeSource);
    const away = getTeamForSource(match.awaySource);
    const winner = matchWinners[matchNumber];
    const isR32 = match.round === 'R32';

    return (
      <div className="bg-white/5 rounded border border-white/10 overflow-hidden flex-shrink-0" style={{ width: MATCH_W }}>
        {renderTeamRow(match.homeSource, home, !!home && winner === home, !!winner && !!home && winner !== home, isR32, () => {
          if (isR32 && !home) setActivePicker(match.homeSource);
          else if (home && away) selectWinner(matchNumber, home);
        })}
        <div className="h-px bg-white/10" />
        {renderTeamRow(match.awaySource, away, !!away && winner === away, !!winner && !!away && winner !== away, isR32, () => {
          if (isR32 && !away) setActivePicker(match.awaySource);
          else if (home && away) selectWinner(matchNumber, away);
        })}
      </div>
    );
  }

  function renderConnector(side: 'left' | 'right') {
    const isLeft = side === 'left';
    const border = isLeft ? 'border-r' : 'border-l';
    return (
      <div className="flex items-center self-stretch flex-shrink-0" style={{ width: CONN_W }}>
        {!isLeft && <div className="border-t border-white/20 flex-shrink-0" style={{ width: 4 }} />}
        <div className="flex flex-col self-stretch flex-1">
          <div className={`flex-1 ${border} border-b border-white/20`} />
          <div className={`flex-1 ${border} border-t border-white/20`} />
        </div>
        {isLeft && <div className="border-t border-white/20 flex-shrink-0" style={{ width: 4 }} />}
      </div>
    );
  }

  function renderBracketNode(matchNumber: number, side: 'left' | 'right'): React.ReactNode {
    const match = knockoutStructure.find(m => m.matchNumber === matchNumber)!;
    const homeChild = match.homeSource.startsWith('W') ? parseInt(match.homeSource.slice(1)) : null;
    const awayChild = match.awaySource.startsWith('W') ? parseInt(match.awaySource.slice(1)) : null;

    if (!homeChild && !awayChild) {
      return renderMatchCard(matchNumber);
    }

    const children = (
      <div className="flex flex-col gap-1">
        {homeChild && renderBracketNode(homeChild, side)}
        {awayChild && renderBracketNode(awayChild, side)}
      </div>
    );

    if (side === 'left') {
      return (
        <div className="flex items-center">
          {children}
          {renderConnector('left')}
          {renderMatchCard(matchNumber)}
        </div>
      );
    }

    return (
      <div className="flex items-center">
        {renderMatchCard(matchNumber)}
        {renderConnector('right')}
        {children}
      </div>
    );
  }

  // Drag-to-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { isDragging: true, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDragging) return;
    e.preventDefault();
    const el = scrollRef.current!;
    el.scrollLeft = dragState.current.scrollLeft - (e.pageX - dragState.current.startX);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragState.current.isDragging = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  }, []);

  // Auto-center on trophy
  useEffect(() => {
    if (loaded && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Bracket Simulator</h2>
        <div className="flex gap-2 flex-wrap">
          {groupPredictions.filter(p => p.matchNumber <= TOTAL_GROUP_MATCHES).length > 0 && (
            <button
              onClick={() => {
                const slots = fillFromPredictions();
                if (Object.keys(slots).length > 0) {
                  setSlotTeams(slots);
                  setMatchWinners({});
                }
              }}
              className="btn-secondary text-sm !py-1.5 !px-3"
            >
              Vanuit voorspellingen
            </button>
          )}
          <button onClick={randomFill} className="btn-secondary text-sm !py-1.5 !px-3">
            Random
          </button>
          {r32Complete && (
            <button onClick={autoSimulate} className="btn-secondary text-sm !py-1.5 !px-3">
              Simuleer alles
            </button>
          )}
          <button onClick={resetAll} className="btn-secondary text-sm !py-1.5 !px-3 !text-red-400 !border-red-400/30">
            Reset
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-400">
        Klik op een positie om een team te kiezen. Klik daarna op een team om het door te laten gaan.
        Puur voor de fun — telt niet mee voor punten.
      </p>

      {champion && (
        <div className="card card-gold text-center py-4">
          <div className="text-3xl mb-2">🏆</div>
          <div className="flex items-center justify-center gap-2">
            <FlagIcon teamCode={champion} size={28} />
            <span className="text-xl font-bold trophy-text">{teams[champion]?.name}</span>
          </div>
          <div className="text-sm text-gold mt-1">Wereldkampioen!</div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-x-auto pb-2 cursor-grab active:cursor-grabbing select-none bracket-scroll"
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="flex items-center justify-center py-2 px-4" style={{ minWidth: 960 }}>
          {renderBracketNode(101, 'left')}

          <div className="flex-shrink-0 border-t border-white/20" style={{ width: 8 }} />

          <div className="flex flex-col items-center gap-2 mx-1 flex-shrink-0">
            <div className="text-lg">🏆</div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Finale</div>
            {renderMatchCard(104)}
            <div className="text-[10px] text-gray-500 mt-3">Troostfinale</div>
            {renderMatchCard(103)}
          </div>

          <div className="flex-shrink-0 border-t border-white/20" style={{ width: 8 }} />

          {renderBracketNode(102, 'right')}
        </div>
      </div>

      {activePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setActivePicker(null)}>
          <div className="bg-[#0b1026] rounded-xl p-4 max-w-xs w-full mx-4 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">
              {activePicker.startsWith('3RD_')
                ? `Kies 3e plaats (groep ${activePicker.slice(4).split('').join(', ')})`
                : `Kies team voor positie ${activePicker}`}
            </h3>
            <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
              {getRelevantTeams(activePicker).map(code => {
                const used = Object.values(slotTeams).includes(code);
                return (
                  <button
                    key={code}
                    className={`flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors ${
                      used ? 'opacity-25 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                    }`}
                    onClick={() => !used && selectSlotTeam(activePicker, code)}
                    disabled={used}
                  >
                    <FlagIcon teamCode={code} size={16} />
                    <span className="truncate">{teams[code]?.name}</span>
                  </button>
                );
              })}
            </div>
            <button className="mt-3 w-full text-sm text-gray-400 hover:text-white py-1" onClick={() => setActivePicker(null)}>
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
