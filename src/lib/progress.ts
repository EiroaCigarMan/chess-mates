/**
 * Player progress: rating, per-level stats, streaks, unlocks and the review
 * queue. Pure functions only (no storage, no React), so they're easy to test;
 * progressStore.ts saves the result in localStorage.
 */
import { LEVELS } from './levels';

/** How a puzzle visit ended. */
export type Result =
  | 'clean' // solved with no hint and no wrong move
  | 'assisted' // solved, but after a hint or a wrong move
  | 'failed'; // solution shown, or left after a wrong move

// ---- Tunable rules (one place to change them) ------------------------------
export const START_RATING = 800;
/** Unlocking level N+1: this many clean solves on level N ... */
export const UNLOCK_CLEAN_SOLVES = 10;
/** ... and at least this many clean among the last RECENT_WINDOW attempts. */
export const UNLOCK_RECENT_CLEAN = 7;
export const RECENT_WINDOW = 10;
/** A missed puzzle comes back after this many more attempts on its level. */
export const REVIEW_AFTER = 5;
const HISTORY_CAP = 500;

export interface LevelStats {
  attempts: number;
  clean: number;
  assisted: number;
  failed: number;
  /** Last RECENT_WINDOW results, oldest first. */
  recent: Result[];
  /** Index of the next new puzzle to serve in this level's file. */
  next: number;
  /** Sticky: once unlocked, a level stays unlocked. */
  unlocked: boolean;
}

export interface HistoryEntry {
  puzzleId: string;
  levelId: number;
  puzzleRating: number;
  result: Result;
  ms: number;
  at: string; // ISO timestamp
  /** Player rating after this attempt (for the rating chart). */
  rating: number;
}

export interface ReviewItem {
  puzzleId: string;
  levelId: number;
  /** Due once the level's attempt count reaches this. */
  dueAt: number;
}

export interface Progress {
  version: 1;
  rating: number;
  attempts: number;
  streak: number;
  bestStreak: number;
  daily: { count: number; best: number; lastDay: string | null };
  levels: Record<number, LevelStats>;
  history: HistoryEntry[];
  review: ReviewItem[];
  unlockAll: boolean;
}

const emptyLevel = (unlocked: boolean): LevelStats => ({
  attempts: 0,
  clean: 0,
  assisted: 0,
  failed: 0,
  recent: [],
  next: 0,
  unlocked,
});

export function newProgress(): Progress {
  return {
    version: 1,
    rating: START_RATING,
    attempts: 0,
    streak: 0,
    bestStreak: 0,
    daily: { count: 0, best: 0, lastDay: null },
    levels: Object.fromEntries(LEVELS.map((l) => [l.id, emptyLevel(l.id === 1)])),
    history: [],
    review: [],
    unlockAll: false,
  };
}

/**
 * Before milestone 4 the app only saved "next puzzle" per level. Carry that
 * over, and keep open every level up to the highest one already played.
 */
export function migrateFromNextIndexes(nextByLevel: Record<number, number>): Progress {
  const p = newProgress();
  let highestPlayed = 1;
  for (const [id, next] of Object.entries(nextByLevel)) {
    const level = p.levels[Number(id)];
    if (level && next > 0) {
      level.next = next;
      highestPlayed = Math.max(highestPlayed, Number(id));
    }
  }
  for (const l of LEVELS) if (l.id <= highestPlayed) p.levels[l.id].unlocked = true;
  return p;
}

/**
 * Elo: the puzzle is the opponent. A clean solve is a win (1), anything else
 * a loss (0). New players move faster (bigger K) so the rating finds its level.
 */
export function ratingChange(playerRating: number, puzzleRating: number, result: Result, attempts: number): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400));
  const score = result === 'clean' ? 1 : 0;
  const k = attempts < 30 ? 40 : 20;
  return Math.round(k * (score - expected));
}

export interface RecordArgs {
  levelId: number;
  puzzleId: string;
  puzzleRating: number;
  result: Result;
  ms: number;
  now: Date;
  /** Position of this puzzle in the level file, or null when it was a review. */
  index: number | null;
  /** Number of puzzles in the level (to wrap `next`). */
  total: number;
}

export function recordResult(p: Progress, a: RecordArgs): { progress: Progress; delta: number } {
  const delta = ratingChange(p.rating, a.puzzleRating, a.result, p.attempts);
  const rating = Math.max(100, p.rating + delta);

  const old = p.levels[a.levelId] ?? emptyLevel(false);
  const level: LevelStats = {
    ...old,
    attempts: old.attempts + 1,
    clean: old.clean + (a.result === 'clean' ? 1 : 0),
    assisted: old.assisted + (a.result === 'assisted' ? 1 : 0),
    failed: old.failed + (a.result === 'failed' ? 1 : 0),
    recent: [...old.recent, a.result].slice(-RECENT_WINDOW),
    next: a.index === null ? old.next : (a.index + 1) % a.total,
  };
  const levels = { ...p.levels, [a.levelId]: level };

  // Unlock the next level when this one is mastered (sticky).
  const nextId = a.levelId + 1;
  if (levels[nextId] && !levels[nextId].unlocked && meetsUnlock(level)) {
    levels[nextId] = { ...levels[nextId], unlocked: true };
  }

  // Missed puzzles come back later; a clean solve clears them.
  const review = p.review.filter((r) => r.puzzleId !== a.puzzleId);
  if (a.result !== 'clean') {
    review.push({ puzzleId: a.puzzleId, levelId: a.levelId, dueAt: level.attempts + REVIEW_AFTER });
  }

  const streak = a.result === 'clean' ? p.streak + 1 : 0;

  const progress: Progress = {
    ...p,
    rating,
    attempts: p.attempts + 1,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    daily: updateDaily(p.daily, a.now),
    levels,
    review,
    history: [
      ...p.history,
      {
        puzzleId: a.puzzleId,
        levelId: a.levelId,
        puzzleRating: a.puzzleRating,
        result: a.result,
        ms: a.ms,
        at: a.now.toISOString(),
        rating,
      },
    ].slice(-HISTORY_CAP),
  };
  return { progress, delta: rating - p.rating };
}

export function meetsUnlock(level: LevelStats): boolean {
  return (
    level.clean >= UNLOCK_CLEAN_SOLVES &&
    level.recent.filter((r) => r === 'clean').length >= UNLOCK_RECENT_CLEAN
  );
}

export function isUnlocked(p: Progress, levelId: number): boolean {
  return levelId === 1 || p.unlockAll || Boolean(p.levels[levelId]?.unlocked);
}

/** What's still needed to unlock a level, measured on the level below it. */
export function unlockNeeds(p: Progress, levelId: number): { clean: number; recentClean: number } {
  const below = p.levels[levelId - 1] ?? emptyLevel(false);
  return {
    clean: Math.max(0, UNLOCK_CLEAN_SOLVES - below.clean),
    recentClean: Math.max(0, UNLOCK_RECENT_CLEAN - below.recent.filter((r) => r === 'clean').length),
  };
}

/** Which puzzle to show next: a due review first, otherwise the next new one. */
export function pickPuzzle(
  p: Progress,
  levelId: number,
  puzzleIds: string[],
): { index: number; review: boolean } {
  const level = p.levels[levelId] ?? emptyLevel(false);
  for (const item of p.review) {
    if (item.levelId !== levelId || item.dueAt > level.attempts) continue;
    const index = puzzleIds.indexOf(item.puzzleId);
    if (index !== -1) return { index, review: true };
  }
  return { index: level.next % puzzleIds.length, review: false };
}

/** Clean-solve rate as a whole percentage, or null with no attempts. */
export function accuracy(stats: Pick<LevelStats, 'attempts' | 'clean'>): number | null {
  return stats.attempts === 0 ? null : Math.round((100 * stats.clean) / stats.attempts);
}

/** Days in a row with at least one puzzle, in the player's local time. */
function updateDaily(daily: Progress['daily'], now: Date): Progress['daily'] {
  const today = localDay(now);
  if (daily.lastDay === today) return daily;
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const count = daily.lastDay === yesterday ? daily.count + 1 : 1;
  return { count, best: Math.max(daily.best, count), lastDay: today };
}

export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The daily streak only counts if you played today or yesterday. */
export function currentDailyStreak(p: Progress, now: Date): number {
  const { lastDay, count } = p.daily;
  if (!lastDay) return 0;
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return lastDay === localDay(now) || lastDay === yesterday ? count : 0;
}

/**
 * Reads a progress file the player saved earlier (Settings → Save progress).
 * Returns null if it isn't one of ours, so a wrong file can't break the app.
 */
export function parseProgress(data: unknown): Progress | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<Progress> & { app?: string };
  const p = d.app === 'chess-mates' && 'progress' in d ? (d as { progress: Partial<Progress> }).progress : d;
  if (!p || p.version !== 1 || typeof p.rating !== 'number' || !p.levels || typeof p.levels !== 'object') {
    return null;
  }
  if (!Array.isArray(p.history) || !Array.isArray(p.review)) return null;
  const base = newProgress();
  const levels = { ...base.levels };
  for (const l of LEVELS) {
    const saved = (p.levels as Record<number, Partial<LevelStats>>)[l.id];
    if (saved && typeof saved === 'object') levels[l.id] = { ...base.levels[l.id], ...saved };
  }
  return { ...base, ...p, levels } as Progress;
}

/** What Settings → Save progress writes: progress plus a little context. */
export function exportFile(p: Progress, now: Date): { name: string; json: string } {
  return {
    name: `chess-mates-progress-${localDay(now)}.json`,
    json: JSON.stringify({ app: 'chess-mates', savedAt: now.toISOString(), progress: p }, null, 2),
  };
}
