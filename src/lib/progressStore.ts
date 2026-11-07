import { useSyncExternalStore } from 'react';
import { LEVELS } from './levels';
import { type Progress, migrateFromNextIndexes, parseProgress } from './progress';
import { loadNumber } from './storage';

/**
 * Keeps Progress in memory and in localStorage, and lets React components
 * subscribe to it (useSyncExternalStore re-renders them on every change).
 */
const KEY = 'chess-mates:progress';

let current: Progress = load();
const listeners = new Set<() => void>();

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Same checks as loading a saved file: fills in anything missing.
      const parsed = parseProgress(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    // unreadable or blocked storage: start fresh below
  }
  // First visit since milestone 4: carry over the old per-level positions.
  return migrateFromNextIndexes(Object.fromEntries(LEVELS.map((l) => [l.id, loadNumber(`level-${l.id}:next`, 0)])));
}

export function getProgress(): Progress {
  return current;
}

export function updateProgress(change: (p: Progress) => Progress): void {
  current = change(current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // not saved; still works for this visit
  }
  listeners.forEach((l) => l());
}

/** Replace everything (loading a saved file, or starting over). */
export function replaceProgress(next: Progress): void {
  updateProgress(() => next);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress);
}
