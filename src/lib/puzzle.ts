import { Chess } from 'chess.js';

/**
 * One checkmate puzzle, in the shape we ship to the browser.
 *
 * Lichess convention (kept here on purpose):
 * - `fen` is the position BEFORE the opponent's last move.
 * - `moves[0]` is that opponent move (the "setup" move). It is played
 *   automatically so the player sees what just happened.
 * - After that, moves alternate player / opponent, ending with the
 *   player's checkmating move. So the player makes moves.length / 2 moves.
 * Moves are in UCI notation, e.g. "e2e4" or "e7e8q" (promotion).
 */
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

export interface LevelFile {
  levelId: number;
  mateIn: number;
  source: string;
  puzzles: Puzzle[];
}

export interface UciMove {
  from: string;
  to: string;
  promotion?: string;
}

export function parseUci(uci: string): UciMove {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error(`Not a UCI move: ${uci}`);
  }
  const move: UciMove = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  if (uci.length === 5) move.promotion = uci[4];
  return move;
}

/** How many moves the player has to make: the "N" in mate-in-N. */
export function mateLength(moves: string[]): number {
  return moves.length / 2;
}

/**
 * Checks a puzzle really is a forced-line mate-in-N as stored:
 * every move is legal, nobody is mated early, and the last move is mate.
 * Returns null when valid, or a short reason when not.
 */
export function validatePuzzle(puzzle: Pick<Puzzle, 'fen' | 'moves'>, mateIn: number): string | null {
  if (puzzle.moves.length !== mateIn * 2) {
    return `expected ${mateIn * 2} moves, got ${puzzle.moves.length}`;
  }
  let chess: Chess;
  try {
    chess = new Chess(puzzle.fen);
  } catch {
    return 'invalid FEN';
  }
  for (let i = 0; i < puzzle.moves.length; i++) {
    if (chess.isGameOver()) return `game already over before move ${i}`;
    try {
      chess.move(parseUci(puzzle.moves[i]));
    } catch {
      return `illegal move ${puzzle.moves[i]} at index ${i}`;
    }
  }
  return chess.isCheckmate() ? null : 'final position is not checkmate';
}
