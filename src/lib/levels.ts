/**
 * The six difficulty levels. Each level is "mate in N": the player must
 * deliver checkmate in exactly N of their own moves.
 */
export interface Level {
  id: number;
  name: string;
  mateIn: number;
}

export const LEVELS: readonly Level[] = [
  { id: 1, name: 'Easy', mateIn: 1 },
  { id: 2, name: 'Medium', mateIn: 2 },
  { id: 3, name: 'Hard', mateIn: 3 },
  { id: 4, name: 'Expert', mateIn: 4 },
  { id: 5, name: 'Master', mateIn: 5 },
  { id: 6, name: 'Grandmaster', mateIn: 6 },
];

/** Path (relative to the site base) of the JSON file holding a level's puzzles. */
export function levelFile(levelId: number): string {
  return `puzzles/level-${levelId}.json`;
}
