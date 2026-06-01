'use client';

import { useState, useMemo, useEffect } from 'react';
import { groups, groupMatches, teams, formatDeadline } from '@/lib/tournament';
import { calculateGroupStandings, getBestThirdPlaced } from '@/lib/standings';
import type { PredictionsState } from '@/hooks/usePredictions';
import FlagIcon from './FlagIcon';

interface Props {
  predictions: PredictionsState;
}

interface MatchPrediction {
  userName: string;
  homeScore: number;
  awayScore: number;
  jokerUsed?: boolean;
}

const groupLabels = Object.keys(groups);

export default function GroupStage({ predictions }: Props) {
  const [activeGroup, setActiveGroup] = useState('A');
  const [allPredictions, setAllPredictions] = useState<Record<number, MatchPrediction[]>>({});
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  // Fetch all users' predictions for locked matches
  useEffect(() => {
    fetch('/api/all-predictions')
      .then(r => r.json())
      .then(data => setAllPredictions(data.predictions || {}));
  }, []);

  const standings = useMemo(
    () => calculateGroupStandings(predictions.getScoresArray()),
    [predictions.scores]
  );

  const bestThirds = useMemo(
    () => getBestThirdPlaced(standings),
    [standings]
  );

  const currentGroupMatches = useMemo(
    () => groupMatches.filter(m => m.group === activeGroup),
    [activeGroup]
  );

  const currentStanding = standings[activeGroup] || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Groepsfase</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            Jokers: <span className={`font-bold ${predictions.jokersRemaining === 0 ? 'text-red-400' : 'text-gold'}`}>{predictions.jokersRemaining}/3</span>
          </span>
          {predictions.saving && <span className="text-sm text-gold">Opslaan...</span>}
          <button onClick={() => predictions.save()} className="btn-secondary">
            Opslaan
          </button>
        </div>
      </div>

      {/* Group selector */}
      <div className="flex flex-wrap gap-2">
        {groupLabels.map(g => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`w-11 h-11 rounded-lg font-bold text-base transition-all ${
              activeGroup === g ? 'tab-active' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Group matches */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4 text-gold">
          Groep {activeGroup}
        </h3>

        <div className="space-y-3">
          {currentGroupMatches.map(match => {
            const pred = predictions.scores.get(match.matchNumber);
            const homeTeam = teams[match.home];
            const awayTeam = teams[match.away];
            const locked = predictions.lockedMatches.has(match.matchNumber);
            const deadline = formatDeadline(match.date, match.time);
            const matchPreds = allPredictions[match.matchNumber];
            const isExpanded = expandedMatch === match.matchNumber;
            const isJoker = predictions.jokers.has(match.matchNumber);
            const canToggleJoker = !locked && (isJoker || predictions.jokersRemaining > 0);

            return (
              <div key={match.matchNumber}>
                <div className={`match-row rounded-lg p-3 ${locked ? 'opacity-50' : ''} ${isJoker ? 'ring-2 ring-purple-500/60 bg-purple-950/20' : ''}`}>
                  {/* Deadline row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">#{match.matchNumber}</span>
                      {isJoker && <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">JOKER</span>}
                    </div>
                    <span className={`deadline-text ${locked ? 'locked' : ''}`}>
                      {locked ? `Afgesloten - ${deadline}` : `Deadline: ${deadline}`}
                    </span>
                  </div>

                  {/* Match row */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-end gap-2">
                      <span className="text-base font-medium">{homeTeam?.name}</span>
                      {homeTeam && <FlagIcon teamCode={homeTeam.code} />}
                    </div>

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
                            pred?.awayScore ?? 0
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
                            val
                          );
                        }}
                        onFocus={e => e.target.select()}
                        placeholder="-"
                      />
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      {awayTeam && <FlagIcon teamCode={awayTeam.code} />}
                      <span className="text-base font-medium">{awayTeam?.name}</span>
                    </div>
                  </div>

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

                  {/* Show predictions toggle for locked matches or matches with predictions visible */}
                  {matchPreds && matchPreds.length > 0 && (
                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : match.matchNumber)}
                      className="w-full mt-2 text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
                    >
                      <span>{isExpanded ? '▲' : '▼'}</span>
                      <span>{isExpanded ? 'Verberg' : 'Toon'} voorspellingen ({matchPreds.length})</span>
                    </button>
                  )}
                </div>

                {/* Expanded predictions + comments */}
                {isExpanded && matchPreds && (
                  <div className="mx-1 mb-1 bg-white/5 rounded-b-lg border border-white/10 border-t-0 px-3 py-2">
                    <div className="grid gap-1">
                      {matchPreds.map((mp, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1">
                          <span className="text-gray-400">
                            {mp.userName}
                            {mp.jokerUsed && <span className="ml-1 text-purple-400 font-bold text-xs">JOKER</span>}
                          </span>
                          <span className="font-mono font-medium text-white">
                            {mp.homeScore} - {mp.awayScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Standings table */}
      <div className="card">
        <h3 className="text-base font-semibold mb-3 text-gold uppercase tracking-wide">
          Stand Groep {activeGroup}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full group-table">
            <thead>
              <tr className="border-b border-white/10 text-sm text-gold uppercase">
                <th className="text-left py-2 px-2 w-8">#</th>
                <th className="text-left py-2 pl-2">Team</th>
                <th className="text-center py-2 px-2">W</th>
                <th className="text-center py-2 px-2">G</th>
                <th className="text-center py-2 px-2">V</th>
                <th className="text-center py-2 px-2">DV</th>
                <th className="text-center py-2 px-2">DT</th>
                <th className="text-center py-2 px-2">DS</th>
                <th className="text-center py-2 px-2 font-bold">Ptn</th>
              </tr>
            </thead>
            <tbody>
              {currentStanding.map((team, i) => {
                const t = teams[team.code];
                return (
                  <tr
                    key={team.code}
                    className={`border-b border-white/5 ${
                      i < 2 ? 'qualify-1' : i === 2 ? 'qualify-3' : ''
                    }`}
                  >
                    <td className="py-2.5 px-2 text-gray-500 w-8">{i + 1}</td>
                    <td className="py-2.5 pl-2 text-base font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {t && <FlagIcon teamCode={t.code} size={16} />}
                        {t?.name}
                      </span>
                    </td>
                    <td className="text-center">{team.won}</td>
                    <td className="text-center">{team.drawn}</td>
                    <td className="text-center">{team.lost}</td>
                    <td className="text-center">{team.goalsFor}</td>
                    <td className="text-center">{team.goalsAgainst}</td>
                    <td className="text-center">{team.goalDiff > 0 ? '+' : ''}{team.goalDiff}</td>
                    <td className="text-center font-bold text-white text-base">{team.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-4 mt-3 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-pitch-light inline-block"></span>
            Ronde van 32
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-600 inline-block"></span>
            Mogelijke kwalificatie (beste 3e)
          </span>
        </div>
      </div>

      {/* Best 3rd placed teams overview */}
      <div className="card">
        <h3 className="text-base font-semibold mb-3 text-gold uppercase tracking-wide">
          Beste Derden (top 8 gaan door)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {bestThirds.map((bt, i) => {
            const t = teams[bt.team.code];
            return (
              <div
                key={bt.team.code}
                className={`flex items-center gap-2 p-2.5 rounded-lg ${
                  i < 8 ? 'bg-yellow-600/10 border border-yellow-600/30' : 'bg-white/5'
                }`}
              >
                <span className="text-sm text-gray-500">{i + 1}.</span>
                {t && <FlagIcon teamCode={t.code} size={14} />}
                <span className="text-sm font-medium">{t?.name}</span>
                <span className="text-sm text-gray-500 ml-auto">{bt.team.points}p</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
