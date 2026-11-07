import { useCallback, useEffect, useState } from 'react'
import { CedarDefs } from './board/CedarDefs'
import { type Level, LEVELS } from './lib/levels'
import { accuracy, currentDailyStreak, isUnlocked, unlockNeeds } from './lib/progress'
import { useProgress } from './lib/progressStore'
import { PuzzleScreen } from './screens/PuzzleScreen'
import { Splash } from './screens/Splash'
import { StatsScreen } from './screens/StatsScreen'
import './App.css'

interface LevelSummary {
  levelId: number
  shipped: number
}

type Screen = { name: 'home' } | { name: 'puzzle'; level: Level } | { name: 'stats' }

function App() {
  const [counts, setCounts] = useState<Record<number, number> | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

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
  const home = () => setScreen({ name: 'home' })

  return (
    <>
      <CedarDefs />
      {showSplash && <Splash ready={counts !== null} onDone={hideSplash} />}
      {screen.name === 'puzzle' && <PuzzleScreen level={screen.level} onBack={home} />}
      {screen.name === 'stats' && <StatsScreen onBack={home} />}
      {screen.name === 'home' && (
        <Home
          counts={counts ?? {}}
          onPick={(level) => setScreen({ name: 'puzzle', level })}
          onStats={() => setScreen({ name: 'stats' })}
        />
      )}
    </>
  )
}

interface HomeProps {
  counts: Record<number, number>
  onPick: (level: Level) => void
  onStats: () => void
}

function Home({ counts, onPick, onStats }: HomeProps) {
  const progress = useProgress()
  const days = currentDailyStreak(progress, new Date())

  return (
    <main className="home">
      <h1>Chess Mates</h1>
      <p className="tagline">See the finishing moves, from mate in 1 to mate in 6.</p>

      <button type="button" className="rating-card" onClick={onStats}>
        <span className="rating-label">Your rating</span>
        <span className="rating-value">{progress.rating}</span>
        <span className="rating-extra">
          {progress.attempts === 0
            ? 'Solve a puzzle to start'
            : `${days > 0 ? `🔥 ${days}-day streak · ` : ''}See your stats →`}
        </span>
      </button>

      <ol className="levels">
        {LEVELS.map((level) => {
          const total = counts[level.id]
          const stats = progress.levels[level.id]
          const open = isUnlocked(progress, level.id)
          const acc = stats ? accuracy(stats) : null

          if (!open) {
            const needs = unlockNeeds(progress, level.id)
            const below = LEVELS[level.id - 2].name
            return (
              <li key={level.id}>
                <div className="level-card locked" aria-disabled="true">
                  <span className="level-name">🔒 {level.name}</span>
                  <span className="level-mate">Mate in {level.mateIn}</span>
                  <span className="level-count">
                    {needs.clean > 0
                      ? `Solve ${needs.clean} more ${below} cleanly`
                      : `Get ${needs.recentClean} more of your last 10 ${below} clean`}
                  </span>
                </div>
              </li>
            )
          }

          return (
            <li key={level.id}>
              <button type="button" className="level-card" onClick={() => onPick(level)}>
                <span className="level-name">{level.name}</span>
                <span className="level-mate">Mate in {level.mateIn}</span>
                <span className="level-count">
                  {total === undefined
                    ? '…'
                    : stats && stats.attempts > 0
                      ? `${stats.attempts} played · ${acc}% clean`
                      : `${total} puzzles`}
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
