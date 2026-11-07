import { useEffect, useState } from 'react'
import { LEVELS } from './lib/levels'
import './App.css'

interface LevelSummary {
  levelId: number
  shipped: number
}

/**
 * Milestone 0/1 placeholder: shows the six levels and how many puzzles each
 * has. The board and solving loop arrive in milestone 2.
 */
function App() {
  const [counts, setCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    // BASE_URL is "/chess-mates/" in production, so this works on GitHub Pages.
    fetch(`${import.meta.env.BASE_URL}puzzles/index.json`)
      .then((r) => r.json())
      .then((data: { levels: LevelSummary[] }) =>
        setCounts(Object.fromEntries(data.levels.map((l) => [l.levelId, l.shipped]))),
      )
      .catch(() => setCounts({}))
  }, [])

  return (
    <main className="home">
      <h1>Chess Mates</h1>
      <p className="tagline">See the finishing moves, from mate in 1 to mate in 6.</p>
      <ol className="levels">
        {LEVELS.map((level) => (
          <li key={level.id} className="level-card">
            <span className="level-name">{level.name}</span>
            <span className="level-mate">Mate in {level.mateIn}</span>
            <span className="level-count">
              {counts[level.id] !== undefined ? `${counts[level.id]} puzzles` : '…'}
            </span>
          </li>
        ))}
      </ol>
      <p className="soon">The board is coming next. Puzzles from the Lichess puzzle database (CC0).</p>
    </main>
  )
}

export default App
