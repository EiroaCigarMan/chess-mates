import { describe, expect, it } from 'vitest';
import { soundFor } from './sound';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
// Same as AFTER_E4 but with Black's d-pawn gone (a capture happened).
const ONE_FEWER = 'rnbqkbnr/ppp1pppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('soundFor', () => {
  it('no change, no sound', () => {
    expect(soundFor(START, START, 'playing')).toBeNull();
  });

  it('a normal move clacks, a capture double-clacks', () => {
    expect(soundFor(START, AFTER_E4, 'opponent')).toBe('move');
    expect(soundFor(AFTER_E4, ONE_FEWER, 'playing')).toBe('capture');
  });

  it('mate and wrong moves get their own sounds', () => {
    expect(soundFor(START, AFTER_E4, 'solved')).toBe('mate');
    expect(soundFor(START, AFTER_E4, 'failed')).toBe('wrong');
  });
});
