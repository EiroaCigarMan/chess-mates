# chess-mates
A puzzle game for chess lovers. Practice seeing finishing moves like a grand master.

**Play:** https://eiroacigarman.github.io/chess-mates/

## Levels

| Level | Mate in |
|---|---|
| Easy | 1 |
| Medium | 2 |
| Hard | 3 |
| Expert | 4 |
| Master | 5 |
| Grandmaster | 6 |

Each level ships ~300 puzzles from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0), spread from easiest to hardest by Lichess rating.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests + checks every shipped puzzle ends in checkmate
npm run lint
npm run build    # production build into dist/
```

## Rebuilding the puzzle files

The puzzle JSON in `public/puzzles/` is committed, so normal builds don't need the big Lichess file. To regenerate it (e.g. to pick up new Lichess puzzles):

```bash
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst   # ~300 MB
npm run puzzles -- lichess_db_puzzle.csv.zst
```

The script (`scripts/build-puzzles.ts`) streams and decompresses the file, keeps popular, well-played mate puzzles, validates each one with chess.js, and writes `public/puzzles/level-N.json` plus a summary in `index.json`. Needs Node 22.18+ (built-in TypeScript and zstd support).

## Deploy

Every push to `main` is built and published to GitHub Pages by `.github/workflows/deploy.yml`.
One-time setup: **Settings → Pages → Source: GitHub Actions**.

## Credits

Puzzles: [Lichess](https://lichess.org) puzzle database, released under CC0.
