import { describe, expect, it } from 'vitest';
import { mateLength, parseUci, validatePuzzle } from './puzzle';

// Position after 1.e4 e5 2.Bc4 Nc6 3.Qh5 — Black to move.
// Setup move: Black blunders with 3...Nf6, then White plays Qxf7# (Scholar's Mate).
const SCHOLARS_MATE = {
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
  moves: ['g8f6', 'h5f7'],
};

describe('parseUci', () => {
  it('parses a normal move', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4' });
  });

  it('parses a promotion', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });

  it('rejects garbage', () => {
    expect(() => parseUci('e9e4')).toThrow();
  });
});

describe('validatePuzzle', () => {
  it('accepts a real mate in 1', () => {
    expect(mateLength(SCHOLARS_MATE.moves)).toBe(1);
    expect(validatePuzzle(SCHOLARS_MATE, 1)).toBeNull();
  });

  it('rejects a final move that only gives check', () => {
    // Qxe5+ is check, not mate.
    expect(validatePuzzle({ ...SCHOLARS_MATE, moves: ['g8f6', 'h5e5'] }, 1)).toBe(
      'final position is not checkmate',
    );
  });

  it('rejects an illegal move', () => {
    expect(validatePuzzle({ ...SCHOLARS_MATE, moves: ['g8f6', 'h5h8'] }, 1)).toMatch(/illegal/);
  });

  it('rejects the wrong length', () => {
    expect(validatePuzzle(SCHOLARS_MATE, 2)).toMatch(/expected 4 moves/);
  });
});
