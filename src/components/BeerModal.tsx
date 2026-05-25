'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface BeerConfirmation {
  id: string;
  drinkerId: string;
  reason: string;
  claimedAt: string | null;
  witnessId: string | null;
  witnessedAt: string | null;
  drinker: { id: string; name: string };
  witness: { id: string; name: string } | null;
}

interface Props {
  userId: string;
  userName: string;
  currentUserId: string;
  reasons: string[];
  onClose: () => void;
}

export default function BeerModal({ userId, userName, currentUserId, reasons, onClose }: Props) {
  const [confirmations, setConfirmations] = useState<BeerConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const isMe = userId === currentUserId;

  const loadConfirmations = useCallback(() => {
    fetch('/api/beers')
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        setConfirmations((data.confirmations || []).filter((c: BeerConfirmation) => c.drinkerId === userId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadConfirmations(); }, [loadConfirmations]);

  async function handleClaim(reason: string) {
    await fetch('/api/beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', drinkerId: userId, reason }),
    });
    loadConfirmations();
  }

  async function handleWitness(confirmationId: string) {
    await fetch('/api/beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'witness', confirmationId }),
    });
    loadConfirmations();
  }

  function getStatus(reason: string) {
    return confirmations.find(c => c.reason === reason);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-amber-600/40 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-amber-300">🍺 {isMe ? 'Jouw' : `${userName}'s`} pintjes ({reasons.length})</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>

        {reasons.length === 0 ? (
          <div className="text-gray-500 text-center py-4">Staat nog droog...</div>
        ) : loading ? (
          <div className="text-gray-500 text-center py-4">Laden...</div>
        ) : (
          <div className="space-y-3">
            {reasons.map((reason, i) => {
              const conf = getStatus(reason);
              const claimed = !!conf?.claimedAt;
              const witnessed = !!conf?.witnessedAt;

              return (
                <div key={i} className={`rounded-lg border p-3 ${
                  witnessed ? 'bg-green-900/30 border-green-700/40' :
                  claimed ? 'bg-amber-900/30 border-amber-600/40' :
                  'bg-gray-800/50 border-gray-700/40'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{witnessed ? '✅' : '🍺'}</span>
                    <span className="text-amber-100 text-sm flex-1">{reason}</span>
                  </div>

                  {witnessed ? (
                    <div className="text-green-400 text-xs">
                      Gedronken — bevestigd door {conf!.witness!.name}
                    </div>
                  ) : claimed ? (
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 text-xs">Geclaimed, wacht op getuige...</span>
                      {!isMe && (
                        <button
                          onClick={() => handleWitness(conf!.id)}
                          className="text-xs bg-green-800/60 hover:bg-green-700/60 text-green-300 px-3 py-1 rounded-lg border border-green-600/40"
                        >
                          Bevestigen
                        </button>
                      )}
                    </div>
                  ) : isMe ? (
                    <button
                      onClick={() => handleClaim(reason)}
                      className="text-xs bg-amber-800/60 hover:bg-amber-700/60 text-amber-300 px-3 py-1 rounded-lg border border-amber-600/40"
                    >
                      Ik heb gedronken
                    </button>
                  ) : (
                    <div className="text-gray-500 text-xs">Nog niet gedronken</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
