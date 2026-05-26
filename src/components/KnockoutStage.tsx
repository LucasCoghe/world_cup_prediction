'use client';

import { useState, useMemo, useEffect } from 'react';
import { knockoutStructure, teams, getRoundName, formatDeadline, TOTAL_GROUP_MATCHES } from '@/lib/tournament';
import type { PredictionsState } from '@/hooks/usePredictions';
import FlagIcon from './FlagIcon';

interface Props {
  predictions: PredictionsState;
}

interface KnockoutTeamInfo {
  homeTeam: string | null;
  awayTeam: string | null;
}

const rounds = ['R32', 'R16', 'QF', 'SF', 'F'] as const;

const MAX_KNOCKOUT_JOKERS = 2;

export default function KnockoutStage({ predictions }: Props) {
  const [activeRound, setActiveRound] = useState<string>('R32');
  const [actualTeams, setActualTeams] = useState<Record<number, KnockoutTeamInfo>>({});

  useEffect(() => {
    fetch('/api/knockout-teams')
      .then(r => r.json())
      .then(data => setActualTeams(data.teams || {}));
  }, []);

  const knockoutJokersUsed = useMemo(() => {
    return [...predictions.jokers].filter(m => m > TOTAL_GROUP_MATCHES).length;
  }, [predictions.jokers]);

  const knockoutJokersRemaining = MAX_KNOCKOUT_JOKERS - knockoutJokersUsed;

  const roundMatches = useMemo(
    () => knockoutStructure.filter(m => m.round === activeRound),
    [activeRound]
  );

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Knockout Fase</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            Jokers: <span className={`font-bold ${knockoutJokersRemaining === 0 ? 'text-red-400' : 'text-gold'}`}>{knockoutJokersRemaining}/2</span>
          </span>
          {predictions.saving && <span className="text-sm text-gold">Opslaan...</span>}
          <button onClick={() => predictions.save()} className="btn-secondary">
            Opslaan
          </button>
        </div>
      </div>

      <p className="text-base text-gray-400">
        Voorspel de uitslagen van elke knockout-wedstrijd voor de aftrap.
        De teams verschijnen zodra ze gekwalificeerd zijn.
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
          const resolved = actualTeams[match.matchNumber];
          const homeTeam = resolved?.homeTeam ? teams[resolved.homeTeam] : null;
          const awayTeam = resolved?.awayTeam ? teams[resolved.awayTeam] : null;
          const teamsKnown = homeTeam && awayTeam;
          const pred = predictions.scores.get(match.matchNumber);
          const isDraw = pred && pred.homeScore === pred.awayScore;
          const locked = predictions.lockedMatches.has(match.matchNumber);
          const deadline = formatDeadline(match.date, match.time);
          const isJoker = predictions.jokers.has(match.matchNumber);
          const canToggleJoker = !locked && teamsKnown && (isJoker || knockoutJokersRemaining > 0);

          if (!teamsKnown) {
            return (
              <div key={match.matchNumber} className="card opacity-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">#{match.matchNumber}</span>
                    <span className="text-sm text-gray-600">
                      {match.homeSource} vs {match.awaySource}
                    </span>
                  </div>
                  <span className="deadline-text">{deadline}</span>
                </div>
                <div className="text-center text-gray-600 py-2 text-sm italic">
                  Teams nog niet bekend
                </div>
              </div>
            );
          }

          return (
            <div key={match.matchNumber} className={`card ${locked ? 'opacity-50' : ''} ${isJoker ? 'ring-2 ring-purple-500/60 bg-purple-950/10' : ''}`}>
              {/* Header with deadline */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">#{match.matchNumber}</span>
                  {isJoker && <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">JOKER</span>}
                </div>
                <span className={`deadline-text ${locked ? 'locked' : ''}`}>
                  {locked ? `Afgesloten - ${deadline}` : `Deadline: ${deadline}`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Home team */}
                <div className="flex-1 flex items-center justify-end gap-2">
                  <span className="text-base font-medium">{homeTeam.name}</span>
                  <FlagIcon teamCode={homeTeam.code} />
                </div>

                {/* Score inputs */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="score-input"
                    value={pred ? String(pred.homeScore) : ''}
                    disabled={locked}
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
                    disabled={locked}
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
                  <FlagIcon teamCode={awayTeam.code} />
                  <span className="text-base font-medium">{awayTeam.name}</span>
                </div>
              </div>

              {/* Draw resolver */}
              {isDraw && !locked && (
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

              {/* Joker toggle */}
              {!locked && (
                <div className="flex justify-center mt-2">
                  <button
                    onClick={() => predictions.toggleJoker(match.matchNumber)}
                    disabled={!canToggleJoker}
                    className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                      isJoker
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : canToggleJoker
                          ? 'bg-white/10 text-gray-400 hover:bg-purple-500/20 hover:text-purple-300'
                          : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <span>&#x1F0CF;</span>
                    <span>{isJoker ? 'Joker verwijderen' : 'Joker inzetten'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {roundMatches.length === 0 && (
        <div className="card text-center text-gray-500 text-base py-8">
          Geen wedstrijden in deze ronde.
        </div>
      )}
    </div>
  );
}
