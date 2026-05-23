'use client';

import { useState, useMemo } from 'react';
import { knockoutStructure, teams, getRoundName, formatDeadline, groupMatches } from '@/lib/tournament';
import { resolveKnockoutBracket } from '@/lib/standings';
import type { PredictionsState } from '@/hooks/usePredictions';
import FlagIcon from './FlagIcon';

interface Props {
  predictions: PredictionsState;
}

const rounds = ['R32', 'R16', 'QF', 'SF', 'F'] as const;

export default function KnockoutStage({ predictions }: Props) {
  const [activeRound, setActiveRound] = useState<string>('R32');

  const bracket = useMemo(
    () => resolveKnockoutBracket(predictions.getScoresArray()),
    [predictions.scores]
  );

  const roundMatches = useMemo(
    () => knockoutStructure.filter(m => m.round === activeRound),
    [activeRound]
  );

  const bracketMap = useMemo(() => {
    const map = new Map<number, { homeTeam: string | null; awayTeam: string | null }>();
    for (const b of bracket) {
      map.set(b.matchNumber, { homeTeam: b.homeTeam, awayTeam: b.awayTeam });
    }
    return map;
  }, [bracket]);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Knockout Fase</h2>
        <div className="flex items-center gap-3">
          {predictions.saving && <span className="text-sm text-gold">Opslaan...</span>}
          <button onClick={() => predictions.save()} className="btn-secondary">
            Opslaan
          </button>
        </div>
      </div>

      <p className="text-base text-gray-400">
        De teams worden automatisch ingevuld op basis van je groepsfase-voorspellingen.
        Vul hier de uitslagen in voor elke knockout-wedstrijd.
        Bij gelijkspel, selecteer welk team doorgaat.
      </p>

      {/* Round selector */}
      <div className="flex flex-wrap gap-2">
        {rounds.map(r => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            className={`px-5 py-2.5 rounded-lg text-base font-medium transition-all ${
              activeRound === r ? 'tab-active' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {getRoundName(r)}
          </button>
        ))}
      </div>

      {/* Matches */}
      <div className="space-y-3">
        {roundMatches.map(match => {
          const resolved = bracketMap.get(match.matchNumber);
          const homeTeam = resolved?.homeTeam ? teams[resolved.homeTeam] : null;
          const awayTeam = resolved?.awayTeam ? teams[resolved.awayTeam] : null;
          const pred = predictions.scores.get(match.matchNumber);
          const isDraw = pred && pred.homeScore === pred.awayScore;
          const locked = predictions.lockedMatches.has(match.matchNumber);
          const m1 = groupMatches[0];
          const deadline = formatDeadline(m1.date, m1.time);

          return (
            <div key={match.matchNumber} className={`card ${locked ? 'opacity-50' : ''}`}>
              {/* Header with deadline */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">#{match.matchNumber}</span>
                  <span className="text-sm text-gray-600">
                    {match.homeSource} vs {match.awaySource}
                  </span>
                </div>
                <span className={`deadline-text ${locked ? 'locked' : ''}`}>
                  {locked ? `Afgesloten - ${deadline}` : `Deadline: ${deadline}`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Home team */}
                <div className="flex-1 flex items-center justify-end gap-2">
                  {homeTeam ? (
                    <>
                      <span className="text-base font-medium">{homeTeam.name}</span>
                      <FlagIcon teamCode={homeTeam.code} />
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 italic">{match.homeSource}</span>
                  )}
                </div>

                {/* Score inputs */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="score-input"
                    value={pred ? String(pred.homeScore) : ''}
                    disabled={locked || !homeTeam || !awayTeam}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      const val = raw === '' ? 0 : parseInt(raw);
                      if (val > 20) return;
                      predictions.setScore(
                        match.matchNumber,
                        val,
                        pred?.awayScore ?? 0,
                        pred?.advancingTeam
                      );
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="-"
                  />
                  <span className="text-gray-500 font-bold text-lg">-</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="score-input"
                    value={pred ? String(pred.awayScore) : ''}
                    disabled={locked || !homeTeam || !awayTeam}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      const val = raw === '' ? 0 : parseInt(raw);
                      if (val > 20) return;
                      predictions.setScore(
                        match.matchNumber,
                        pred?.homeScore ?? 0,
                        val,
                        pred?.advancingTeam
                      );
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="-"
                  />
                </div>

                {/* Away team */}
                <div className="flex-1 flex items-center gap-2">
                  {awayTeam ? (
                    <>
                      <FlagIcon teamCode={awayTeam.code} />
                      <span className="text-base font-medium">{awayTeam.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 italic">{match.awaySource}</span>
                  )}
                </div>
              </div>

              {/* Draw resolver */}
              {isDraw && homeTeam && awayTeam && !locked && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <span className="text-sm text-yellow-400">Gelijkspel - wie gaat door?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => predictions.setScore(
                        match.matchNumber,
                        pred!.homeScore,
                        pred!.awayScore,
                        resolved?.homeTeam || undefined
                      )}
                      className={`text-sm px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                        pred?.advancingTeam === resolved?.homeTeam
                          ? 'bg-pitch-light text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      <FlagIcon teamCode={homeTeam.code} size={14} /> {homeTeam.name}
                    </button>
                    <button
                      onClick={() => predictions.setScore(
                        match.matchNumber,
                        pred!.homeScore,
                        pred!.awayScore,
                        resolved?.awayTeam || undefined
                      )}
                      className={`text-sm px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                        pred?.advancingTeam === resolved?.awayTeam
                          ? 'bg-pitch-light text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      <FlagIcon teamCode={awayTeam.code} size={14} /> {awayTeam.name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {roundMatches.length === 0 && (
        <div className="card text-center text-gray-500 text-base py-8">
          Vul eerst de groepsfase in om de knockout-wedstrijden te zien.
        </div>
      )}
    </div>
  );
}
