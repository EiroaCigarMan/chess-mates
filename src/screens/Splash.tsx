import { useEffect, useState } from 'react'
import './splash.css'

const MIN_SHOW_MS = 2200
const FADE_MS = 500

interface Props {
  /** True once the app has what it needs (the level summary). */
  ready: boolean
  onDone: () => void
}

/**
 * Opening screen: a cedar knight enjoying a cigar while the puzzles load.
 * Stays at least MIN_SHOW_MS so the smoke gets a moment; tap to skip.
 */
export function Splash({ ready, onDone }: Props) {
  const [minTimePassed, setMinTimePassed] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), MIN_SHOW_MS)
    return () => clearTimeout(t)
  }, [])

  const shouldLeave = leaving || (ready && minTimePassed)
  useEffect(() => {
    if (!shouldLeave) return
    const t = setTimeout(onDone, FADE_MS)
    return () => clearTimeout(t)
  }, [shouldLeave, onDone])

  return (
    <div
      className={`splash${shouldLeave ? ' leaving' : ''}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onClick={() => setLeaving(true)}
      role="presentation"
    >
      <SmokingKnight />
      <h1 className="splash-title">Chess Mates</h1>
      <p className="splash-sub">{ready ? 'Tap to begin' : 'Lighting up the puzzles…'}</p>
    </div>
  )
}

/**
 * The knight is the classic cburnett knight shape; the cigar, ember and
 * smoke are drawn on top in the same 45x45 coordinate space.
 */
export function SmokingKnight() {
  return (
    <svg className="smoking-knight" viewBox="-14 -4 58 47" role="img" aria-label="A wooden chess knight smoking a cigar">
      <defs>
        <linearGradient id="splash-cedar" x1="0" y1="0" x2="1" y2="0.3">
          {[0, 0.09, 0.16, 0.27, 0.35, 0.44, 0.52, 0.61, 0.7, 0.78, 0.86, 0.93, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor={i % 2 ? '#c4713f' : '#d98d57'} />
          ))}
        </linearGradient>
        <linearGradient id="cigar-wrap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a36" />
          <stop offset="0.45" stopColor="#6b3f22" />
          <stop offset="1" stopColor="#4a2814" />
        </linearGradient>
        <radialGradient id="ember-glow">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.45" stopColor="#ff7a2e" />
          <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Cigar, drawn BEHIND the head so its end disappears between the lips */}
      <g transform="rotate(-8 10.5 29.2)">
        <rect x="-4.2" y="28.1" width="15.6" height="2.3" rx="1.1" fill="url(#cigar-wrap)" stroke="#2a150a" strokeWidth="0.35" />
        {/* gold band */}
        <rect x="2.4" y="28.05" width="1.7" height="2.4" fill="#d9a441" stroke="#8a5f17" strokeWidth="0.25" />
        <rect x="2.85" y="28.9" width="0.8" height="0.7" fill="#b2322a" />
        {/* ash and ember at the tip */}
        <rect x="-4.6" y="28.15" width="1.4" height="2.2" rx="0.5" fill="#bdb6ad" />
        <circle className="ember" cx="-4.5" cy="29.25" r="2.4" fill="url(#ember-glow)" />
      </g>

      {/* Knight (cburnett shape, cedar fill) */}
      <g stroke="#3a1c0e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="url(#splash-cedar)">
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
        <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
      </g>
      <g fill="#3a1c0e" stroke="#3a1c0e">
        <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" />
        <path d="M 15 15.5 A 0.5 1.5 0 1 1  14,15.5 A 0.5 1.5 0 1 1  15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" />
      </g>

      {/* Smoke rising from the tip */}
      <g className="smoke" fill="none" stroke="#e9e3da" strokeLinecap="round">
        <path className="wisp w1" d="M -5,27 C -8,23 -2,20 -5,16 C -8,12 -3,9 -6,5" strokeWidth="1.2" />
        <path className="wisp w2" d="M -4.5,27 C -1,23 -7,19 -3.5,15 C -0.5,11 -6,8 -3,3" strokeWidth="0.9" />
        <path className="wisp w3" d="M -5,27 C -9,24 -6,19 -9,15 C -12,11 -8,7 -10,2" strokeWidth="0.7" />
      </g>
    </svg>
  )
}
