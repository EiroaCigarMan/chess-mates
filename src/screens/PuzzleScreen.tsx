import { useEffect, useState } from 'react'
import { PuzzleBoard } from '../board/PuzzleBoard'
import { PromotionPicker } from '../board/PromotionPicker'
import { type Level, levelFile } from '../lib/levels'
import type { LevelFile, Puzzle } from '../lib/puzzle'
import { type SolveState, attempt, isPromotion, playReply, playSetup, retry, startPuzzle } from '../lib/solver'
import { loadNumber, saveNumber } from '../lib/storage'
import './puzzle.css'

/** Pauses so the player can follow what the opponent does. */
const SETUP_DELAY_MS = 800
const REPLY_DELAY_MS = 550

interface Props {
  level: Level
  onBack: () => void
}

export function PuzzleScreen({ level, onBack }: Props) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [error, setError] = useState(false)
  const [index, setIndex] = useState(() => loadNumber(`level-${level.id}:next`, 0))

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}${levelFile(level.id)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<LevelFile>
      })
      .then((file) => setPuzzles(file.puzzles))
      .catch(() => setError(true))
  }, [level.id])

  if (error) {
    return (
      <main className="puzzle-screen">
        <p>Couldn't load the puzzles. Check your connection and try again.</p>
        <button type="button" onClick={onBack}>Back</button>
      </main>
    )
  }
  if (!puzzles) return <main className="puzzle-screen loading">Setting up the board…</main>

  const safeIndex = index % puzzles.length
  const nextIndex = (safeIndex + 1) % puzzles.length
  // Solving saves progress at once, so a reload doesn't bring a solved puzzle back.
  const solved = () => saveNumber(`level-${level.id}:next`, nextIndex)
  const next = () => {
    setIndex(nextIndex)
    saveNumber(`level-${level.id}:next`, nextIndex)
  }

  return (
    <PuzzlePlayer
      // A new key gives each puzzle a fresh player with fresh state.
      key={puzzles[safeIndex].id}
      level={level}
      puzzle={puzzles[safeIndex]}
      number={safeIndex + 1}
      total={puzzles.length}
      onSolved={solved}
      onNext={next}
      onBack={onBack}
    />
  )
}

interface PlayerProps {
  level: Level
  puzzle: Puzzle
  number: number
  total: number
  onSolved: () => void
  onNext: () => void
  onBack: () => void
}

function PuzzlePlayer({ level, puzzle, number, total, onSolved, onNext, onBack }: PlayerProps) {
  const [state, setState] = useState<SolveState>(() => startPuzzle(puzzle))
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null)
  const [nudge, setNudge] = useState(0) // bumps to re-run the "wrong" shake animation

  // The opponent moves on its own: first the setup move, then each forced reply.
  useEffect(() => {
    if (state.status === 'intro') {
      const t = setTimeout(() => setState(playSetup), SETUP_DELAY_MS)
      return () => clearTimeout(t)
    }
    if (state.status === 'opponent') {
      const t = setTimeout(() => setState(playReply), REPLY_DELAY_MS)
      return () => clearTimeout(t)
    }
  }, [state.status])

  function submit(uci: string): boolean {
    const result = attempt(state, uci)
    if (result.outcome === 'illegal') return false
    if (result.outcome === 'wrong') setNudge((n) => n + 1)
    if (result.outcome === 'solved') onSolved()
    setState(result.state)
    return true
  }

  function onMove(from: string, to: string): boolean {
    if (isPromotion(state.fen, from, to)) {
      setPromotion({ from, to })
      return false // the pawn waits until a piece is chosen
    }
    return submit(from + to)
  }

  const movesLeft = Math.ceil((puzzle.moves.length - state.ply) / 2)
  const side = state.player === 'white' ? 'White' : 'Black'

  const message = {
    intro: { text: 'Watch the last move…', tone: '' },
    playing: { text: `${side} to move — mate in ${movesLeft}`, tone: '' },
    opponent: { text: 'Good move! Keep going…', tone: 'good' },
    solved: { text: 'Checkmate! Well played.', tone: 'good' },
    failed: { text: "That's not it. Try again?", tone: 'bad' },
  }[state.status]

  return (
    <main className="puzzle-screen">
      <header className="puzzle-header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to levels">
          ←
        </button>
        <div>
          <h2>
            {level.name} · Mate in {level.mateIn}
          </h2>
          <p className="puzzle-meta">
            Puzzle {number} of {total} · rated {puzzle.rating}
          </p>
        </div>
      </header>

      <PuzzleBoard
        fen={state.fen}
        orientation={state.player}
        lastMove={state.lastMove}
        interactive={state.status === 'playing'}
        onMove={onMove}
      />

      <p key={nudge} className={`status ${message.tone}`} role="status" aria-live="polite">
        {message.text}
      </p>

      <div className="actions">
        {state.status === 'failed' && (
          <button type="button" onClick={() => setState(retry)}>
            Retry
          </button>
        )}
        {(state.status === 'solved' || state.status === 'failed') && (
          <button type="button" className="primary" onClick={onNext}>
            Next puzzle →
          </button>
        )}
      </div>

      {promotion && (
        <PromotionPicker
          color={state.player}
          onCancel={() => setPromotion(null)}
          onPick={(piece) => {
            setPromotion(null)
            submit(promotion.from + promotion.to + piece)
          }}
        />
      )}
    </main>
  )
}
