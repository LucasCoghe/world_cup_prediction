'use client';

import { useEffect, useState } from 'react';
import { PATCH_NOTES, getUnseenPatches } from '@/lib/patch-notes';

const STORAGE_KEY = 'patch_notes_seen_id';

interface Props {
  onNavigate?: (tabId: string) => void;
}

export default function PatchNotesModal({ onNavigate }: Props) {
  const [unseen, setUnseen] = useState<typeof PATCH_NOTES>([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      const toShow = getUnseenPatches(lastSeen);
      if (toShow.length > 0) {
        setUnseen(toShow);
      }
    } catch {}
  }, []);

  function dismiss() {
    setClosing(true);
    try {
      const latest = PATCH_NOTES[0]?.id;
      if (latest) localStorage.setItem(STORAGE_KEY, latest);
    } catch {}
    setTimeout(() => setUnseen([]), 200);
  }

  function handleCta(tabId: string) {
    onNavigate?.(tabId);
    dismiss();
  }

  if (unseen.length === 0) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={dismiss}
    >
      <div
        className={`relative max-w-md w-full max-h-[85vh] overflow-y-auto rounded-2xl border border-gold/30 shadow-2xl transition-transform duration-200 ${
          closing ? 'scale-95' : 'scale-100'
        }`}
        style={{
          background: 'linear-gradient(180deg, #0b1026 0%, #060d1f 100%)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-b from-gold/15 to-transparent px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              <h2 className="text-lg font-bold text-white">Wat is er nieuw?</h2>
            </div>
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-white text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-6">
          {unseen.map(patch => (
            <div key={patch.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{patch.emoji}</span>
                  <div>
                    <h3 className="text-base font-bold text-gold">{patch.title}</h3>
                    <p className="text-xs text-gray-500">{patch.date}</p>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 mt-3">
                {patch.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-200 leading-relaxed">
                    <span className="shrink-0 w-5 text-center">{item.icon}</span>
                    <span className="flex-1">{item.text}</span>
                  </li>
                ))}
              </ul>

              {patch.cta && (
                <button
                  onClick={() => handleCta(patch.cta!.tabId)}
                  className="mt-4 w-full px-4 py-2.5 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-bold rounded-lg shadow active:scale-95 transition-all"
                >
                  {patch.cta.label} →
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 px-5 py-3 bg-gradient-to-t from-darker to-transparent border-t border-white/5">
          <button
            onClick={dismiss}
            className="w-full px-4 py-2 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Begrepen
          </button>
        </div>
      </div>
    </div>
  );
}
