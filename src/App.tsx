import { useCallback, useEffect, useState } from 'react'
import { CedarDefs } from './board/CedarDefs'
import { type Level, LEVELS } from './lib/levels'
import { loadNumber } from './lib/storage'
import { PuzzleScreen } from './screens/PuzzleScreen'
import { Splash } from './screens/Splash'
import './App.css'

interface LevelSummary {
  levelId: number
  shipped: number
}

function App() {
  const [counts, setCounts] = useState<Record<number, number> | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [level, setLevel] = useState<Level | null>(null)

  useEffect(() => {
    // BASE_URL is "/chess-mates/" in production, so this works on GitHub Pages.
    fetch(`${import.meta.env.BASE_URL}puzzles/index.json`)
      .then((r) => r.json())
      .then((data: { levels: LevelSummary[] }) =>
        setCounts(Object.fromEntries(data.levels.map((l) => [l.levelId, l.shipped]))),
      )
      .catch(() => setCounts({}))
  }, [])

  const hideSplash = useCallback(() => setShowSplash(false), [])

  return (
    <>
      <CedarDefs />
      {showSplash && <Splash ready={counts !== null} onDone={hideSplash} />}
      {level ? (
        <PuzzleScreen level={level} onBack={() => setLevel(null)} />
      ) : (
        <Home counts={counts ?? {}} onPick={setLevel} />
      )}
    </>
  )
}

function Home({ counts, onPick }: { counts: Record<number, number>; onPick: (level: Level) => void }) {
  return (
    <main className="home">
      <h1>Chess Mates</h1>
      <p className="tagline">See the finishing moves, from mate in 1 to mate in 6.</p>
      <ol className="levels">
        {LEVELS.map((level) => {
          const total = counts[level.id]
          const at = loadNumber(`level-${level.id}:next`, 0)
          return (
            <li key={level.id}>
              <button type="button" className="level-card" onClick={() => onPick(level)}>
                <span className="level-name">{level.name}</span>
                <span className="level-mate">Mate in {level.mateIn}</span>
                <span className="level-count">
                  {total === undefined ? '…' : at > 0 ? `Puzzle ${at + 1} of ${total}` : `${total} puzzles`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="credits">
        Puzzles from the <a href="https://database.lichess.org/#puzzles">Lichess puzzle database</a> (CC0). Piece
        shapes by Colin M.L. Burnett.
      </p>
    </main>
  )
}

export default App
