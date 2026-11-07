import { Chess, type Square } from 'chess.js';
import { type Puzzle, parseUci } from './puzzle';

/**
 * The puzzle-solving state machine. Pure functions only: each takes a state
 * and returns a new one, so it is easy to test and React can just store it.
 *
 *   intro ──playSetup──▶ playing ──attempt(correct)──▶ opponent ──playReply──▶ playing …
 *                           │
 *                           ├─attempt(final mate)──▶ solved
 *                           └─attempt(wrong)───────▶ failed ──retry──▶ playing
 */
export type Status = 'intro' | 'playing' | 'opponent' | 'solved' | 'failed';

export interface SolveState {
  puzzle: Puzzle;
  status: Status;
  /** Index into puzzle.moves of the next move to be played. */
  ply: number;
  fen: string;
  /** FEN to return to on retry (the position before the wrong move). */
  retryFen: string | null;
  lastMove: { from: string; to: string } | null;
  /** The player's colour, known once the setup move is played. */
  player: 'white' | 'black';
}

export type Outcome = 'illegal' | 'wrong' | 'correct' | 'solved';

export function startPuzzle(puzzle: Puzzle): SolveState {
  // The setup move is played by the side to move in the FEN; the player is the other side.
  const setupSide = new Chess(puzzle.fen).turn();
  return {
    puzzle,
    status: 'intro',
    ply: 0,
    fen: puzzle.fen,
    retryFen: null,
    lastMove: null,
    player: setupSide === 'w' ? 'black' : 'white',
  };
}

/** Plays the opponent's setup move (moves[0]) so the player can start. */
export function playSetup(state: SolveState): SolveState {
  if (state.status !== 'intro') return state;
  return { ...applyMove(state, state.puzzle.moves[0]), status: 'playing' };
}

/** Plays the opponent's forced reply after a correct player move. */
export function playReply(state: SolveState): SolveState {
  if (state.status !== 'opponent') return state;
  return { ...applyMove(state, state.puzzle.moves[state.ply]), status: 'playing' };
}

/**
 * The player tries a move (UCI, e.g. "e2e4" or "e7e8q").
 * - illegal: not a legal move; state unchanged (the piece snaps back).
 * - correct: matches the solution; the opponent replies next.
 * - solved: the final move, and it is checkmate. Like Lichess, ANY mating
 *   move counts on the last move, not only the stored one.
 * - wrong: legal but not the solution; the puzzle is failed.
 */
export function attempt(state: SolveState, uci: string): { outcome: Outcome; state: SolveState } {
  if (state.status !== 'playing') return { outcome: 'illegal', state };

  const chess = new Chess(state.fen);
  try {
    chess.move(parseUci(uci));
  } catch {
    return { outcome: 'illegal', state };
  }

  const { moves } = state.puzzle;
  const isLast = state.ply === moves.length - 1;
  const after = { ...state, fen: chess.fen(), lastMove: { from: uci.slice(0, 2), to: uci.slice(2, 4) } };

  if (isLast && chess.isCheckmate()) {
    return { outcome: 'solved', state: { ...after, ply: state.ply + 1, status: 'solved' } };
  }
  if (!isLast && uci === moves[state.ply]) {
    return { outcome: 'correct', state: { ...after, ply: state.ply + 1, status: 'opponent' } };
  }
  return { outcome: 'wrong', state: { ...after, status: 'failed', retryFen: state.fen } };
}

/** After a wrong move: go back to the position before it and try again. */
export function retry(state: SolveState): SolveState {
  if (state.status !== 'failed' || !state.retryFen) return state;
  return { ...state, status: 'playing', fen: state.retryFen, retryFen: null, lastMove: null };
}

/** True if moving from -> to is a legal pawn promotion (so we must ask which piece). */
export function isPromotion(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  return chess
    .moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to && m.promotion !== undefined);
}

function applyMove(state: SolveState, uci: string): SolveState {
  const chess = new Chess(state.fen);
  chess.move(parseUci(uci));
  return {
    ...state,
    fen: chess.fen(),
    ply: state.ply + 1,
    lastMove: { from: uci.slice(0, 2), to: uci.slice(2, 4) },
  };
}
