import { describe, expect, it } from 'vitest';
import type { Puzzle } from './puzzle';
import { attempt, isPromotion, playReply, playSetup, retry, startPuzzle } from './solver';

// Scholar's Mate as a mate in 1: Black blunders 3...Nf6, White plays Qxf7#.
const MATE_IN_1: Puzzle = {
  id: 'test1',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
  moves: ['g8f6', 'h5f7'],
  rating: 600,
  themes: [],
};

// Real Lichess mate in 2 (puzzle 469oJ, back-rank mate). White plays Qe2,
// then Black: 1...Rb1+ 2. Qd1 Rxd1#
const MATE_IN_2: Puzzle = {
  id: '469oJ',
  fen: '6k1/5pp1/1r6/6p1/4p3/8/6PP/5Q1K w - - 0 46',
  moves: ['f1e2', 'b6b1', 'e2d1', 'b1d1'],
  rating: 400,
  themes: ['backRankMate'],
};

describe('solver', () => {
  it('works out the player colour from the setup move', () => {
    expect(startPuzzle(MATE_IN_1).player).toBe('white');
    expect(startPuzzle(MATE_IN_2).player).toBe('black');
  });

  it('plays the setup move, then accepts the mating move', () => {
    const s = playSetup(startPuzzle(MATE_IN_1));
    expect(s.status).toBe('playing');
    expect(s.lastMove).toEqual({ from: 'g8', to: 'f6' });
    const r = attempt(s, 'h5f7');
    expect(r.outcome).toBe('solved');
    expect(r.state.status).toBe('solved');
  });

  it('ignores illegal moves without failing the puzzle', () => {
    const s = playSetup(startPuzzle(MATE_IN_1));
    const r = attempt(s, 'h5h8');
    expect(r.outcome).toBe('illegal');
    expect(r.state).toBe(s);
  });

  it('fails a legal wrong move, and retry goes back', () => {
    const s = playSetup(startPuzzle(MATE_IN_1));
    const r = attempt(s, 'h5e5');
    expect(r.outcome).toBe('wrong');
    expect(r.state.status).toBe('failed');
    const again = retry(r.state);
    expect(again.status).toBe('playing');
    expect(again.fen).toBe(s.fen);
    expect(attempt(again, 'h5f7').outcome).toBe('solved');
  });

  it('walks a mate in 2: correct move, opponent reply, mate', () => {
    let s = playSetup(startPuzzle(MATE_IN_2));
    const first = attempt(s, 'b6b1');
    expect(first.outcome).toBe('correct');
    expect(first.state.status).toBe('opponent');
    s = playReply(first.state);
    expect(s.status).toBe('playing');
    expect(s.lastMove).toEqual({ from: 'e2', to: 'd1' });
    expect(attempt(s, 'b1d1').outcome).toBe('solved');
  });

  it('detects promotions', () => {
    const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
    expect(isPromotion(fen, 'e7', 'e8')).toBe(true);
    expect(isPromotion(fen, 'e1', 'e2')).toBe(false);
  });
});
