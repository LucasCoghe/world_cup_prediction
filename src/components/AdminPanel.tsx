'use client';

import { useState, useEffect } from 'react';
import { groupMatches, knockoutStructure, teams, getRoundName } from '@/lib/tournament';
import FlagIcon from './FlagIcon';

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
  const [activeSection, setActiveSection] = useState<'users' | 'results' | 'notify'>('users');
  const [notifyStatus, setNotifyStatus] = useState('');
  const [editingMatch, setEditingMatch] = useState<number | null>(null);
  const [editHome, setEditHome] = useState('');
  const [editAway, setEditAway] = useState('');

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users || []));
    fetch('/api/admin/results').then(r => r.json()).then(d => setResults(d.results || []));
  }, []);

  async function lockAll() {
    if (!confirm('Alle deelnemers vergrendelen? Ze kunnen dan niet meer wijzigen.')) return;
    await fetch('/api/admin/lock', { method: 'PUT' });
    setUsers(users.map(u => u.isAdmin ? u : { ...u, locked: true }));
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`${name} verwijderen? Alle voorspellingen en data worden gewist.`)) return;
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setUsers(users.filter(u => u.id !== userId));
  }

  async function toggleLock(userId: string, locked: boolean) {
    await fetch('/api/admin/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locked }),
    });
    setUsers(users.map(u => u.id === userId ? { ...u, locked } : u));
  }

  async function saveResult(matchNumber: number) {
    const home = parseInt(editHome);
    const away = parseInt(editAway);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return;

    await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchNumber, homeScore: home, awayScore: away }),
    });
    const res = await fetch('/api/admin/results').then(r => r.json());
    setResults(res.results || []);
    setEditingMatch(null);
    setEditHome('');
    setEditAway('');
  }

  function startEditing(matchNumber: number) {
    const existing = results.find(r => r.matchNumber === matchNumber);
    setEditingMatch(matchNumber);
    setEditHome(existing ? String(existing.homeScore) : '');
    setEditAway(existing ? String(existing.awayScore) : '');
  }

  const resultMap = new Map(results.map(r => [r.matchNumber, r]));

  const allGroupMatches = groupMatches;
  const groups = [...new Set(allGroupMatches.map(m => m.group))].sort();

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
          Uitslagen ({results.length}/{groupMatches.length + knockoutStructure.length})
        </button>
        <button
          onClick={() => setActiveSection('notify')}
          className={`px-4 py-2 rounded-lg text-sm ${activeSection === 'notify' ? 'tab-active' : 'bg-white/5'}`}
        >
          Notificaties
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
                <>
                  <button
                    onClick={() => toggleLock(u.id, !u.locked)}
                    className="btn-secondary text-xs"
                  >
                    {u.locked ? 'Ontgrendel' : 'Vergrendel'}
                  </button>
                  <button
                    onClick={() => deleteUser(u.id, u.name)}
                    className="btn-secondary text-xs text-red-400 hover:text-red-300"
                  >
                    Verwijder
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {activeSection === 'results' && (
        <div className="space-y-6">
          {/* Group stage */}
          {groups.map(group => (
            <div key={group} className="card">
              <h3 className="text-sm font-semibold text-gold mb-3">Groep {group}</h3>
              <div className="space-y-2">
                {allGroupMatches.filter(m => m.group === group).map(match => {
                  const home = teams[match.home];
                  const away = teams[match.away];
                  const result = resultMap.get(match.matchNumber);
                  const isEditing = editingMatch === match.matchNumber;

                  return (
                    <div key={match.matchNumber} className={`flex items-center gap-2 py-2 px-3 rounded-lg ${result ? 'bg-green-950/20 border border-green-600/20' : 'bg-white/5'}`}>
                      <span className="text-xs text-gray-500 w-8">#{match.matchNumber}</span>

                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <span className="text-sm">{home?.name}</span>
                        <FlagIcon teamCode={match.home} size={18} />
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1 mx-2">
                          <input
                            type="number"
                            min="0"
                            value={editHome}
                            onChange={e => setEditHome(e.target.value)}
                            placeholder="-"
                            className="score-input w-12 text-center"
                            autoFocus
                          />
                          <span className="text-gray-500 font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            value={editAway}
                            onChange={e => setEditAway(e.target.value)}
                            placeholder="-"
                            className="score-input w-12 text-center"
                          />
                        </div>
                      ) : (
                        <div className="mx-2 w-16 text-center">
                          {result ? (
                            <span className="font-bold text-green-400">{result.homeScore} - {result.awayScore}</span>
                          ) : (
                            <span className="text-gray-600">- : -</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 flex-1">
                        <FlagIcon teamCode={match.away} size={18} />
                        <span className="text-sm">{away?.name}</span>
                      </div>

                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveResult(match.matchNumber)} className="btn-primary text-xs px-2 py-1">OK</button>
                          <button onClick={() => setEditingMatch(null)} className="btn-secondary text-xs px-2 py-1">X</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(match.matchNumber)}
                          className="btn-secondary text-xs px-2 py-1"
                        >
                          {result ? 'Wijzig' : 'Invullen'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Knockout stage */}
          {(() => {
            const rounds = [...new Set(knockoutStructure.map(m => m.round))];
            return rounds.map(round => (
              <div key={round} className="card">
                <h3 className="text-sm font-semibold text-gold mb-3">{getRoundName(round)}</h3>
                <div className="space-y-2">
                  {knockoutStructure.filter(m => m.round === round).map(match => {
                    const result = resultMap.get(match.matchNumber);
                    const isEditing = editingMatch === match.matchNumber;

                    return (
                      <div key={match.matchNumber} className={`flex items-center gap-2 py-2 px-3 rounded-lg ${result ? 'bg-green-950/20 border border-green-600/20' : 'bg-white/5'}`}>
                        <span className="text-xs text-gray-500 w-8">#{match.matchNumber}</span>

                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <span className="text-sm text-gray-400">{match.homeSource}</span>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-1 mx-2">
                            <input
                              type="number"
                              min="0"
                              value={editHome}
                              onChange={e => setEditHome(e.target.value)}
                              placeholder="-"
                              className="score-input w-12 text-center"
                              autoFocus
                            />
                            <span className="text-gray-500 font-bold">-</span>
                            <input
                              type="number"
                              min="0"
                              value={editAway}
                              onChange={e => setEditAway(e.target.value)}
                              placeholder="-"
                              className="score-input w-12 text-center"
                            />
                          </div>
                        ) : (
                          <div className="mx-2 w-16 text-center">
                            {result ? (
                              <span className="font-bold text-green-400">{result.homeScore} - {result.awayScore}</span>
                            ) : (
                              <span className="text-gray-600">- : -</span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-sm text-gray-400">{match.awaySource}</span>
                        </div>

                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveResult(match.matchNumber)} className="btn-primary text-xs px-2 py-1">OK</button>
                            <button onClick={() => setEditingMatch(null)} className="btn-secondary text-xs px-2 py-1">X</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(match.matchNumber)}
                            className="btn-secondary text-xs px-2 py-1"
                          >
                            {result ? 'Wijzig' : 'Invullen'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
      {activeSection === 'notify' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gold mb-3">Deadline Reminders</h3>
            <p className="text-sm text-gray-400 mb-3">
              Stuur een herinnering naar deelnemers die nog geen voorspelling hebben ingevuld voor wedstrijden die binnen het uur beginnen.
            </p>
            <button
              onClick={async () => {
                setNotifyStatus('Verzenden...');
                try {
                  const res = await fetch('/api/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'deadline' }),
                  });
                  const data = await res.json();
                  if (data.sent !== undefined) {
                    setNotifyStatus(`${data.sent} notificatie(s) verstuurd${data.matches ? ` voor ${data.matches} wedstrijd(en)` : ''}.`);
                  } else if (data.message) {
                    setNotifyStatus(data.message);
                  } else {
                    setNotifyStatus('Geen notificaties verstuurd.');
                  }
                } catch {
                  setNotifyStatus('Fout bij versturen.');
                }
              }}
              className="btn-primary text-sm"
            >
              Stuur deadline reminders
            </button>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gold mb-3">Custom Notificatie</h3>
            <div className="space-y-2 mb-3">
              <input
                type="text"
                id="notify-title"
                placeholder="Titel (optioneel)"
                className="score-input w-full px-3 py-2"
              />
              <input
                type="text"
                id="notify-body"
                placeholder="Bericht"
                className="score-input w-full px-3 py-2"
              />
            </div>
            <button
              onClick={async () => {
                const title = (document.getElementById('notify-title') as HTMLInputElement).value;
                const body = (document.getElementById('notify-body') as HTMLInputElement).value;
                if (!body) { setNotifyStatus('Vul een bericht in.'); return; }
                setNotifyStatus('Verzenden...');
                try {
                  const res = await fetch('/api/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'custom', title, body }),
                  });
                  const data = await res.json();
                  setNotifyStatus(`${data.sent || 0} notificatie(s) verstuurd.`);
                } catch {
                  setNotifyStatus('Fout bij versturen.');
                }
              }}
              className="btn-primary text-sm"
            >
              Verstuur naar iedereen
            </button>
          </div>

          {notifyStatus && (
            <div className="card bg-blue-950/20 border border-blue-600/20">
              <p className="text-sm text-blue-300">{notifyStatus}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
