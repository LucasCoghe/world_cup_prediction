'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { subscribeToPush } from './ServiceWorkerRegistration';

const STORAGE_KEY = 'notif_onboarding_asked';

export default function NotificationOnboarding() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      await subscribeToPush();
    } finally {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      setShow(false);
      setBusy(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setShow(false);
  }

  if (!mounted || !show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 border border-gold/30 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #0b1026 0%, #060d1f 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🔔</span>
          <h3 className="text-lg font-bold text-white">Meldingen aanzetten?</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          Krijg een seintje voor de aftrap van wedstrijden, wanneer voorspellingen sluiten, en wanneer er biertjes uitgedeeld worden 🍺
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Je kan dit later altijd nog veranderen via de 🔔 bovenaan.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={dismiss}
            disabled={busy}
            className="flex-1 px-4 py-2.5 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            Later
          </button>
          <button
            onClick={enable}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-bold rounded-lg shadow active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? 'Bezig...' : 'Aanzetten'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
