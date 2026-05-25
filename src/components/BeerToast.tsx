'use client';

import { useState, useEffect, useRef } from 'react';

const roasts = [
  'Drinken, kansen zijn niet meegezeten hè',
  'Trekt em',
  'L',
  "Drinken kut",
  'Proficiat! Je mag drinken vandaag',
  'Ga na de frigo good boy',
  'Wa nen drama, pintje verdiend',
  'Beschamend. Drink.',
  'Zelfs mijn oma voorspelt beter. Drinken.',
  'Pint besteld, uw naam staat erop',
  'Santé',
  'Ge moogt u schamen. En drinken.',
];

interface Props {
  currentBeerCount: number;
  reasons: string[];
}

export default function BeerToast({ currentBeerCount, reasons }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [newReasons, setNewReasons] = useState<string[]>([]);
  const shownFor = useRef<number | null>(null);

  useEffect(() => {
    const forceTest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bier');

    if (forceTest && shownFor.current !== -1) {
      shownFor.current = -1;
      setNewReasons(['Laatste op 15 jun (0pt)']);
      setMessage(roasts[Math.floor(Math.random() * roasts.length)]);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }

    const stored = localStorage.getItem('lastBeerCount');
    const lastCount = stored ? parseInt(stored, 10) : 0;

    if (currentBeerCount > lastCount && shownFor.current !== currentBeerCount) {
      shownFor.current = currentBeerCount;
      setNewReasons(reasons.slice(lastCount));
      setMessage(roasts[Math.floor(Math.random() * roasts.length)]);
      setVisible(true);
      localStorage.setItem('lastBeerCount', String(currentBeerCount));
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }

    localStorage.setItem('lastBeerCount', String(currentBeerCount));
  }, [currentBeerCount, reasons]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in">
      <div className="bg-amber-900/95 border border-amber-500/50 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-sm max-w-md text-center">
        <div className="text-2xl mb-1">🍺{newReasons.length > 1 ? ` x${newReasons.length}` : ''}</div>
        <div className="text-amber-100 font-bold text-lg">{message}</div>
        <div className="mt-2 text-amber-300/80 text-sm">
          {newReasons[newReasons.length - 1]}
          {newReasons.length > 1 && (
            <div className="mt-0.5">+ {newReasons.length - 1} andere pintje{newReasons.length > 2 ? 's' : ''}</div>
          )}
        </div>
      </div>
    </div>
  );
}
