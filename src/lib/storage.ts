/**
 * Tiny localStorage wrapper. Storage can be missing or throw (private mode,
 * blocked cookies), so every access is guarded and falls back gracefully.
 * Full progress tracking (ratings, streaks, unlocks) arrives in milestone 4.
 */
const PREFIX = 'chess-mates:'

export function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

export function saveNumber(key: string, value: number): void {
  try {
    localStorage.setItem(PREFIX + key, String(value))
  } catch {
    // Not saved; the app still works for this visit.
  }
}
