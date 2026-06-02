'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MatchScore } from '@/lib/standings';
import { TOTAL_GROUP_MATCHES, groupMatches } from '@/lib/tournament';

const MAX_GROUP_JOKERS = 3;
const MAX_KNOCKOUT_JOKERS = 2;

interface ExtraPrediction {
  topScorer: string;
  belgianTopScorer: string;
  worldChampion: string;
  topScorerGoals: number;
  topScorerFirstGoalMin: number;
}

export interface PredictionsState {
  scores: Map<number, MatchScore>;
  jokers: Set<number>;
  jokersRemaining: number;
  extra: ExtraPrediction;
  loaded: boolean;
  saving: boolean;
  lockedMatches: Set<number>;
  setScore: (matchNumber: number, homeScore: number, awayScore: number, advancingTeam?: string) => void;
  toggleJoker: (matchNumber: number) => void;
  setExtra: (extra: Partial<ExtraPrediction>) => void;
  save: () => Promise<void>;
  getScoresArray: () => MatchScore[];
  groupHasJoker: (group: string) => boolean;
  duplicateJokerGroups: string[];
}

export function usePredictions(): PredictionsState {
  const [scores, setScores] = useState<Map<number, MatchScore>>(new Map());
  const [jokers, setJokers] = useState<Set<number>>(new Set());
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
          const jokerSet = new Set<number>();
          for (const p of data.predictions) {
            map.set(p.matchNumber, {
              matchNumber: p.matchNumber,
              homeScore: p.homeScore,
              awayScore: p.awayScore,
              advancingTeam: p.advancingTeam || undefined,
            });
            if (p.jokerUsed) jokerSet.add(p.matchNumber);
          }
          setScores(map);
          setJokers(jokerSet);
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
      const predictions = Array.from(scores.values()).map(p => ({
        ...p,
        jokerUsed: jokers.has(p.matchNumber),
      }));
      await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions, extra }),
      });
    } finally {
      setSaving(false);
    }
  }, [scores, jokers, extra]);

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

  const matchGroupMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of groupMatches) map.set(m.matchNumber, m.group);
    return map;
  }, []);

  const toggleJoker = useCallback((matchNumber: number) => {
    const isGroup = matchNumber <= TOTAL_GROUP_MATCHES;
    const maxJokers = isGroup ? MAX_GROUP_JOKERS : MAX_KNOCKOUT_JOKERS;
    setJokers(prev => {
      const next = new Set(prev);
      if (next.has(matchNumber)) {
        next.delete(matchNumber);
      } else {
        const used = [...next].filter(m => !lockedMatches.has(m) && (isGroup ? m <= TOTAL_GROUP_MATCHES : m > TOTAL_GROUP_MATCHES));
        if (used.length >= maxJokers) return prev;
        if (isGroup) {
          const group = matchGroupMap.get(matchNumber);
          const groupHasJoker = [...next].some(m => m !== matchNumber && matchGroupMap.get(m) === group);
          if (groupHasJoker) return prev;
        }
        next.add(matchNumber);
      }
      return next;
    });
    debouncedSave();
  }, [debouncedSave, lockedMatches, matchGroupMap]);

  const setExtra = useCallback((partial: Partial<ExtraPrediction>) => {
    setExtraState(prev => ({ ...prev, ...partial }));
    debouncedSave();
  }, [debouncedSave]);

  const getScoresArray = useCallback(() => Array.from(scores.values()), [scores]);

  const jokersRemaining = MAX_GROUP_JOKERS - [...jokers].filter(m => m <= TOTAL_GROUP_MATCHES).length;

  const groupHasJoker = useCallback((group: string) => {
    return [...jokers].some(m => matchGroupMap.get(m) === group);
  }, [jokers, matchGroupMap]);

  const duplicateJokerGroups = useMemo(() => {
    const groupCount = new Map<string, number>();
    for (const m of jokers) {
      const g = matchGroupMap.get(m);
      if (g) groupCount.set(g, (groupCount.get(g) || 0) + 1);
    }
    return [...groupCount.entries()].filter(([, c]) => c > 1).map(([g]) => g);
  }, [jokers, matchGroupMap]);

  return { scores, jokers, jokersRemaining, extra, loaded, saving, lockedMatches, setScore, toggleJoker, setExtra, save, getScoresArray, groupHasJoker, duplicateJokerGroups };
}
