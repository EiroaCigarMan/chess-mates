/**
 * Builds the per-level puzzle files from the Lichess puzzle database.
 *
 * Usage:
 *   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   npm run puzzles -- lichess_db_puzzle.csv.zst
 *
 * The Lichess file has ~5 million puzzles (~300 MB compressed), far too big
 * for a browser. This script reads it once, block by block (never fully in
 * memory or on disk uncompressed), keeps good-quality mate puzzles, and writes about
 * PER_LEVEL puzzles per level to public/puzzles/level-N.json, spread
 * evenly from easiest to hardest by Lichess rating.
 *
 * Output is deterministic: same input file => same JSON files.
 */
import { type FileHandle, mkdir, open, writeFile } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';
import { zstdDecompressSync } from 'node:zlib';
import { LEVELS } from '../src/lib/levels.ts';
import { type LevelFile, type Puzzle, mateLength, validatePuzzle } from '../src/lib/puzzle.ts';

const PER_LEVEL = 300;
const OUT_DIR = new URL('../public/puzzles/', import.meta.url);

/** Quality filters. Long mates are rarer, so the top level is less strict. */
const MIN_POPULARITY = 80; // Lichess players' thumbs-up score, -100..100
const MIN_PLAYS = 500;
const MIN_PLAYS_GRANDMASTER = 100;

/** Themes that only restate the level, so we don't ship them. */
const NOISE_THEMES = /^(mate|mateIn\d|oneMove|short|long|veryLong)$/;

interface Candidate extends Puzzle {
  popularity: number;
  plays: number;
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run puzzles -- <path to lichess_db_puzzle.csv.zst>');
    process.exit(1);
  }

  const buckets = new Map<number, Candidate[]>(LEVELS.map((l) => [l.mateIn, []]));
  let rows = 0;
  let header = true;

  for await (const line of readPzstdLines(input)) {
    if (header) {
      header = false;
      continue;
    }
    if (!line) continue;
    rows++;
    if (rows % 500_000 === 0) console.log(`  read ${rows.toLocaleString()} rows...`);

    // Columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
    // No field contains a comma (lists inside fields are space-separated).
    const [id, fen, movesStr, rating, , popularity, plays, themesStr] = line.split(',');
    const themes = themesStr.split(' ');
    if (!themes.includes('mate')) continue;

    const moves = movesStr.split(' ');
    const n = mateLength(moves);
    const bucket = buckets.get(n);
    if (!bucket) continue;
    // For mate in 1-5 Lichess also tags mateInN; require it to agree with the move count.
    if (n <= 5 && !themes.includes(`mateIn${n}`)) continue;

    const minPlays = n === 6 ? MIN_PLAYS_GRANDMASTER : MIN_PLAYS;
    if (Number(popularity) < MIN_POPULARITY || Number(plays) < minPlays) continue;

    bucket.push({
      id,
      fen,
      moves,
      rating: Number(rating),
      themes: themes.filter((t) => !NOISE_THEMES.test(t)),
      popularity: Number(popularity),
      plays: Number(plays),
    });
  }

  console.log(`Read ${rows.toLocaleString()} puzzles.`);
  await mkdir(OUT_DIR, { recursive: true });

  const summary: { levelId: number; name: string; mateIn: number; candidates: number; shipped: number }[] = [];
  for (const level of LEVELS) {
    const candidates = buckets.get(level.mateIn)!;
    const picked = pickSpread(candidates, PER_LEVEL, level.mateIn);
    const file: LevelFile = {
      levelId: level.id,
      mateIn: level.mateIn,
      source: 'Lichess puzzle database (CC0), https://database.lichess.org/#puzzles',
      puzzles: picked.map(({ id, fen, moves, rating, themes }) => ({ id, fen, moves, rating, themes })),
    };
    await writeFile(new URL(`level-${level.id}.json`, OUT_DIR), JSON.stringify(file) + '\n');
    summary.push({
      levelId: level.id,
      name: level.name,
      mateIn: level.mateIn,
      candidates: candidates.length,
      shipped: picked.length,
    });
    console.log(
      `Level ${level.id} ${level.name.padEnd(11)} mate in ${level.mateIn}: ` +
        `${candidates.length.toLocaleString()} candidates -> ${picked.length} shipped ` +
        `(rating ${picked[0]?.rating ?? '-'}..${picked.at(-1)?.rating ?? '-'})`,
    );
  }
  await writeFile(new URL('index.json', OUT_DIR), JSON.stringify({ levels: summary }, null, 2) + '\n');
}

/**
 * Yields the lines of a .zst file written by `pzstd` (parallel zstd), which
 * is what Lichess publishes. Such a file is a sequence of blocks:
 *   [skippable frame: magic 0x184D2A50, length 4, u32 size N][zstd frame of N bytes]
 * Node's streaming zstd decoder stops at the first skippable frame, so we
 * walk the blocks ourselves and decompress each ~8 MB frame separately.
 */
async function* readPzstdLines(path: string): AsyncGenerator<string> {
  const SKIPPABLE_MAGIC = 0x184d2a50;
  const file = await open(path);
  try {
    const { size } = await file.stat();
    const head = Buffer.alloc(12);
    const decoder = new StringDecoder('utf8'); // a character could straddle two frames
    let offset = 0;
    let partial = '';
    while (offset < size) {
      await readExactly(file, head, offset);
      if (head.readUInt32LE(0) !== SKIPPABLE_MAGIC || head.readUInt32LE(4) !== 4) {
        throw new Error(`Expected a pzstd block at byte ${offset}. Is this the Lichess .csv.zst file?`);
      }
      const frame = Buffer.alloc(head.readUInt32LE(8));
      await readExactly(file, frame, offset + head.length);
      offset += head.length + frame.length;

      const lines = (partial + decoder.write(zstdDecompressSync(frame))).split('\n');
      partial = lines.pop()!; // last piece may be an unfinished line
      yield* lines;
    }
    partial += decoder.end();
    if (partial) yield partial;
  } finally {
    await file.close();
  }
}

async function readExactly(file: FileHandle, buffer: Buffer, position: number): Promise<void> {
  const { bytesRead } = await file.read(buffer, 0, buffer.length, position);
  if (bytesRead !== buffer.length) throw new Error(`Unexpected end of file at byte ${position}`);
}

/**
 * Picks up to `count` puzzles spread across the rating range: sort by rating,
 * cut into `count` equal slices, and from each slice take the most-played
 * puzzle that passes validation. Result is sorted easiest -> hardest.
 */
function pickSpread(candidates: Candidate[], count: number, mateIn: number): Candidate[] {
  const sorted = [...candidates].sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
  const slices = Math.min(count, sorted.length);
  const picked: Candidate[] = [];
  for (let s = 0; s < slices; s++) {
    const slice = sorted.slice(
      Math.floor((s * sorted.length) / slices),
      Math.floor(((s + 1) * sorted.length) / slices),
    );
    slice.sort((a, b) => b.plays * b.popularity - a.plays * a.popularity || a.id.localeCompare(b.id));
    const good = slice.find((p) => validatePuzzle(p, mateIn) === null);
    if (good) picked.push(good);
  }
  return picked;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
