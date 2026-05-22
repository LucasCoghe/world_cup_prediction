'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MatchScore } from '@/lib/standings';

interface ExtraPrediction {
  topScorer: string;
  belgianTopScorer: string;
  worldChampion: string;
  topScorerGoals: number;
  topScorerFirstGoalMin: number;
}

export interface PredictionsState {
  scores: Map<number, MatchScore>;
  extra: ExtraPrediction;
  loaded: boolean;
  saving: boolean;
  lockedMatches: Set<number>;
  setScore: (matchNumber: number, homeScore: number, awayScore: number, advancingTeam?: string) => void;
  setExtra: (extra: Partial<ExtraPrediction>) => void;
  save: () => Promise<void>;
  getScoresArray: () => MatchScore[];
}

export function usePredictions(): PredictionsState {
  const [scores, setScores] = useState<Map<number, MatchScore>>(new Map());
  const [extra, setExtraState] = useState<ExtraPrediction>({
    topScorer: '',
    belgianTopScorer: '',
    worldChampion: '',
    topScorerGoals: 0,
    topScorerFirstGoalMin: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lockedMatches, setLockedMatches] = useState<Set<number>>(new Set());
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch locked matches
  useEffect(() => {
    fetch('/api/matches/locked')
      .then(r => r.json())
      .then(data => setLockedMatches(new Set(data.locked || [])));
    // Refresh locked matches every 60s
    const interval = setInterval(() => {
      fetch('/api/matches/locked')
        .then(r => r.json())
        .then(data => setLockedMatches(new Set(data.locked || [])));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/predictions')
      .then(r => r.json())
      .then(data => {
        if (data.predictions) {
          const map = new Map<number, MatchScore>();
          for (const p of data.predictions) {
            map.set(p.matchNumber, {
              matchNumber: p.matchNumber,
              homeScore: p.homeScore,
              awayScore: p.awayScore,
              advancingTeam: p.advancingTeam || undefined,
            });
          }
          setScores(map);
        }
        if (data.extra) {
          setExtraState({
            topScorer: data.extra.topScorer || '',
            belgianTopScorer: data.extra.belgianTopScorer || '',
            worldChampion: data.extra.worldChampion || '',
            topScorerGoals: data.extra.topScorerGoals || 0,
            topScorerFirstGoalMin: data.extra.topScorerFirstGoalMin || 0,
          });
        }
        setLoaded(true);
      });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const predictions = Array.from(scores.values());
      await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions, extra }),
      });
    } finally {
      setSaving(false);
    }
  }, [scores, extra]);

  // Auto-save with debounce
  const debouncedSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      save();
    }, 2000);
  }, [save]);

  const setScore = useCallback((matchNumber: number, homeScore: number, awayScore: number, advancingTeam?: string) => {
    setScores(prev => {
      const next = new Map(prev);
      next.set(matchNumber, { matchNumber, homeScore, awayScore, advancingTeam });
      return next;
    });
    debouncedSave();
  }, [debouncedSave]);

  const setExtra = useCallback((partial: Partial<ExtraPrediction>) => {
    setExtraState(prev => ({ ...prev, ...partial }));
    debouncedSave();
  }, [debouncedSave]);

  const getScoresArray = useCallback(() => Array.from(scores.values()), [scores]);

  return { scores, extra, loaded, saving, lockedMatches, setScore, setExtra, save, getScoresArray };
}
