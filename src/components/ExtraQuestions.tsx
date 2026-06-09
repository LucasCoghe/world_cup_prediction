'use client';

import { teams, getMatchKickoff } from '@/lib/tournament';
import type { PredictionsState } from '@/hooks/usePredictions';

interface Props {
  predictions: PredictionsState;
}

const allTeamsList = Object.values(teams).sort((a, b) => a.name.localeCompare(b.name));

export default function ExtraQuestions({ predictions }: Props) {
  const { extra, setExtra, save, saving, lockedMatches, userLocked } = predictions;
  const extraLocked = lockedMatches.has(1) || userLocked; // locked when match 1 has started or admin-lock

  const kickoff = getMatchKickoff(1);
  const deadlineStr = kickoff
    ? `${kickoff.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })} ${kickoff.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Extra Vragen</h2>
        <div className="flex items-center gap-3">
          {saving && <span className="text-sm text-gold">Opslaan...</span>}
          {!extraLocked && (
            <button onClick={save} className="btn-secondary">
              Opslaan
            </button>
          )}
        </div>
      </div>

      {/* Deadline banner */}
      <div className={`card ${extraLocked ? 'bg-red-950/20 border-red-600/30' : 'bg-amber-950/20 border-amber-600/30'}`}>
        <div className="flex items-center gap-2 text-sm">
          <span>{extraLocked ? '🔒' : '⏰'}</span>
          <span className={extraLocked ? 'text-red-400' : 'text-amber-300'}>
            {extraLocked
              ? 'Deadline verstreken - extra vragen zijn vergrendeld.'
              : `Deadline: voor de eerste match (${deadlineStr})`}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <label className="block text-base text-gold font-semibold mb-2">
            Wereldkampioen (15 punten)
          </label>
          <select
            value={extra.worldChampion}
            onChange={e => setExtra({ worldChampion: e.target.value })}
            disabled={extraLocked}
            className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold disabled:opacity-50"
          >
            <option value="">-- Selecteer --</option>
            {allTeamsList.map(t => (
              <option key={t.code} value={t.code}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="card">
          <label className="block text-base text-gold font-semibold mb-2">
            Topschutter (10 punten)
          </label>
          <input
            type="text"
            value={extra.topScorer}
            onChange={e => setExtra({ topScorer: e.target.value })}
            disabled={extraLocked}
            className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold disabled:opacity-50"
            placeholder="Naam van de speler"
          />
        </div>

        <div className="card">
          <label className="block text-base text-gold font-semibold mb-2">
            Belgische Topschutter (10 punten)
          </label>
          <input
            type="text"
            value={extra.belgianTopScorer}
            onChange={e => setExtra({ belgianTopScorer: e.target.value })}
            disabled={extraLocked}
            className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold disabled:opacity-50"
            placeholder="Naam van de Belgische speler"
          />
        </div>

        <div className="card">
          <label className="block text-base text-gold font-semibold mb-2">
            Schiftingsvraag 1: Aantal goals topschutter
          </label>
          <input
            type="number"
            min="0"
            value={extra.topScorerGoals || ''}
            onChange={e => setExtra({ topScorerGoals: parseInt(e.target.value) || 0 })}
            disabled={extraLocked}
            className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold disabled:opacity-50"
            placeholder="Aantal doelpunten"
          />
        </div>

        <div className="card md:col-span-2">
          <label className="block text-base text-gold font-semibold mb-2">
            Schiftingsvraag 2: Minuut eerste doelpunt topschutter
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={extra.topScorerFirstGoalMin || ''}
            onChange={e => setExtra({ topScorerFirstGoalMin: parseInt(e.target.value) || 0 })}
            disabled={extraLocked}
            className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold disabled:opacity-50"
            placeholder="Minuut (1-120)"
          />
        </div>
      </div>
    </div>
  );
}
