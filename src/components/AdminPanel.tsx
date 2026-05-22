'use client';

import { useState, useEffect } from 'react';
import { groupMatches, knockoutStructure, teams, getRoundName } from '@/lib/tournament';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  locked: boolean;
  isAdmin: boolean;
  _count: { predictions: number };
}

interface Result {
  matchNumber: number;
  homeScore: number;
  awayScore: number;
  advancingTeam: string | null;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [activeSection, setActiveSection] = useState<'users' | 'results'>('users');
  const [resultInput, setResultInput] = useState({ matchNumber: 1, homeScore: 0, awayScore: 0 });

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users || []));
    fetch('/api/admin/results').then(r => r.json()).then(d => setResults(d.results || []));
  }, []);

  async function lockAll() {
    if (!confirm('Alle deelnemers vergrendelen? Ze kunnen dan niet meer wijzigen.')) return;
    await fetch('/api/admin/lock', { method: 'PUT' });
    setUsers(users.map(u => u.isAdmin ? u : { ...u, locked: true }));
  }

  async function toggleLock(userId: string, locked: boolean) {
    await fetch('/api/admin/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locked }),
    });
    setUsers(users.map(u => u.id === userId ? { ...u, locked } : u));
  }

  async function saveResult() {
    await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultInput),
    });
    const res = await fetch('/api/admin/results').then(r => r.json());
    setResults(res.results || []);
  }

  const allMatches = [...groupMatches, ...knockoutStructure];

  function getMatchInfo(matchNumber: number) {
    const gm = groupMatches.find(m => m.matchNumber === matchNumber);
    if (gm) {
      const h = teams[gm.home];
      const a = teams[gm.away];
      return `${h?.flag} ${h?.name} vs ${a?.name} ${a?.flag} (Groep ${gm.group})`;
    }
    const km = knockoutStructure.find(m => m.matchNumber === matchNumber);
    if (km) {
      return `${km.homeSource} vs ${km.awaySource} (${getRoundName(km.round)})`;
    }
    return `Wedstrijd ${matchNumber}`;
  }

  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-xl font-bold text-red-400">Admin Paneel</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('users')}
          className={`px-4 py-2 rounded-lg text-sm ${activeSection === 'users' ? 'tab-active' : 'bg-white/5'}`}
        >
          Deelnemers ({users.length})
        </button>
        <button
          onClick={() => setActiveSection('results')}
          className={`px-4 py-2 rounded-lg text-sm ${activeSection === 'results' ? 'tab-active' : 'bg-white/5'}`}
        >
          Uitslagen ({results.length})
        </button>
      </div>

      {activeSection === 'users' && (
        <div className="space-y-3">
          <button onClick={lockAll} className="btn-primary text-sm bg-red-600">
            Alle deelnemers vergrendelen
          </button>

          {users.map(u => (
            <div key={u.id} className="card flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{u.name} {u.isAdmin && '(admin)'}</div>
                <div className="text-xs text-gray-500">{u.email} - {u._count.predictions} voorspellingen</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${u.locked ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                {u.locked ? 'Vergrendeld' : 'Actief'}
              </span>
              {!u.isAdmin && (
                <button
                  onClick={() => toggleLock(u.id, !u.locked)}
                  className="btn-secondary text-xs"
                >
                  {u.locked ? 'Ontgrendel' : 'Vergrendel'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeSection === 'results' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gold mb-3">Resultaat invoeren</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Wedstrijd #</label>
                <input
                  type="number"
                  min="1"
                  max="104"
                  value={resultInput.matchNumber}
                  onChange={e => setResultInput({ ...resultInput, matchNumber: parseInt(e.target.value) || 1 })}
                  className="score-input w-20"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Thuis</label>
                <input
                  type="number"
                  min="0"
                  value={resultInput.homeScore}
                  onChange={e => setResultInput({ ...resultInput, homeScore: parseInt(e.target.value) || 0 })}
                  className="score-input"
                />
              </div>
              <span className="text-gray-500 font-bold pb-2">-</span>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Uit</label>
                <input
                  type="number"
                  min="0"
                  value={resultInput.awayScore}
                  onChange={e => setResultInput({ ...resultInput, awayScore: parseInt(e.target.value) || 0 })}
                  className="score-input"
                />
              </div>
              <button onClick={saveResult} className="btn-primary text-sm">
                Opslaan
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {getMatchInfo(resultInput.matchNumber)}
            </p>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gold mb-3">Ingevoerde uitslagen</h3>
            {results.length === 0 ? (
              <p className="text-sm text-gray-500">Nog geen uitslagen ingevoerd.</p>
            ) : (
              <div className="space-y-1">
                {results.map(r => (
                  <div key={r.matchNumber} className="flex items-center gap-2 text-sm py-1 border-b border-white/5">
                    <span className="text-gray-500 w-8">#{r.matchNumber}</span>
                    <span className="flex-1 text-xs text-gray-400">{getMatchInfo(r.matchNumber)}</span>
                    <span className="font-bold">{r.homeScore} - {r.awayScore}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
