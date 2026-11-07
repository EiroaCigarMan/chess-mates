import { SmokingKnight } from './Splash'
import './pages.css'

export function CreditsScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="page credits-page">
      <header className="puzzle-header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to levels">
          ←
        </button>
        <h2>Credits</h2>
      </header>

      <div className="credits-hero">
        <SmokingKnight />
        <p className="credits-title">Chess Mates</p>
        <p className="muted">Practice seeing finishing moves like a grandmaster.</p>
      </div>

      <section className="panel">
        <h3>Made by</h3>
        <ul className="people">
          <li>
            <a className="person-name" href="https://github.com/EiroaCigarMan" target="_blank" rel="noreferrer">
              Johann (EiroaCigarMan)
            </a>
            <span className="person-role">Creator</span>
            <p className="muted small">
              Dreamed up the game: checkmate puzzles from mate in 1 to mate in 6, cedar pieces on a marble board, and
              a knight who enjoys a good cigar.
            </p>
          </li>
          <li>
            <span className="person-name">Ulysses</span>
            <span className="person-role">Co-designer and builder</span>
            <p className="muted small">
              Helped shape the design, then built it: the puzzle pipeline, the board, the progress tracking, and
              plenty of testing.
            </p>
          </li>
        </ul>
      </section>

      <section className="panel">
        <h3>With thanks to</h3>
        <ul className="thanks">
          <li>
            <strong>Puzzles:</strong> the{' '}
            <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">
              Lichess puzzle database
            </a>
            , made by Lichess players and released under CC0.
          </li>
          <li>
            <strong>Piece designs:</strong> Colin M.L. Burnett (the "cburnett" set), via{' '}
            <a href="https://github.com/Clariity/react-chessboard" target="_blank" rel="noreferrer">
              react-chessboard
            </a>{' '}
            (MIT).
          </li>
          <li>
            <strong>Chess rules:</strong>{' '}
            <a href="https://github.com/jhlywa/chess.js" target="_blank" rel="noreferrer">
              chess.js
            </a>{' '}
            (BSD-2-Clause).
          </li>
          <li>
            <strong>Built with</strong> React and Vite, hosted on GitHub Pages.
          </li>
        </ul>
      </section>

      <p className="muted small center">
        <a href="https://github.com/EiroaCigarMan/chess-mates" target="_blank" rel="noreferrer">
          Source code on GitHub
        </a>
      </p>
    </main>
  )
}
