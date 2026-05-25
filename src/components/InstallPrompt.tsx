'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     (navigator as unknown as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDismissed(true);
      setDeferredPrompt(null);
    }
  }

  return (
    <>
      <button
        onClick={isIOS ? () => setShowIOSGuide(true) : handleInstall}
        className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
      >
        Installeer app
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 pb-6" onClick={() => setShowIOSGuide(false)}>
          <div
            className="w-full max-w-md mx-4 rounded-2xl p-6 border border-white/10"
            style={{ background: 'linear-gradient(135deg, #0b1026 0%, #1b3a6b 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">App installeren op iPhone/iPad</h3>
            <ol className="text-gray-300 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-xl">1.</span>
                <span>Tik op het <strong className="text-white">Deel-icoon</strong> (vierkantje met pijl omhoog) onderaan Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">2.</span>
                <span>Scroll naar beneden en tik op <strong className="text-white">&quot;Zet op beginscherm&quot;</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">3.</span>
                <span>Tik op <strong className="text-white">&quot;Voeg toe&quot;</strong> rechtsboven</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full btn-primary text-center"
            >
              Begrepen!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
