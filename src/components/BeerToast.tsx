'use client';

import { useState, useEffect } from 'react';

const roasts = [
  'Drinken, kansen zijn niet meegezeten hè 🍺',
  'Trekt em, ge waart laatste 🍺',
  'Grote L voor u vandaag 🍺',
  'Alee, nen tansen dansen aan de toog 🍺',
  'Proficiat! Ge zijt officieel de slechtste 🍺',
  'Da pintje gaat nie drinken zichzelf hè 🍺',
  'Wa nen drama, pintje verdiend 🍺',
  'Beschamend. Ge drinkt. 🍺',
  'Zelfs mijn oma voorspelt beter. Drinken. 🍺',
  'Pint besteld, uw naam staat erop 🍺',
  'F in de chat, pint in de hand 🍺',
  'Ge moogt u schamen. En drinken. 🍺',
];

interface Props {
  currentBeerCount: number;
}

export default function BeerToast({ currentBeerCount }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [newBeers, setNewBeers] = useState(0);

  useEffect(() => {
    const forceTest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('bier');

    const stored = localStorage.getItem('lastBeerCount');
    const lastCount = stored ? parseInt(stored, 10) : 0;

    if (forceTest) {
      setNewBeers(1);
      setMessage(roasts[Math.floor(Math.random() * roasts.length)]);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }

    if (currentBeerCount > lastCount) {
      setNewBeers(currentBeerCount - lastCount);
      setMessage(roasts[Math.floor(Math.random() * roasts.length)]);
      setVisible(true);
      localStorage.setItem('lastBeerCount', String(currentBeerCount));
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }

    localStorage.setItem('lastBeerCount', String(currentBeerCount));
  }, [currentBeerCount]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in">
      <div className="bg-amber-900/95 border border-amber-500/50 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-sm max-w-md text-center">
        <div className="text-2xl mb-1">🍺{newBeers > 1 ? ` x${newBeers}` : ''}</div>
        <div className="text-amber-100 font-bold text-lg">{message}</div>
      </div>
    </div>
  );
}
