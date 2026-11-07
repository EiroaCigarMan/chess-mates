/**
 * Checks every shipped puzzle file: each puzzle must be a legal line that
 * ends in checkmate after exactly N player moves.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS, levelFile } from '../src/lib/levels';
import { type LevelFile, validatePuzzle } from '../src/lib/puzzle';

const read = (levelId: number): LevelFile =>
  JSON.parse(readFileSync(new URL(`../public/${levelFile(levelId)}`, import.meta.url), 'utf8'));

describe.each(LEVELS)('level $id ($name, mate in $mateIn)', (level) => {
  const file = read(level.id);

  it('has puzzles and the right header', () => {
    expect(file.levelId).toBe(level.id);
    expect(file.mateIn).toBe(level.mateIn);
    expect(file.puzzles.length).toBeGreaterThanOrEqual(50);
  });

  it('every puzzle ends in checkmate', () => {
    const bad = file.puzzles
      .map((p) => ({ id: p.id, reason: validatePuzzle(p, level.mateIn) }))
      .filter((r) => r.reason !== null);
    expect(bad).toEqual([]);
  });

  it('is sorted easiest to hardest with unique ids', () => {
    const ratings = file.puzzles.map((p) => p.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
    expect(new Set(file.puzzles.map((p) => p.id)).size).toBe(file.puzzles.length);
  });
});
