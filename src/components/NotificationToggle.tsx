'use client';

import { useState, useEffect } from 'react';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from './ServiceWorkerRegistration';

export default function NotificationToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if ('PushManager' in window && 'serviceWorker' in navigator) {
      setSupported(true);
      isPushSubscribed().then(s => { setSubscribed(s); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, []);

  if (!supported || loading) return null;

  async function toggle() {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const ok = await subscribeToPush();
        setSubscribed(ok);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={subscribed ? 'Notificaties uitschakelen' : 'Notificaties inschakelen'}
      className={`text-lg px-1 transition-opacity ${loading ? 'opacity-50' : 'hover:opacity-80'}`}
    >
      {subscribed ? '\u{1F514}' : '\u{1F515}'}
    </button>
  );
}
