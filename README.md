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

Solve each puzzle by dragging or tapping pieces: the opponent's last move plays first, your correct moves get an automatic reply, and on the final move any checkmate counts. Pawn promotions ask which piece you want (some mates need a knight!).

Stuck? **Hint** makes the piece to move glow, a second hint adds an arrow, and **Show solution** plays the mate.

**Progress** is saved in your browser:
- **Rating:** Elo against each puzzle's Lichess rating. A clean solve (no hint, no wrong move) is a win.
- **Unlocks:** a level opens after 10 clean solves on the level below, with 7 of the last 10 clean. The stats page can unlock everything for a preview.
- **Review:** a missed puzzle comes back 5 puzzles later.
- **Stats page:** rating chart, streaks, days in a row, per-level accuracy, and recent puzzles with links to Lichess.

The rules live in `src/lib/progress.ts`.

**Settings** turns sound on or off (wooden clacks and a mate chime, synthesized with Web Audio, so there are no audio files). It also saves progress to a file and loads it back, which is the way to back up or move to another device. It can reset everything, or unlock all levels.

**On a phone,** use *Add to Home Screen* to get the cigar-knight icon and a full-screen app.

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

## Graphics

- **Board:** white Carrara and green Verde marble. Each square shows its own slice of one big slab, so the veins don't repeat.
- **Pieces:** the classic cburnett shapes filled with cedar-wood grain (pale sapwood vs. red heartwood).
- **Frame:** cedar.
- **Opening screen:** a cedar knight with a cigar (`src/screens/Splash.tsx`).

The marble and cedar textures in `public/textures/` are generated with SVG noise filters and committed. The home-screen icons are rendered from `public/icon.svg`. To regenerate either (needs Playwright with Chromium):

```bash
node scripts/make-textures.cjs
```

```bash
node scripts/make-icons.cjs
```

## Deploy

Every push to `main` is built and published to GitHub Pages by `.github/workflows/deploy.yml`.
One-time setup: **Settings → Pages → Source: GitHub Actions**.

## Credits

- Made by **Johann ([EiroaCigarMan](https://github.com/EiroaCigarMan))**, creator, and **Ulysses**, co-designer and builder.

- Puzzles: [Lichess](https://lichess.org) puzzle database, released under CC0.
- Piece shapes: Colin M.L. Burnett ("cburnett" set), via [react-chessboard](https://github.com/Clariity/react-chessboard).
