import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { LEVELS } from '../lib/levels'
import {
  type HistoryEntry,
  type Progress,
  type Result,
  START_RATING,
  accuracy,
  currentDailyStreak,
  isUnlocked,
  unlockNeeds,
} from '../lib/progress'
import { updateProgress, useProgress } from '../lib/progressStore'
import './stats.css'

const RESULT_LABEL: Record<Result, { icon: string; text: string }> = {
  clean: { icon: '✓', text: 'Clean' },
  assisted: { icon: '◐', text: 'With help' },
  failed: { icon: '✗', text: 'Missed' },
}

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const p = useProgress()
  const totals = Object.values(p.levels).reduce(
    (t, l) => ({ attempts: t.attempts + l.attempts, clean: t.clean + l.clean }),
    { attempts: 0, clean: 0 },
  )
  const best = Math.max(START_RATING, ...p.history.map((h) => h.rating))
  const acc = accuracy(totals)

  return (
    <main className="stats-screen">
      <header className="puzzle-header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to levels">
          ←
        </button>
        <h2>Your progress</h2>
      </header>

      <section className="tiles" aria-label="Summary">
        <Tile label="Rating" value={p.rating} note={`best ${best}`} />
        <Tile label="Puzzles" value={totals.attempts} note={acc === null ? '—' : `${acc}% clean`} />
        <Tile label="Clean streak" value={p.streak} note={`best ${p.bestStreak}`} />
        <Tile label="Days in a row" value={currentDailyStreak(p, new Date())} note={`best ${p.daily.best}`} />
      </section>

      <section className="panel">
        <h3>Rating over time</h3>
        <RatingChart history={p.history} />
      </section>

      <section className="panel">
        <h3>Levels</h3>
        <table className="level-table">
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Played</th>
              <th scope="col">Clean</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((level) => {
              const s = p.levels[level.id]
              const a = s ? accuracy(s) : null
              return (
                <tr key={level.id}>
                  <th scope="row">
                    {level.name} <span className="muted">· {level.mateIn}</span>
                  </th>
                  <td>{s?.attempts ?? 0}</td>
                  <td>{a === null ? '—' : `${a}%`}</td>
                  <td>{levelStatus(p, level.id)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {p.review.length > 0 && (
          <p className="muted small">
            {p.review.length} missed {p.review.length === 1 ? 'puzzle is' : 'puzzles are'} waiting to come back for
            another try.
          </p>
        )}
      </section>

      <section className="panel">
        <h3>Recent puzzles</h3>
        {p.history.length === 0 ? (
          <p className="muted">Nothing yet. Your solved and missed puzzles will show up here.</p>
        ) : (
          <ol className="recent">
            {p.history
              .slice(-10)
              .reverse()
              .map((h) => (
                <li key={h.at + h.puzzleId} className={`recent-row ${h.result}`}>
                  <span className="result">
                    <span aria-hidden="true">{RESULT_LABEL[h.result].icon}</span> {RESULT_LABEL[h.result].text}
                  </span>
                  <span className="muted">
                    {LEVELS[h.levelId - 1]?.name} · rated {h.puzzleRating} · {Math.round(h.ms / 1000)}s
                  </span>
                  <a href={`https://lichess.org/training/${h.puzzleId}`} target="_blank" rel="noreferrer">
                    on Lichess ↗
                  </a>
                </li>
              ))}
          </ol>
        )}
      </section>

      <section className="panel">
        <h3>Levels unlock as you improve</h3>
        <p className="muted small">
          Each level opens after 10 clean solves (no hints, no wrong moves) on the level below, with at least 7 of
          your last 10 clean. Want to look ahead anyway?
        </p>
        <button type="button" onClick={() => updateProgress((q) => ({ ...q, unlockAll: !q.unlockAll }))}>
          {p.unlockAll ? 'Lock levels again' : 'Unlock all levels'}
        </button>
      </section>
    </main>
  )
}

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-note">{note}</span>
    </div>
  )
}

function levelStatus(p: Progress, levelId: number): string {
  if (isUnlocked(p, levelId)) {
    return levelId === 1 || p.levels[levelId]?.unlocked ? 'Open' : 'Open (preview)'
  }
  const needs = unlockNeeds(p, levelId)
  return needs.clean > 0 ? `🔒 ${needs.clean} clean to go` : `🔒 ${needs.recentClean} more recent clean`
}

// ---- Rating chart -----------------------------------------------------------

const H = 200
const PAD = { top: 14, right: 14, bottom: 26, left: 44 }
const MAX_POINTS = 100

/**
 * A single 2px line of the rating after each puzzle (last 100). Hover or
 * drag a finger across it: a crosshair snaps to the nearest puzzle and a
 * tooltip shows the rating and how that puzzle went. Arrow keys work too.
 */
function RatingChart({ history }: { history: HistoryEntry[] }) {
  const [active, setActive] = useState<number | null>(null)
  // Draw at the real on-screen width so labels stay 12px on phones too.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (history.length === 0) {
    return <p className="muted">Solve a few puzzles to see your rating move.</p>
  }

  // Start from the starting rating when the whole history fits.
  const shown = history.slice(-MAX_POINTS)
  const startNumber = history.length - shown.length // puzzles before the first shown point
  const points = [
    ...(startNumber === 0 ? [{ n: 0, rating: START_RATING, entry: null as HistoryEntry | null }] : []),
    ...shown.map((h, i) => ({ n: startNumber + i + 1, rating: h.rating, entry: h as HistoryEntry | null })),
  ]

  const ratings = points.map((pt) => pt.rating)
  const lo = Math.floor((Math.min(...ratings) - 20) / 50) * 50
  const hi = Math.ceil((Math.max(...ratings) + 20) / 50) * 50
  const nMin = points[0].n
  const nMax = Math.max(points[points.length - 1].n, nMin + 1)
  const x = (n: number) => PAD.left + ((n - nMin) / (nMax - nMin)) * (W - PAD.left - PAD.right)
  const y = (r: number) => PAD.top + ((hi - r) / (hi - lo)) * (H - PAD.top - PAD.bottom)

  const step = niceStep(hi - lo)
  const gridValues: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) gridValues.push(v)

  const path = points.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.n).toFixed(1)},${y(pt.rating).toFixed(1)}`).join(' ')

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let nearest = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].n) - px) < Math.abs(x(points[nearest].n) - px)) nearest = i
    }
    setActive(nearest)
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const cur = active ?? points.length - 1
    setActive(Math.min(points.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  const a = active === null ? null : points[active]
  const tipLeft = a ? (x(a.n) / W) * 100 : 0

  return (
    <div className="chart" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Rating over your last ${shown.length} puzzles, from ${points[0].rating} to ${points[points.length - 1].rating}`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <text className="axis" x={PAD.left} y={H - 6}>
          {nMin === 0 ? 'start' : `#${nMin}`}
        </text>
        <text className="axis" x={W - PAD.right} y={H - 6} textAnchor="end">
          puzzle #{points[points.length - 1].n}
        </text>

        <path className="line" d={path} />

        {a && (
          <g>
            <line className="crosshair" x1={x(a.n)} x2={x(a.n)} y1={PAD.top} y2={H - PAD.bottom} />
            <circle className="marker" cx={x(a.n)} cy={y(a.rating)} r={5} />
          </g>
        )}
        {!a && (
          <circle className="marker end" cx={x(points[points.length - 1].n)} cy={y(points[points.length - 1].rating)} r={4} />
        )}
      </svg>

      {a && (
        <div className="tooltip" style={{ left: `${Math.min(80, Math.max(20, tipLeft))}%` }} role="status">
          <strong>{a.rating}</strong>
          <span>
            {a.entry
              ? `Puzzle #${a.n} · ${RESULT_LABEL[a.entry.result].icon} ${RESULT_LABEL[a.entry.result].text}`
              : 'Starting rating'}
          </span>
        </div>
      )}
    </div>
  )
}

function niceStep(range: number): number {
  for (const s of [25, 50, 100, 200, 250, 500]) if (range / s <= 5) return s
  return 1000
}
