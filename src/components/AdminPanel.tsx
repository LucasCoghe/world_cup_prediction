'use client';

import { useState, useEffect } from 'react';
import { groupMatches, knockoutStructure, teams, getRoundName, TOTAL_GROUP_MATCHES } from '@/lib/tournament';
import type { GroupMatch, KnockoutMatch } from '@/lib/tournament';
import FlagIcon from './FlagIcon';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  locked: boolean;
  isAdmin: boolean;
  inlegPaid: boolean;
  _count: { predictions: number; pushSubscriptions: number };
}

interface Result {
  matchNumber: number;
  homeScore: number;
  awayScore: number;
  advancingTeam: string | null;
  live: boolean;
}

interface KnockoutMatchTeams {
  homeTeam: string | null;
  awayTeam: string | null;
}

interface ExtraResult {
  topScorer: string;
  belgianTopScorer: string;
  worldChampion: string;
  topScorerGoals: number;
  topScorerFirstGoalMin: number;
}

const allTeamsList = Object.values(teams).sort((a, b) => a.name.localeCompare(b.name));

export default function AdminPanel() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [activeSection, setActiveSection] = useState<'users' | 'results' | 'extra' | 'notify'>('users');
  const [extra, setExtra] = useState<ExtraResult>({ topScorer: '', belgianTopScorer: '', worldChampion: '', topScorerGoals: 0, topScorerFirstGoalMin: 0 });
  const [extraStatus, setExtraStatus] = useState('');
  const [notifyStatus, setNotifyStatus] = useState('');
  const [editingMatch, setEditingMatch] = useState<number | null>(null);
  const [editHome, setEditHome] = useState('');
  const [editAway, setEditAway] = useState('');
  const [editAdvancing, setEditAdvancing] = useState('');
  const [koTeams, setKoTeams] = useState<Record<number, KnockoutMatchTeams>>({});
  const [resultsView, setResultsView] = useState<'chrono' | 'grouped'>('chrono');
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users || []));
    fetch('/api/admin/results').then(r => r.json()).then(d => setResults(d.results || []));
    fetch('/api/knockout-teams').then(r => r.json()).then(d => setKoTeams(d.teams || {}));
    fetch('/api/admin/extra-results').then(r => r.json()).then(d => {
      if (d.result) {
        setExtra({
          topScorer: d.result.topScorer || '',
          belgianTopScorer: d.result.belgianTopScorer || '',
          worldChampion: d.result.worldChampion || '',
          topScorerGoals: d.result.topScorerGoals || 0,
          topScorerFirstGoalMin: d.result.topScorerFirstGoalMin || 0,
        });
      }
    });
  }, []);

  async function saveExtra() {
    setExtraStatus('Opslaan...');
    const res = await fetch('/api/admin/extra-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra),
    });
    setExtraStatus(res.ok ? 'Opgeslagen!' : 'Fout bij opslaan.');
  }

  async function lockAll() {
    if (!confirm('Alle deelnemers vergrendelen? Ze kunnen dan niet meer wijzigen.')) return;
    await fetch('/api/admin/lock', { method: 'PUT' });
    setUsers(users.map(u => u.isAdmin ? u : { ...u, locked: true }));
  }

  async function resetPassword(userId: string, name: string) {
    const newPassword = prompt(`Nieuw wachtwoord voor ${name}:`);
    if (!newPassword) return;
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword }),
    });
    if (res.ok) {
      alert(`Wachtwoord van ${name} is gewijzigd!`);
    } else {
      alert('Fout bij het wijzigen van het wachtwoord.');
    }
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`${name} verwijderen? Alle voorspellingen en data worden gewist.`)) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Verwijderen mislukt: ${data.error || res.statusText}`);
      return;
    }
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

  async function toggleInlegPaid(userId: string, inlegPaid: boolean) {
    const res = await fetch('/api/admin/inleg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, inlegPaid }),
    });
    if (!res.ok) {
      alert('Kon inleg-status niet bijwerken.');
      return;
    }
    setUsers(users.map(u => u.id === userId ? { ...u, inlegPaid } : u));
  }

  async function saveResult(matchNumber: number, live: boolean) {
    const home = parseInt(editHome);
    const away = parseInt(editAway);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return;

    // For knockout draws, advancingTeam is required to record the penalty-shootout winner
    const isKnockout = matchNumber > TOTAL_GROUP_MATCHES;
    const isDraw = home === away;
    if (isKnockout && isDraw && !editAdvancing) {
      alert('Bij een gelijkspel in de knockout moet je aanduiden welk team doorgaat (na penalty\'s).');
      return;
    }

    await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchNumber,
        homeScore: home,
        awayScore: away,
        advancingTeam: isKnockout && isDraw ? editAdvancing : null,
        live,
      }),
    });
    const res = await fetch('/api/admin/results').then(r => r.json());
    setResults(res.results || []);
    setEditingMatch(null);
    setEditHome('');
    setEditAway('');
    setEditAdvancing('');
  }

  function startEditing(matchNumber: number) {
    const existing = results.find(r => r.matchNumber === matchNumber);
    setEditingMatch(matchNumber);
    setEditHome(existing ? String(existing.homeScore) : '');
    setEditAway(existing ? String(existing.awayScore) : '');
    setEditAdvancing(existing?.advancingTeam || '');
  }

  const resultMap = new Map(results.map(r => [r.matchNumber, r]));

  const allGroupMatches = groupMatches;
  const groups = [...new Set(allGroupMatches.map(m => m.group))].sort();

  // Renders one editable match row, works for both group and knockout matches.
  function renderMatchRow(
    match: GroupMatch | KnockoutMatch,
    opts: { showTime?: boolean } = {}
  ) {
    const isKnockout = match.matchNumber > TOTAL_GROUP_MATCHES;
    const result = resultMap.get(match.matchNumber);
    const isEditing = editingMatch === match.matchNumber;
    const bg = result ? (result.live ? 'bg-amber-950/20 border border-amber-600/30' : 'bg-green-950/20 border border-green-600/20') : 'bg-white/5';

    // Resolve team labels + flags
    let homeLabel: string;
    let awayLabel: string;
    let homeFlag: string | null = null;
    let awayFlag: string | null = null;
    let labelClass = '';
    if (isKnockout) {
      const km = match as KnockoutMatch;
      const resolved = koTeams[match.matchNumber];
      homeFlag = resolved?.homeTeam || null;
      awayFlag = resolved?.awayTeam || null;
      homeLabel = resolved?.homeTeam ? (teams[resolved.homeTeam]?.name || resolved.homeTeam) : km.homeSource;
      awayLabel = resolved?.awayTeam ? (teams[resolved.awayTeam]?.name || resolved.awayTeam) : km.awaySource;
      labelClass = 'text-gray-400';
    } else {
      const gm = match as GroupMatch;
      homeFlag = gm.home;
      awayFlag = gm.away;
      homeLabel = teams[gm.home]?.name || gm.home;
      awayLabel = teams[gm.away]?.name || gm.away;
    }

    const resolved = isKnockout ? koTeams[match.matchNumber] : undefined;
    const isDrawInput = isKnockout && isEditing && editHome !== '' && editHome === editAway;

    const actions = isEditing ? (
      <div className="flex gap-1">
        <button
          onClick={() => saveResult(match.matchNumber, true)}
          className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold"
          title="Tussenstand opslaan (geen pushes)"
        >Live</button>
        <button
          onClick={() => saveResult(match.matchNumber, false)}
          className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white font-semibold"
          title="Eindscore: berekent biertjes + pushes"
        >Finaal</button>
        <button onClick={() => setEditingMatch(null)} className="btn-secondary text-xs px-2 py-1">X</button>
      </div>
    ) : (
      <button
        onClick={() => startEditing(match.matchNumber)}
        className="btn-secondary text-xs px-2 py-1"
      >
        {result ? (result.live ? 'Live ✏️' : 'Wijzig') : 'Invullen'}
      </button>
    );

    return (
      <div key={match.matchNumber} className={`rounded-lg ${bg}`}>
        <div className="flex items-center gap-2 py-2 px-2 sm:px-3">
          <span className="text-[10px] sm:text-xs text-gray-500 w-6 sm:w-8 shrink-0">
            #{match.matchNumber}
            {opts.showTime && <span className="hidden sm:block text-[9px] text-gray-600">{match.time}</span>}
          </span>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0 justify-end">
            <span className={`text-xs sm:text-sm truncate ${labelClass}`}>{homeLabel}</span>
            {homeFlag && <FlagIcon teamCode={homeFlag} size={16} />}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                min="0"
                value={editHome}
                onChange={e => setEditHome(e.target.value)}
                placeholder="-"
                className="score-input w-10 sm:w-12 text-center"
                autoFocus
              />
              <span className="text-gray-500 font-bold">-</span>
              <input
                type="number"
                min="0"
                value={editAway}
                onChange={e => setEditAway(e.target.value)}
                placeholder="-"
                className="score-input w-10 sm:w-12 text-center"
              />
            </div>
          ) : (
            <div className="shrink-0 w-12 sm:w-16 text-center">
              {result ? (
                <div className="flex flex-col items-center leading-tight">
                  <span className={`text-sm sm:text-base font-bold ${result.live ? 'text-amber-300' : 'text-green-400'}`}>{result.homeScore} - {result.awayScore}</span>
                  {result.live && <span className="text-[9px] text-amber-500 font-bold animate-pulse">LIVE</span>}
                </div>
              ) : (
                <span className="text-gray-600 text-sm">- : -</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
            {awayFlag && <FlagIcon teamCode={awayFlag} size={16} />}
            <span className={`text-xs sm:text-sm truncate ${labelClass}`}>{awayLabel}</span>
          </div>

          <div className="hidden sm:block shrink-0">{actions}</div>
        </div>

        <div className="flex sm:hidden px-2 pb-2 justify-end">{actions}</div>

        {isDrawInput && (
          <div className="px-2 sm:px-3 pb-2 flex flex-wrap items-center gap-2 text-xs border-t border-white/5 pt-2">
            <span className="text-amber-400 font-semibold">Penalty&apos;s — wie ging door?</span>
            {resolved?.homeTeam && resolved?.awayTeam ? (
              <>
                <button
                  onClick={() => setEditAdvancing(resolved.homeTeam!)}
                  className={`px-2 py-1 rounded font-semibold ${editAdvancing === resolved.homeTeam ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  {teams[resolved.homeTeam]?.name || resolved.homeTeam}
                </button>
                <button
                  onClick={() => setEditAdvancing(resolved.awayTeam!)}
                  className={`px-2 py-1 rounded font-semibold ${editAdvancing === resolved.awayTeam ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  {teams[resolved.awayTeam]?.name || resolved.awayTeam}
                </button>
              </>
            ) : (
              <input
                type="text"
                value={editAdvancing}
                onChange={e => setEditAdvancing(e.target.value.toUpperCase())}
                placeholder="Team code (bv. BEL)"
                className="score-input px-2 py-1 w-32"
                maxLength={3}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Chronological list: all matches sorted by kickoff, grouped per day.
  const chronoDays: { date: string; matches: (GroupMatch | KnockoutMatch)[] }[] = (() => {
    const all: (GroupMatch | KnockoutMatch)[] = [...groupMatches, ...knockoutStructure];
    all.sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.matchNumber - b.matchNumber
    );
    const byDay = new Map<string, (GroupMatch | KnockoutMatch)[]>();
    for (const m of all) {
      if (!byDay.has(m.date)) byDay.set(m.date, []);
      byDay.get(m.date)!.push(m);
    }
    return [...byDay.entries()].map(([date, matches]) => ({ date, matches }));
  })();

  function formatDayHeader(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00`);
    const s = d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-xl font-bold text-red-400">Admin Paneel</h2>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSection('users')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${activeSection === 'users' ? 'tab-active' : 'bg-white/5'}`}
        >
          Deelnemers ({users.length})
        </button>
        <button
          onClick={() => setActiveSection('results')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${activeSection === 'results' ? 'tab-active' : 'bg-white/5'}`}
        >
          Uitslagen ({results.length}/{groupMatches.length + knockoutStructure.length})
        </button>
        <button
          onClick={() => setActiveSection('extra')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${activeSection === 'extra' ? 'tab-active' : 'bg-white/5'}`}
        >
          Extra vragen
        </button>
        <button
          onClick={() => setActiveSection('notify')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${activeSection === 'notify' ? 'tab-active' : 'bg-white/5'}`}
        >
          Notificaties
        </button>
      </div>

      {activeSection === 'users' && (
        <div className="space-y-3">
          {(() => {
            const nonAdmin = users.filter(u => !u.isAdmin);
            const paid = nonAdmin.filter(u => u.inlegPaid).length;
            return (
              <div className="card flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">Inleg betaald</div>
                  <div className="text-2xl font-bold text-gold">
                    {paid} / {nonAdmin.length}
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  Nog te innen:<br />
                  <span className="text-white font-semibold">{nonAdmin.length - paid} speler(s)</span>
                </div>
              </div>
            );
          })()}

          <button onClick={lockAll} className="btn-primary text-sm bg-red-600">
            Alle deelnemers vergrendelen
          </button>

          {users.map(u => (
            <div key={u.id} className="card flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.name} {u.isAdmin && '(admin)'}</div>
                <div className="text-xs text-gray-500 break-all sm:break-normal sm:truncate">
                  {u.email} · {u._count.predictions} voorspellingen
                  {u._count.pushSubscriptions > 0 && (
                    <span className="ml-1.5 text-green-400" title="Notificaties aan">
                      · 🔔 {u._count.pushSubscriptions}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className={`text-xs px-2 py-1 rounded ${u.locked ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                  {u.locked ? 'Vergrendeld' : 'Actief'}
                </span>
                {!u.isAdmin && (
                  <span className={`text-xs px-2 py-1 rounded ${u.inlegPaid ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'}`}>
                    {u.inlegPaid ? 'Inleg betaald' : 'Niet betaald'}
                  </span>
                )}
                {!u.isAdmin && (
                  <>
                    <button
                      onClick={() => toggleInlegPaid(u.id, !u.inlegPaid)}
                      className={`btn-secondary text-xs ${u.inlegPaid ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'}`}
                    >
                      {u.inlegPaid ? 'Onbetaald' : 'Betaald'}
                    </button>
                    <button
                      onClick={() => toggleLock(u.id, !u.locked)}
                      className="btn-secondary text-xs"
                    >
                      {u.locked ? 'Ontgrendel' : 'Vergrendel'}
                    </button>
                    <button
                      onClick={() => resetPassword(u.id, u.name)}
                      className="btn-secondary text-xs"
                    >
                      Reset WW
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
            </div>
          ))}
        </div>
      )}

      {activeSection === 'results' && (
        <div className="space-y-4">
          {/* View toggle + filter */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setResultsView('chrono')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium ${resultsView === 'chrono' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Chronologisch
              </button>
              <button
                onClick={() => setResultsView('grouped')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium ${resultsView === 'grouped' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Per groep / ronde
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={e => setHideCompleted(e.target.checked)}
                className="accent-gold"
              />
              Verberg ingevulde
            </label>
          </div>

          {resultsView === 'chrono' ? (
            <div className="space-y-4">
              {chronoDays.map(({ date, matches }) => {
                const visible = hideCompleted
                  ? matches.filter(m => !resultMap.has(m.matchNumber))
                  : matches;
                if (visible.length === 0) return null;
                const done = matches.filter(m => resultMap.has(m.matchNumber)).length;
                return (
                  <div key={date} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gold">{formatDayHeader(date)}</h3>
                      <span className={`text-xs ${done === matches.length ? 'text-green-400' : 'text-gray-500'}`}>
                        {done}/{matches.length} ingevuld
                      </span>
                    </div>
                    <div className="space-y-2">
                      {visible.map(match => renderMatchRow(match, { showTime: true }))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group stage */}
              {groups.map(group => {
                const matches = allGroupMatches.filter(m => m.group === group);
                const visible = hideCompleted ? matches.filter(m => !resultMap.has(m.matchNumber)) : matches;
                if (visible.length === 0) return null;
                return (
                  <div key={group} className="card">
                    <h3 className="text-sm font-semibold text-gold mb-3">Groep {group}</h3>
                    <div className="space-y-2">
                      {visible.map(match => renderMatchRow(match))}
                    </div>
                  </div>
                );
              })}

              {/* Knockout stage */}
              {[...new Set(knockoutStructure.map(m => m.round))].map(round => {
                const matches = knockoutStructure.filter(m => m.round === round);
                const visible = hideCompleted ? matches.filter(m => !resultMap.has(m.matchNumber)) : matches;
                if (visible.length === 0) return null;
                return (
                  <div key={round} className="card">
                    <h3 className="text-sm font-semibold text-gold mb-3">{getRoundName(round)}</h3>
                    <div className="space-y-2">
                      {visible.map(match => renderMatchRow(match))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeSection === 'extra' && (
        <div className="space-y-4">
          <div className="card bg-blue-950/20 border border-blue-600/20">
            <p className="text-sm text-blue-300">
              Vul hier de echte antwoorden op de extra vragen in. De topschutter, Belgische topschutter en wereldkampioen leveren punten op.
              De schiftingsvragen (aantal goals + minuut eerste doelpunt) bepalen de volgorde in het klassement bij een gelijk aantal punten.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <label className="block text-base text-gold font-semibold mb-2">Wereldkampioen (15 punten)</label>
              <select
                value={extra.worldChampion}
                onChange={e => setExtra({ ...extra, worldChampion: e.target.value })}
                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold"
              >
                <option value="">-- Nog niet bekend --</option>
                {allTeamsList.map(t => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="card">
              <label className="block text-base text-gold font-semibold mb-2">Topschutter (10 punten)</label>
              <input
                type="text"
                value={extra.topScorer}
                onChange={e => setExtra({ ...extra, topScorer: e.target.value })}
                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold"
                placeholder="Naam van de speler"
              />
            </div>

            <div className="card">
              <label className="block text-base text-gold font-semibold mb-2">Belgische Topschutter (10 punten)</label>
              <input
                type="text"
                value={extra.belgianTopScorer}
                onChange={e => setExtra({ ...extra, belgianTopScorer: e.target.value })}
                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold"
                placeholder="Naam van de Belgische speler"
              />
            </div>

            <div className="card">
              <label className="block text-base text-gold font-semibold mb-2">Schiftingsvraag 1: Aantal goals topschutter</label>
              <input
                type="number"
                min="0"
                value={extra.topScorerGoals || ''}
                onChange={e => setExtra({ ...extra, topScorerGoals: parseInt(e.target.value) || 0 })}
                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold"
                placeholder="Aantal doelpunten"
              />
            </div>

            <div className="card md:col-span-2">
              <label className="block text-base text-gold font-semibold mb-2">Schiftingsvraag 2: Minuut eerste doelpunt topschutter</label>
              <input
                type="number"
                min="1"
                max="120"
                value={extra.topScorerFirstGoalMin || ''}
                onChange={e => setExtra({ ...extra, topScorerFirstGoalMin: parseInt(e.target.value) || 0 })}
                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold"
                placeholder="Minuut (1-120)"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveExtra} className="btn-primary text-sm">Opslaan</button>
            {extraStatus && <span className="text-sm text-gray-300">{extraStatus}</span>}
          </div>
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
            <button
              onClick={async () => {
                setNotifyStatus('Test verzenden...');
                try {
                  const res = await fetch('/api/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'deadline', test: true }),
                  });
                  const data = await res.json();
                  if (data.sent !== undefined) {
                    setNotifyStatus(`TEST: ${data.sent} notificatie(s) verstuurd${data.matches ? ` voor ${data.matches} wedstrijd(en)` : ''}.`);
                  } else {
                    setNotifyStatus('Geen notificaties verstuurd.');
                  }
                } catch {
                  setNotifyStatus('Fout bij versturen.');
                }
              }}
              className="btn-secondary text-sm ml-2"
            >
              Test (doe alsof wedstrijden beginnen)
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
