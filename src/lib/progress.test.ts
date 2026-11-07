import { describe, expect, it } from 'vitest';
import {
  type Progress,
  type RecordArgs,
  type Result,
  START_RATING,
  currentDailyStreak,
  exportFile,
  isUnlocked,
  migrateFromNextIndexes,
  newProgress,
  parseProgress,
  pickPuzzle,
  ratingChange,
  recordResult,
  unlockNeeds,
} from './progress';

const DAY1 = new Date(2026, 10, 7, 12, 0);
const DAY2 = new Date(2026, 10, 8, 9, 0);
const DAY4 = new Date(2026, 10, 10, 9, 0);

function play(p: Progress, result: Result, over: Partial<RecordArgs> = {}): Progress {
  return recordResult(p, {
    levelId: 1,
    puzzleId: `p${p.attempts}`,
    puzzleRating: 800,
    result,
    ms: 5000,
    now: DAY1,
    index: p.levels[1].next,
    total: 300,
    ...over,
  }).progress;
}

describe('rating', () => {
  it('wins half the K-factor against an equal puzzle, loses the same', () => {
    expect(ratingChange(800, 800, 'clean', 0)).toBe(20);
    expect(ratingChange(800, 800, 'failed', 0)).toBe(-20);
    expect(ratingChange(800, 800, 'assisted', 0)).toBe(-20);
  });

  it('gains more for beating a harder puzzle, and settles down after 30 games', () => {
    expect(ratingChange(800, 1200, 'clean', 0)).toBeGreaterThan(30);
    expect(ratingChange(800, 400, 'clean', 0)).toBeLessThan(5);
    expect(ratingChange(800, 800, 'clean', 50)).toBe(10);
  });

  it('records the change and the history', () => {
    const r = recordResult(newProgress(), {
      levelId: 1, puzzleId: 'a', puzzleRating: 800, result: 'clean', ms: 1, now: DAY1, index: 0, total: 300,
    });
    expect(r.delta).toBe(20);
    expect(r.progress.rating).toBe(START_RATING + 20);
    expect(r.progress.history).toHaveLength(1);
    expect(r.progress.history[0].rating).toBe(START_RATING + 20);
  });
});

describe('level stats and streaks', () => {
  it('counts results and advances to the next new puzzle', () => {
    let p = play(newProgress(), 'clean');
    p = play(p, 'assisted');
    p = play(p, 'failed');
    expect(p.levels[1]).toMatchObject({ attempts: 3, clean: 1, assisted: 1, failed: 1, next: 3 });
  });

  it('a review attempt does not move the new-puzzle pointer', () => {
    const p = play(newProgress(), 'clean', { index: null });
    expect(p.levels[1].next).toBe(0);
  });

  it('tracks the clean-solve streak and best streak', () => {
    let p = play(play(play(newProgress(), 'clean'), 'clean'), 'clean');
    expect(p.streak).toBe(3);
    p = play(p, 'assisted');
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(3);
  });

  it('tracks days in a row', () => {
    let p = play(newProgress(), 'clean', { now: DAY1 });
    p = play(p, 'clean', { now: DAY1 });
    expect(p.daily.count).toBe(1);
    p = play(p, 'clean', { now: DAY2 });
    expect(p.daily.count).toBe(2);
    expect(currentDailyStreak(p, DAY2)).toBe(2);
    expect(currentDailyStreak(p, DAY4)).toBe(0); // missed a day
    p = play(p, 'clean', { now: DAY4 });
    expect(p.daily).toMatchObject({ count: 1, best: 2 });
  });
});

describe('unlocking', () => {
  it('starts with only Easy open', () => {
    const p = newProgress();
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    expect(unlockNeeds(p, 2)).toEqual({ clean: 10, recentClean: 7 });
  });

  it('opens the next level after 10 clean solves with 7 of the last 10 clean', () => {
    let p = newProgress();
    for (let i = 0; i < 9; i++) p = play(p, 'clean');
    expect(isUnlocked(p, 2)).toBe(false);
    p = play(p, 'clean');
    expect(isUnlocked(p, 2)).toBe(true);
    expect(isUnlocked(p, 3)).toBe(false);
    // Sticky: a bad run afterwards doesn't lock it again.
    for (let i = 0; i < 10; i++) p = play(p, 'failed');
    expect(isUnlocked(p, 2)).toBe(true);
  });

  it('needs recent form too, not just a total', () => {
    let p = newProgress();
    // 4 clean, 6 failed, 6 clean: 10 clean in total, but only 6 of the last 10.
    for (const r of ['clean', 'clean', 'clean', 'clean'] as Result[]) p = play(p, r);
    for (let i = 0; i < 6; i++) p = play(p, 'failed');
    for (let i = 0; i < 6; i++) p = play(p, 'clean');
    expect(p.levels[1].clean).toBe(10);
    expect(isUnlocked(p, 2)).toBe(false);
    expect(unlockNeeds(p, 2)).toEqual({ clean: 0, recentClean: 1 });
    p = play(p, 'clean'); // now 7 of the last 10
    expect(isUnlocked(p, 2)).toBe(true);
  });

  it('unlock-all opens everything', () => {
    expect(isUnlocked({ ...newProgress(), unlockAll: true }, 6)).toBe(true);
  });
});

describe('review queue', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);

  it('brings a missed puzzle back after 5 more attempts, then serves new ones again', () => {
    let p = play(newProgress(), 'failed', { puzzleId: 'p0', index: 0 });
    for (let i = 1; i <= 4; i++) {
      expect(pickPuzzle(p, 1, ids)).toEqual({ index: i, review: false });
      p = play(p, 'clean', { puzzleId: `p${i}`, index: i });
    }
    // 5 attempts made since the miss -> it's due
    expect(pickPuzzle(p, 1, ids)).toEqual({ index: 5, review: false });
    p = play(p, 'clean', { puzzleId: 'p5', index: 5 });
    expect(pickPuzzle(p, 1, ids)).toEqual({ index: 0, review: true });
    p = play(p, 'clean', { puzzleId: 'p0', index: null });
    expect(p.review).toEqual([]);
    expect(pickPuzzle(p, 1, ids)).toEqual({ index: 6, review: false });
  });

  it('missing a review puzzle again pushes it back', () => {
    let p = play(newProgress(), 'failed', { puzzleId: 'p0', index: 0 });
    p = play(p, 'assisted', { puzzleId: 'p0', index: null });
    expect(p.review).toEqual([{ puzzleId: 'p0', levelId: 1, dueAt: 7 }]);
  });
});

describe('migration', () => {
  it('keeps old positions and opens every level up to the highest played', () => {
    const p = migrateFromNextIndexes({ 1: 5, 3: 2, 4: 0 });
    expect(p.levels[1].next).toBe(5);
    expect(p.levels[3]).toMatchObject({ next: 2, unlocked: true });
    expect(isUnlocked(p, 2)).toBe(true); // below a played level
    expect(isUnlocked(p, 3)).toBe(true);
    expect(isUnlocked(p, 4)).toBe(false);
  });

  it('a brand-new player starts with only Easy', () => {
    const p = migrateFromNextIndexes({ 1: 0, 2: 0 });
    expect(isUnlocked(p, 2)).toBe(false);
  });
});

describe('save and load progress', () => {
  it('round-trips through the saved file', () => {
    let p = newProgress();
    for (let i = 0; i < 3; i++) p = play(p, 'clean');
    const file = exportFile(p, DAY1);
    expect(file.name).toBe('chess-mates-progress-2026-11-07.json');
    expect(parseProgress(JSON.parse(file.json))).toEqual(p);
  });

  it('also accepts the bare progress object', () => {
    const p = play(newProgress(), 'failed');
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('rejects files that are not chess-mates progress', () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress('hello')).toBeNull();
    expect(parseProgress({ version: 2, rating: 900, levels: {} })).toBeNull();
    expect(parseProgress({ app: 'chess-mates', progress: { version: 1 } })).toBeNull();
    expect(parseProgress({ name: 'my shopping list' })).toBeNull();
  });

  it('fills in levels missing from an older or partial save', () => {
    const partial = { ...newProgress(), levels: { 1: newProgress().levels[1] } };
    const p = parseProgress(JSON.parse(JSON.stringify(partial)));
    expect(Object.keys(p!.levels)).toHaveLength(6);
    expect(p!.levels[6]).toMatchObject({ attempts: 0, unlocked: false });
  });
});
