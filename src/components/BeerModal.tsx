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

interface BeerGiftData {
  id: string;
  giverId: string;
  receiverId: string;
  reason: string;
  giver: { id: string; name: string };
  receiver: { id: string; name: string };
}

interface Props {
  userId: string;
  userName: string;
  currentUserId: string;
  reasons: string[];
  giveReasons?: string[];
  allUsers?: { id: string; name: string }[];
  onClose: () => void;
}

export default function BeerModal({ userId, userName, currentUserId, reasons, giveReasons = [], allUsers = [], onClose }: Props) {
  const [confirmations, setConfirmations] = useState<BeerConfirmation[]>([]);
  const [gifts, setGifts] = useState<BeerGiftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingFor, setSelectingFor] = useState<string | null>(null);
  const isMe = userId === currentUserId;

  const loadData = useCallback(() => {
    fetch('/api/beers')
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        setConfirmations((data.confirmations || []).filter((c: BeerConfirmation) => c.drinkerId === userId));
        setGifts(data.gifts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleClaim(reason: string) {
    await fetch('/api/beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', drinkerId: userId, reason }),
    });
    loadData();
  }

  async function handleWitness(confirmationId: string) {
    await fetch('/api/beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'witness', confirmationId }),
    });
    loadData();
  }

  async function handleGive(reason: string, receiverId: string) {
    await fetch('/api/beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'give', reason, receiverId }),
    });
    setSelectingFor(null);
    loadData();
  }

  function getStatus(reason: string) {
    return confirmations.find(c => c.reason === reason);
  }

  function getGift(reason: string) {
    return gifts.find(g => g.giverId === userId && g.reason === reason);
  }

  const otherUsers = allUsers.filter(u => u.id !== currentUserId);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-amber-600/40 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-amber-300">
            🍺 {isMe ? 'Jouw' : `${userName}'s`} pintjes ({Math.max(0, reasons.length - confirmations.filter(c => c.witnessedAt).length)} / {reasons.length})
          </h3>
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

        {giveReasons.length > 0 && (
          <>
            <div className="border-t border-white/10 my-4" />
            <h4 className="text-lg font-bold text-emerald-300 mb-3">🎁 Uit te delen ({giveReasons.length})</h4>
            <div className="space-y-2">
              {giveReasons.map((reason, i) => {
                const gift = getGift(reason);

                if (gift) {
                  return (
                    <div key={i} className="rounded-lg border bg-emerald-900/20 border-emerald-700/40 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🎁</span>
                        <span className="text-emerald-100 text-sm flex-1">{reason}</span>
                      </div>
                      <div className="text-emerald-400 text-xs">
                        Toegewezen aan <span className="font-bold">{gift.receiver.name}</span>
                      </div>
                    </div>
                  );
                }

                if (selectingFor === reason) {
                  return (
                    <div key={i} className="rounded-lg border bg-emerald-900/30 border-emerald-500/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🎁</span>
                        <span className="text-emerald-100 text-sm flex-1">{reason}</span>
                      </div>
                      <p className="text-emerald-300 text-xs mb-2">Kies wie moet drinken:</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {otherUsers.map(u => (
                          <button
                            key={u.id}
                            onClick={() => handleGive(reason, u.id)}
                            className="text-xs bg-emerald-800/50 hover:bg-emerald-700/60 text-emerald-200 px-2 py-1.5 rounded-lg border border-emerald-600/30"
                          >
                            {u.name}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setSelectingFor(null)}
                        className="text-xs text-gray-500 hover:text-gray-300 mt-2 w-full"
                      >
                        Annuleer
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={i} className="rounded-lg border bg-emerald-900/20 border-emerald-700/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎁</span>
                      <span className="text-emerald-100 text-sm flex-1">{reason}</span>
                    </div>
                    {isMe ? (
                      <button
                        onClick={() => setSelectingFor(reason)}
                        className="text-xs bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-600/40 mt-2"
                      >
                        Iemand aanwijzen
                      </button>
                    ) : (
                      <div className="text-gray-500 text-xs mt-1">Nog niet toegewezen</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
