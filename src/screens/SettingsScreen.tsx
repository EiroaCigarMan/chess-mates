import { type ChangeEvent, useRef, useState } from 'react'
import { exportFile, newProgress, parseProgress } from '../lib/progress'
import { replaceProgress, updateProgress, useProgress } from '../lib/progressStore'
import { play, setSoundEnabled, soundEnabled } from '../lib/sound'
import './pages.css'

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const progress = useProgress()
  const [sound, setSound] = useState(soundEnabled)
  const [notice, setNotice] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function toggleSound() {
    const on = !sound
    setSoundEnabled(on)
    setSound(on)
    if (on) play('move') // a sample, so you hear what you turned on
  }

  function save() {
    const { name, json } = exportFile(progress, new Date())
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice({ text: `Saved ${name}. Keep it somewhere safe.`, tone: 'good' })
  }

  async function load(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still triggers
    if (!file) return
    let parsed = null
    try {
      parsed = parseProgress(JSON.parse(await file.text()))
    } catch {
      parsed = null
    }
    if (!parsed) {
      setNotice({ text: "That file isn't a Chess Mates progress file.", tone: 'bad' })
      return
    }
    const ok = window.confirm(
      `Load this file? It has rating ${parsed.rating} and ${parsed.attempts} ${parsed.attempts === 1 ? 'puzzle' : 'puzzles'} played, and will replace your current progress (rating ${progress.rating}).`,
    )
    if (!ok) return
    replaceProgress(parsed)
    setNotice({ text: 'Progress loaded.', tone: 'good' })
  }

  function reset() {
    if (!window.confirm('Start over? This erases your rating, streaks and stats on this device.')) return
    replaceProgress(newProgress())
    setNotice({ text: 'Progress reset. Fresh start!', tone: 'good' })
  }

  return (
    <main className="page">
      <header className="puzzle-header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to levels">
          ←
        </button>
        <h2>Settings</h2>
      </header>

      {notice && (
        <p className={`notice ${notice.tone}`} role="status">
          {notice.text}
        </p>
      )}

      <section className="panel">
        <div className="setting-row">
          <div>
            <h3>Sound</h3>
            <p className="muted small">Wooden clacks for moves, a chime for checkmate.</p>
          </div>
          <button type="button" className="switch" role="switch" aria-checked={sound} onClick={toggleSound}>
            <span className="visually-hidden">Sound</span>
            {sound ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>Your progress</h3>
        <p className="muted small">
          Progress lives in this browser only. Save it to a file to keep a backup, or to move it to another phone or
          computer.
        </p>
        <div className="button-row">
          <button type="button" onClick={save}>
            Save progress
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Load progress
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={load} />
        </div>
      </section>

      <section className="panel">
        <div className="setting-row">
          <div>
            <h3>Unlock all levels</h3>
            <p className="muted small">
              Normally a level opens after 10 clean solves on the level below (7 of your last 10 clean). Turn this on
              to look ahead.
            </p>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={progress.unlockAll}
            onClick={() => updateProgress((p) => ({ ...p, unlockAll: !p.unlockAll }))}
          >
            <span className="visually-hidden">Unlock all levels</span>
            {progress.unlockAll ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>Start over</h3>
        <p className="muted small">Erase your rating, streaks and stats on this device.</p>
        <button type="button" className="danger" onClick={reset}>
          Reset progress
        </button>
      </section>
    </main>
  )
}
