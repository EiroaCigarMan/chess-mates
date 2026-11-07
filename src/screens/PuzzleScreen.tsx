import { useEffect, useRef, useState } from 'react'
import { PuzzleBoard } from '../board/PuzzleBoard'
import { PromotionPicker } from '../board/PromotionPicker'
import { type Level, levelFile } from '../lib/levels'
import { type Result, pickPuzzle, recordResult } from '../lib/progress'
import { getProgress, updateProgress, useProgress } from '../lib/progressStore'
import { play, soundFor } from '../lib/sound'
import type { LevelFile, Puzzle } from '../lib/puzzle'
import {
  type SolveState,
  attempt,
  hintMove,
  isPromotion,
  playReply,
  playSetup,
  resultOf,
  retry,
  revealStep,
  showSolution,
  startPuzzle,
  takeHint,
} from '../lib/solver'
import './puzzle.css'

/** Pauses so the player can follow what the opponent does. */
const SETUP_DELAY_MS = 800
const REPLY_DELAY_MS = 550
const REVEAL_DELAY_MS = 900

interface Props {
  level: Level
  onBack: () => void
}

export function PuzzleScreen({ level, onBack }: Props) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [error, setError] = useState(false)
  // Which puzzle is on the board. `visit` changes every time, so even a
  // repeated puzzle gets a fresh player.
  const [current, setCurrent] = useState<{ index: number; review: boolean; visit: number } | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}${levelFile(level.id)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<LevelFile>
      })
      .then((file) => {
        setPuzzles(file.puzzles)
        const ids = file.puzzles.map((p) => p.id)
        setCurrent({ ...pickPuzzle(getProgress(), level.id, ids), visit: 0 })
      })
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
  if (!puzzles || !current) return <main className="puzzle-screen loading">Setting up the board…</main>

  const puzzle = puzzles[current.index]

  /** Scores this visit once; returns the rating change. */
  const record = (result: Result, ms: number): number => {
    let delta = 0
    updateProgress((p) => {
      const r = recordResult(p, {
        levelId: level.id,
        puzzleId: puzzle.id,
        puzzleRating: puzzle.rating,
        result,
        ms,
        now: new Date(),
        index: current.review ? null : current.index,
        total: puzzles.length,
      })
      delta = r.delta
      return r.progress
    })
    return delta
  }

  const next = () =>
    setCurrent((c) => ({
      ...pickPuzzle(getProgress(), level.id, puzzles.map((p) => p.id)),
      visit: (c?.visit ?? 0) + 1,
    }))

  return (
    <PuzzlePlayer
      key={current.visit}
      level={level}
      puzzle={puzzle}
      number={current.index + 1}
      total={puzzles.length}
      review={current.review}
      onResult={record}
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
  review: boolean
  onResult: (result: Result, ms: number) => number
  onNext: () => void
  onBack: () => void
}

function PuzzlePlayer({ level, puzzle, number, total, review, onResult, onNext, onBack }: PlayerProps) {
  const [state, setState] = useState<SolveState>(() => startPuzzle(puzzle))
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null)
  const [nudge, setNudge] = useState(0) // bumps to re-run the "wrong" shake animation
  const [delta, setDelta] = useState<number | null>(null)
  const { rating } = useProgress()

  // Scoring: each visit counts once, at the first moment it can be scored.
  const recorded = useRef(false)
  const startedAt = useRef<number | null>(null)
  const latest = useRef({ state, onResult })

  // Sound for every position change: clack, capture, mate chime, or wrong.
  const prevFen = useRef(state.fen)
  useEffect(() => {
    const sound = soundFor(prevFen.current, state.fen, state.status)
    prevFen.current = state.fen
    if (sound) play(sound)
  }, [state.fen, state.status])

  useEffect(() => {
    latest.current = { state, onResult }
    if (state.status === 'playing' && startedAt.current === null) startedAt.current = Date.now()
    const result = resultOf(state)
    if (result && !recorded.current) {
      recorded.current = true
      setDelta(onResult(result, Date.now() - (startedAt.current ?? Date.now())))
    }
  }, [state, onResult])
  // Leaving after a wrong move counts as a miss. It must be recorded BEFORE
  // the next puzzle is picked, so Next and Back call this first; the unmount
  // cleanup is only a safety net.
  const recordLeaving = () => {
    const { state: s, onResult: report } = latest.current
    const result = resultOf(s, true)
    if (result && !recorded.current) {
      recorded.current = true
      report(result, Date.now() - (startedAt.current ?? Date.now()))
    }
  }
  const recordLeavingRef = useRef(recordLeaving)
  useEffect(() => {
    recordLeavingRef.current = recordLeaving
  })
  useEffect(() => () => recordLeavingRef.current(), [])
  const leave = (go: () => void) => () => {
    recordLeaving()
    go()
  }

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
    // Showing the solution: one move at a time, slowly enough to follow.
    if (state.status === 'revealing') {
      const t = setTimeout(() => setState(revealStep), REVEAL_DELAY_MS)
      return () => clearTimeout(t)
    }
  }, [state.status, state.ply])

  function submit(uci: string): boolean {
    const result = attempt(state, uci)
    if (result.outcome === 'illegal') return false
    if (result.outcome === 'wrong') setNudge((n) => n + 1)
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

  const hint = hintMove(state)
  const playingText =
    state.hintLevel === 1
      ? 'Hint: move the glowing piece.'
      : state.hintLevel === 2
        ? 'Hint: follow the arrow.'
        : `${side} to move — mate in ${movesLeft}`

  const message = {
    intro: { text: 'Watch the last move…', tone: '' },
    playing: { text: playingText, tone: state.hintLevel ? 'hint' : '' },
    opponent: { text: 'Good move! Keep going…', tone: 'good' },
    solved: { text: state.assisted ? 'Checkmate! (with a hint)' : 'Checkmate! Well played.', tone: 'good' },
    failed: { text: "That's not it. Try again?", tone: 'bad' },
    revealing: { text: "Here's the mate…", tone: 'hint' },
    revealed: { text: "That's the mate. Now try it yourself!", tone: 'hint' },
  }[state.status]

  return (
    <main className="puzzle-screen">
      <header className="puzzle-header">
        <button type="button" className="back" onClick={leave(onBack)} aria-label="Back to levels">
          ←
        </button>
        <div>
          <h2>
            {level.name} · Mate in {level.mateIn}
          </h2>
          <p className="puzzle-meta">
            {review ? <span className="review-tag">Review</span> : `Puzzle ${number} of ${total}`} · rated{' '}
            {puzzle.rating}
          </p>
        </div>
      </header>

      <PuzzleBoard
        fen={state.fen}
        orientation={state.player}
        lastMove={state.lastMove}
        hint={hint && state.hintLevel > 0 ? { ...hint, showTarget: state.hintLevel === 2 } : null}
        interactive={state.status === 'playing'}
        onMove={onMove}
      />

      <p key={nudge} className={`status ${message.tone}`} role="status" aria-live="polite">
        {message.text}
      </p>
      <p className="rating-line">
        Your rating <strong>{rating}</strong>
        {delta !== null && delta !== 0 && (
          <span className={delta > 0 ? 'delta up' : 'delta down'}>{delta > 0 ? `+${delta}` : `−${-delta}`}</span>
        )}
      </p>

      <div className="actions">
        {state.status === 'playing' && (
          <>
            <button type="button" onClick={() => setState(takeHint)} disabled={state.hintLevel === 2}>
              {state.hintLevel === 0 ? 'Hint' : 'Another hint'}
            </button>
            <button type="button" onClick={() => setState(showSolution)}>
              Show solution
            </button>
          </>
        )}
        {state.status === 'failed' && (
          <>
            <button type="button" onClick={() => setState(retry)}>
              Retry
            </button>
            <button type="button" onClick={() => setState(showSolution)}>
              Show solution
            </button>
          </>
        )}
        {state.status === 'revealed' && (
          <button type="button" onClick={() => setState(startPuzzle(puzzle))}>
            Try it yourself
          </button>
        )}
        {(state.status === 'solved' || state.status === 'failed' || state.status === 'revealed') && (
          <button type="button" className="primary" onClick={leave(onNext)}>
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
