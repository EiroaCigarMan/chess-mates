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
 *
 *   Any unfinished state ──showSolution──▶ revealing ──revealStep…──▶ revealed
 *   Hints (takeHint) don't change the status; they only raise hintLevel.
 */
export type Status = 'intro' | 'playing' | 'opponent' | 'solved' | 'failed' | 'revealing' | 'revealed';

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
  /** Hints shown for the current move: 0 none, 1 which piece, 2 piece and target. */
  hintLevel: 0 | 1 | 2;
  /** True once a hint or the solution was used (progress tracking will count these differently). */
  assisted: boolean;
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
    hintLevel: 0,
    assisted: false,
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
  const after: SolveState = {
    ...state,
    fen: chess.fen(),
    lastMove: { from: uci.slice(0, 2), to: uci.slice(2, 4) },
    hintLevel: 0, // hints are per move
  };

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

/** The move a hint points at: the solution's next move, while it's the player's turn. */
export function hintMove(state: SolveState): { from: string; to: string } | null {
  if (state.status !== 'playing') return null;
  const uci = state.puzzle.moves[state.ply];
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

/** First hint shows which piece to move; the second also shows where. */
export function takeHint(state: SolveState): SolveState {
  if (state.status !== 'playing' || state.hintLevel === 2) return state;
  return { ...state, hintLevel: (state.hintLevel + 1) as 1 | 2, assisted: true };
}

/**
 * Gives up and shows the answer: from the current position (or, after a
 * wrong move, the position before it), the remaining solution moves are
 * played one at a time with revealStep.
 */
export function showSolution(state: SolveState): SolveState {
  if (state.status === 'solved' || state.status === 'revealing' || state.status === 'revealed') return state;
  return {
    ...state,
    status: 'revealing',
    fen: state.retryFen ?? state.fen,
    lastMove: state.retryFen ? null : state.lastMove,
    retryFen: null,
    hintLevel: 0,
    assisted: true,
  };
}

/** Plays the next solution move while revealing; ends in 'revealed' after the mate. */
export function revealStep(state: SolveState): SolveState {
  if (state.status !== 'revealing') return state;
  const next = applyMove(state, state.puzzle.moves[state.ply]);
  return { ...next, status: next.ply === state.puzzle.moves.length ? 'revealed' : 'revealing' };
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
