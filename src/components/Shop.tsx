'use client';

import { useCallback, useEffect, useState } from 'react';
import { COSMETICS, Cosmetic, CosmeticCategory, getCosmeticsByCategory } from '@/lib/cosmetics';

interface Props {
  userName: string;
}

interface ShopData {
  balance: number;
  owned: string[];
  equipped: { nameColor: string | null; rowStyle: string | null; title: string | null };
}

interface CoinsData {
  balance: number;
  canClaimDaily: boolean;
  dailyAmount: number;
  keepyUppyToday: { dayBest: number };
}

const CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  name_color: 'Naam Kleuren',
  row_style: 'Rij Stijlen',
  title: 'Titels',
};

const CATEGORY_ORDER: CosmeticCategory[] = ['name_color', 'row_style', 'title'];

function CosmeticPreview({ cosmetic, userName }: { cosmetic: Cosmetic; userName: string }) {
  if (cosmetic.category === 'name_color') {
    return (
      <div className="text-lg font-bold py-2">
        <span className={cosmetic.nameClassName}>{userName}</span>
      </div>
    );
  }
  if (cosmetic.category === 'row_style') {
    return (
      <div className={`card flex items-center gap-3 px-3 py-2 ${cosmetic.rowClassName}`}>
        <span className="text-gray-500 font-bold">1.</span>
        <span className="text-white font-semibold flex-1">{userName}</span>
        <span className="text-gold font-bold">42</span>
      </div>
    );
  }
  if (cosmetic.category === 'title') {
    return (
      <div className="py-2">
        <div className="cos-title text-center">{cosmetic.title}</div>
        <div className="text-white font-bold text-center">{userName}</div>
      </div>
    );
  }
  return null;
}

export default function Shop({ userName }: Props) {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [coins, setCoins] = useState<CoinsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);

  const refresh = useCallback(async () => {
    const [shopRes, coinsRes] = await Promise.all([
      fetch('/api/shop').then(r => r.json()),
      fetch('/api/coins').then(r => r.json()),
    ]);
    setShop(shopRes);
    setCoins(coinsRes);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClaimDaily = useCallback(async () => {
    setBusyId('daily');
    try {
      const res = await fetch('/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claimDaily' }),
      });
      const data = await res.json();
      if (data.claimed) {
        setToast({ msg: `+${data.amount} 🪙 dagelijkse bonus!`, kind: 'success' });
        await refresh();
      } else {
        setToast({ msg: 'Vandaag al geclaimd', kind: 'error' });
      }
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const handleBuy = useCallback(async (cosmetic: Cosmetic) => {
    setBusyId(cosmetic.id);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosmeticId: cosmetic.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ msg: `${cosmetic.name} gekocht!`, kind: 'success' });
        await refresh();
      } else {
        setToast({ msg: data.error || 'Aankoop mislukt', kind: 'error' });
      }
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const handleEquip = useCallback(async (cosmetic: Cosmetic) => {
    setBusyId(cosmetic.id);
    try {
      const isEquipped = shop?.equipped[
        cosmetic.category === 'name_color' ? 'nameColor'
        : cosmetic.category === 'row_style' ? 'rowStyle'
        : 'title'
      ] === cosmetic.id;
      const body = isEquipped
        ? { cosmeticId: null, category: cosmetic.category }
        : { cosmeticId: cosmetic.id };
      const res = await fetch('/api/cosmetics/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setToast({ msg: isEquipped ? 'Uitgedaan' : `${cosmetic.name} aan!`, kind: 'success' });
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }, [refresh, shop]);

  if (loading || !shop || !coins) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p>Shop laden...</p>
      </div>
    );
  }

  const equippedField = (cat: CosmeticCategory) =>
    cat === 'name_color' ? shop.equipped.nameColor
    : cat === 'row_style' ? shop.equipped.rowStyle
    : shop.equipped.title;

  return (
    <div className="space-y-6 pb-8">
      {/* Balance + daily */}
      <div className="card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-gray-400">Jouw saldo</div>
          <div className="text-3xl font-bold text-gold flex items-center gap-2">
            🪙 {shop.balance.toLocaleString('nl-BE')}
          </div>
        </div>
        {coins.canClaimDaily ? (
          <button
            onClick={handleClaimDaily}
            disabled={busyId === 'daily'}
            className="px-5 py-3 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            🎁 Claim {coins.dailyAmount} 🪙 dagbonus
          </button>
        ) : (
          <div className="text-xs text-gray-500">Vandaag al geclaimd ✓</div>
        )}
      </div>

      {/* How to earn */}
      <div className="card bg-white/5 text-sm text-gray-300">
        <div className="font-bold mb-2 text-white">Coins verdienen</div>
        <ul className="space-y-1.5 text-xs">
          <li>
            ⚽ <span className="text-gold font-bold">Keepie-Uppie:</span> alleen je <span className="text-white">hoogste score van vandaag</span> telt
            {coins.keepyUppyToday.dayBest > 0 ? (
              <span className="block ml-5 text-gray-400 mt-0.5">
                Vandaag: <span className="text-gold font-bold">{coins.keepyUppyToday.dayBest}</span> coins · volgende coin bij score &gt; {coins.keepyUppyToday.dayBest}
              </span>
            ) : (
              <span className="block ml-5 text-gray-500 mt-0.5">Speel een ronde om vandaag coins te verdienen!</span>
            )}
          </li>
          <li>🎯 <span className="text-gold font-bold">3 coins</span> per voorspellingspunt</li>
          <li>🎁 <span className="text-gold font-bold">{coins.dailyAmount} coins</span> per dag (claim hierboven)</li>
        </ul>
      </div>

      {/* Categories */}
      {CATEGORY_ORDER.map(cat => {
        const items = getCosmeticsByCategory(cat);
        const equipped = equippedField(cat);
        return (
          <div key={cat}>
            <h3 className="text-lg font-bold text-white mb-2">{CATEGORY_LABELS[cat]}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map(cosmetic => {
                const owned = shop.owned.includes(cosmetic.id);
                const isEquipped = equipped === cosmetic.id;
                const canAfford = shop.balance >= cosmetic.price;
                const busy = busyId === cosmetic.id;
                return (
                  <div
                    key={cosmetic.id}
                    className={`card flex flex-col gap-2 ${isEquipped ? 'border-gold/50 bg-gold/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{cosmetic.name}</div>
                        <div className="text-xs text-gray-500">{cosmetic.description}</div>
                      </div>
                      {!owned && (
                        <div className="text-gold font-bold whitespace-nowrap">
                          🪙 {cosmetic.price}
                        </div>
                      )}
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 my-1">
                      <CosmeticPreview cosmetic={cosmetic} userName={userName} />
                    </div>
                    {owned ? (
                      <button
                        onClick={() => handleEquip(cosmetic)}
                        disabled={busy}
                        className={`px-3 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${
                          isEquipped
                            ? 'bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30'
                            : 'bg-green-600/80 hover:bg-green-500 text-white'
                        }`}
                      >
                        {isEquipped ? '✓ Aan (klik om uit te doen)' : 'Aandoen'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(cosmetic)}
                        disabled={!canAfford || busy}
                        className="px-3 py-2 rounded-lg font-bold text-sm bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white shadow active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {canAfford ? 'Kopen' : `Nog ${cosmetic.price - shop.balance} 🪙 nodig`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-2xl z-50 ${
            toast.kind === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
