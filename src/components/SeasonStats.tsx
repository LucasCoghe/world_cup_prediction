'use client';

import { useState, useEffect } from 'react';

interface ExtraResult {
  prediction: string;
  answered: boolean;
  correct: boolean;
}

interface SeasonStatsData {
  available: boolean;
  name: string;
  rank: number;
  totalPlayers: number;
  points: { total: number; group: number; knockout: number; extra: number };
  accuracy: { predictedCount: number; exactScores: number; correctWinners: number; accuracyPct: number; avgPoints: number };
  records: {
    bestStreak: number;
    bestDay: { date: string; points: number } | null;
    jokerNet: number;
    jokersUsed: number;
    bestPrediction: { label: string; predicted: string; actual: string; points: number } | null;
    worstPrediction: { label: string; predicted: string; actual: string; goalError: number } | null;
  };
  beer: { drunk: number; confirmed: number; given: number };
  extra: { worldChampion: ExtraResult; topScorer: ExtraResult; belgianTopScorer: ExtraResult };
}

function ordinal(n: number): string {
  const ste = n === 1 || n === 8 || (n >= 20 && n % 10 === 0);
  return `${n}${ste ? 'ste' : 'de'}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card text-center">
      <div className="text-3xl font-bold trophy-text leading-none">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ExtraRow({ label, r }: { label: string; r: ExtraResult }) {
  const status = !r.answered
    ? { text: 'Nog niet bekend', cls: 'text-gray-500' }
    : r.correct
      ? { text: 'Juist', cls: 'text-green-400' }
      : { text: 'Fout', cls: 'text-red-400' };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-gray-400">{label}</div>
        <div className="text-base truncate">{r.prediction || <span className="text-gray-600">Niet ingevuld</span>}</div>
      </div>
      <span className={`text-sm font-semibold shrink-0 ${status.cls}`}>{status.text}</span>
    </div>
  );
}

export default function SeasonStats() {
  const [data, setData] = useState<SeasonStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/season-stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-12 text-lg">Stats laden...</div>;
  }

  if (!data || !data.available) {
    return (
      <div className="card text-center text-gray-500 py-10">
        <p className="text-lg">Je eindoverzicht is nog niet beschikbaar.</p>
        <p className="text-sm mt-1">Zodra het toernooi is afgelopen en de uitslagen zijn ingevuld, vind je hier al je statistieken.</p>
      </div>
    );
  }

  const { records, accuracy, points, beer, extra } = data;

  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-2xl font-bold trophy-text">Mijn Seizoen</h2>

      {/* Eindpositie */}
      <div className="card card-gold text-center py-8">
        <div className="text-sm uppercase tracking-wider text-gold/80">Eindstand</div>
        <div className="text-6xl font-bold trophy-text my-2">{ordinal(data.rank)}</div>
        <div className="text-gray-300">plaats van de {data.totalPlayers} deelnemers</div>
        <div className="text-4xl font-bold text-white mt-4">{points.total} <span className="text-lg text-gray-400 font-normal">punten</span></div>
        <div className="flex justify-center gap-6 mt-3 text-sm text-gray-400">
          <span><span className="text-white font-semibold">{points.group}</span> groep</span>
          <span><span className="text-white font-semibold">{points.knockout}</span> knockout</span>
          <span><span className="text-white font-semibold">{points.extra}</span> extra</span>
        </div>
      </div>

      {/* Trefzekerheid */}
      <div>
        <h3 className="text-lg font-semibold text-gold mb-3">Trefzekerheid</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Exacte scores" value={accuracy.exactScores} />
          <StatCard label="Juiste winnaars" value={accuracy.correctWinners} sub={`van ${accuracy.predictedCount}`} />
          <StatCard label="Nauwkeurigheid" value={`${accuracy.accuracyPct}%`} />
          <StatCard label="Gem. per match" value={accuracy.avgPoints} />
        </div>
      </div>

      {/* Records & reeksen */}
      <div>
        <h3 className="text-lg font-semibold text-gold mb-3">Records &amp; reeksen</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Langste reeks juist" value={records.bestStreak} sub="op rij" />
          <StatCard
            label="Beste dag"
            value={records.bestDay ? `${records.bestDay.points}` : '-'}
            sub={records.bestDay ? formatDate(records.bestDay.date) : 'punten'}
          />
          <StatCard label="Joker-rendement" value={`${records.jokerNet >= 0 ? '+' : ''}${records.jokerNet}`} sub={`${records.jokersUsed} jokers`} />
          <StatCard label="Pinten gedronken" value={beer.drunk} sub={`${beer.confirmed} bevestigd`} />
        </div>

        {(records.bestPrediction || records.worstPrediction) && (
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            {records.bestPrediction && (
              <div className="card border-green-600/20 bg-green-950/10">
                <div className="text-sm text-green-400 font-semibold mb-1">Beste voorspelling ({records.bestPrediction.points} pt)</div>
                <div className="text-base truncate">{records.bestPrediction.label}</div>
                <div className="text-sm text-gray-400">
                  Jouw tip <span className="text-white">{records.bestPrediction.predicted}</span> · uitslag <span className="text-white">{records.bestPrediction.actual}</span>
                </div>
              </div>
            )}
            {records.worstPrediction && (
              <div className="card border-red-600/20 bg-red-950/10">
                <div className="text-sm text-red-400 font-semibold mb-1">Grootste misser</div>
                <div className="text-base truncate">{records.worstPrediction.label}</div>
                <div className="text-sm text-gray-400">
                  Jouw tip <span className="text-white">{records.worstPrediction.predicted}</span> · uitslag <span className="text-white">{records.worstPrediction.actual}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bier */}
      <div>
        <h3 className="text-lg font-semibold text-gold mb-3">Café</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Gedronken" value={beer.drunk} />
          <StatCard label="Bevestigd" value={beer.confirmed} />
          <StatCard label="Uitgedeeld" value={beer.given} />
        </div>
      </div>

      {/* Extra vragen */}
      <div>
        <h3 className="text-lg font-semibold text-gold mb-3">Extra vragen</h3>
        <div className="card">
          <ExtraRow label="Wereldkampioen" r={extra.worldChampion} />
          <ExtraRow label="Topschutter" r={extra.topScorer} />
          <ExtraRow label="Belgische topschutter" r={extra.belgianTopScorer} />
        </div>
      </div>
    </div>
  );
}
