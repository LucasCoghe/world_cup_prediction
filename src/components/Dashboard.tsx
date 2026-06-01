'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import GroupStage from './GroupStage';
import KnockoutStage from './KnockoutStage';
import ExtraQuestions from './ExtraQuestions';
import Leaderboard from './Leaderboard';
import Schandpaal from './Schandpaal';
import Rules from './Rules';
import AdminPanel from './AdminPanel';
import GroupChat from './GroupChat';
import InstallPrompt from './InstallPrompt';
import NotificationToggle from './NotificationToggle';
import BracketSimulator from './BracketSimulator';
import KeepyUppy from './KeepyUppy';
import { usePredictions } from '@/hooks/usePredictions';
import { groupMatches, knockoutStructure } from '@/lib/tournament';

interface Props {
  user: { userId: string; name: string; isAdmin: boolean };
  onLogout: () => void;
}

const baseTabs = [
  { id: 'leaderboard', label: 'Klassement' },
  { id: 'schandpaal', label: 'Schandpaal' },
  { id: 'groups', label: 'Groepsfase' },
  { id: 'knockout', label: 'Knockout' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'extra', label: 'Extra' },
  { id: 'chat', label: 'Chat' },
  { id: 'minigame', label: 'Minigame' },
  { id: 'rules', label: 'Regels' },
];

const extraBelgianDates: Record<string, string> = {
  '2026-06-02': 'Kroatië (oefenmatch)',
  '2026-06-06': 'Tunesië (oefenmatch)',
};

function isBelgianMatchDay(): boolean {
  const today = new Date().toISOString().split('T')[0];
  const belgianDates = [
    ...groupMatches.filter(m => m.home === 'BEL' || m.away === 'BEL').map(m => m.date),
    ...knockoutStructure.filter(m => m.homeSource.includes('BEL') || m.awaySource.includes('BEL')).map(m => m.date),
    ...Object.keys(extraBelgianDates),
  ];
  return belgianDates.includes(today);
}

function getBelgianMatchToday(): string | null {
  const today = new Date().toISOString().split('T')[0];
  if (extraBelgianDates[today]) return extraBelgianDates[today];
  const match = groupMatches.find(m => m.date === today && (m.home === 'BEL' || m.away === 'BEL'));
  if (!match) return null;
  const opponent = match.home === 'BEL' ? match.away : match.home;
  return opponent;
}

const CHAT_SEEN_KEY = 'chat_last_seen';

export default function Dashboard({ user, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const predictions = usePredictions();
  const tabs = user.isAdmin
    ? [...baseTabs, { id: 'admin', label: 'Admin' }]
    : baseTabs;

  const fetchUnread = useCallback(() => {
    const since = localStorage.getItem(CHAT_SEEN_KEY) || '';
    const url = since ? `/api/comments/unread?since=${encodeURIComponent(since)}` : '/api/comments/unread';
    fetch(url).then(r => r.ok ? r.json() : null).then(data => setUnreadCount(data?.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    if (activeTab === 'chat') {
      localStorage.setItem(CHAT_SEEN_KEY, new Date().toISOString());
      setUnreadCount(0);
    }
  }, [activeTab]);

  // ?bel=1 in URL forceert Belgisch thema voor testing
  const belgianDay = useMemo(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bel')) return true;
    return isBelgianMatchDay();
  }, []);
  const belgianOpponent = useMemo(() => getBelgianMatchToday(), []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className={`min-h-screen ${belgianDay ? 'belgian-mode' : ''}`}>
      {/* Belgian match day banner */}
      {belgianDay && (
        <div className="belgian-banner">
          RODE DUIVELS SPELEN VANDAAG!{belgianOpponent ? ` vs ${belgianOpponent}` : ''}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg border-b border-white/10" style={{ background: 'linear-gradient(90deg, rgba(0,40,104,0.85) 0%, rgba(6,13,31,0.95) 30%, rgba(6,13,31,0.95) 70%, rgba(107,21,32,0.85) 100%)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold trophy-text">WK 2026 Pronostiek</h1>
          <div className="flex items-center gap-3">
            <NotificationToggle />
            <InstallPrompt />
            <span className="text-base text-gray-400">
              {user.name} {user.isAdmin && '(admin)'}
            </span>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">
              Uitloggen
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-lg text-base font-medium whitespace-nowrap transition-all relative ${
                activeTab === tab.id
                  ? 'tab-active'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
              {tab.id === 'chat' && unreadCount > 0 && activeTab !== 'chat' && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1 animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'leaderboard' && <Leaderboard currentUserId={user.userId} />}
        {activeTab === 'schandpaal' && <Schandpaal />}
        {activeTab === 'groups' && <GroupStage predictions={predictions} />}
        {activeTab === 'knockout' && <KnockoutStage predictions={predictions} />}
        {activeTab === 'simulator' && <BracketSimulator groupPredictions={predictions.getScoresArray()} />}
        {activeTab === 'extra' && <ExtraQuestions predictions={predictions} />}
        {activeTab === 'chat' && <GroupChat />}
        {activeTab === 'minigame' && <KeepyUppy />}
        {activeTab === 'rules' && <Rules />}
        {activeTab === 'admin' && user.isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}
