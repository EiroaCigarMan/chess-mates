import { type CSSProperties, useMemo, useState } from 'react'
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
import { cedarPieces } from './cedarPieces'
import './board.css'

const texture = (name: string) => `url(${import.meta.env.BASE_URL}textures/${name}.jpg)`
const MARBLE_LIGHT = texture('marble-light')
const MARBLE_DARK = texture('marble-dark')
const FILES = 'abcdefgh'

const LAST_MOVE_TINT = 'rgba(255, 205, 80, 0.42)'
const SELECTED_TINT = 'rgba(120, 190, 255, 0.45)'
const HINT_RING = 'inset 0 0 0 4px rgba(255, 166, 40, 0.95), inset 0 0 18px rgba(255, 166, 40, 0.65)'
const HINT_ARROW = 'rgba(232, 140, 30, 0.85)'

interface Props {
  fen: string
  orientation: 'white' | 'black'
  lastMove: { from: string; to: string } | null
  /** Hint: glow on the piece to move; with showTarget, also an arrow to its square. */
  hint: { from: string; to: string; showTarget: boolean } | null
  /** Whether the player may move right now. */
  interactive: boolean
  /** Called when the player makes a move. Return false to reject it. */
  onMove: (from: string, to: string) => boolean
}

/**
 * The chessboard: marble squares, cedar pieces, cedar frame.
 * Moves work by dragging OR by tapping a piece and then its target square
 * (tapping is much easier on phones).
 */
export function PuzzleBoard({ fen, orientation, lastMove, hint, interactive, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  // Clear the selection whenever the position changes (React's "reset state on prop change" pattern).
  const [selectedFen, setSelectedFen] = useState(fen)
  if (selectedFen !== fen) {
    setSelectedFen(fen)
    setSelected(null)
  }

  const myColor = orientation === 'white' ? 'w' : 'b'

  const targets = useMemo(() => {
    if (!selected) return []
    return new Chess(fen).moves({ square: selected as Square, verbose: true }).map((m) => m.to)
  }, [fen, selected])

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    for (let f = 0; f < 8; f++) {
      for (let r = 1; r <= 8; r++) {
        const square = `${FILES[f]}${r}`
        const isLight = (f + r) % 2 === 0
        // Each square shows its own 1/8 x 1/8 slice of one big marble slab,
        // so veins flow naturally instead of repeating on every square.
        const layers = [isLight ? MARBLE_LIGHT : MARBLE_DARK]
        const tint =
          square === selected ? SELECTED_TINT : lastMove && (square === lastMove.from || square === lastMove.to) ? LAST_MOVE_TINT : null
        if (tint) layers.unshift(`linear-gradient(${tint}, ${tint})`)
        if (targets.includes(square as Square)) {
          layers.unshift('radial-gradient(circle, rgba(40, 30, 20, 0.35) 17%, transparent 19%)')
        }
        styles[square] = {
          backgroundImage: layers.join(', '),
          backgroundSize: layers.map((l) => (l.startsWith('url') ? '800% 800%' : '100% 100%')).join(', '),
          backgroundPosition: layers
            .map((l) => (l.startsWith('url') ? `${(f * 100) / 7}% ${((8 - r) * 100) / 7}%` : '0 0'))
            .join(', '),
          ...(hint && square === hint.from ? { boxShadow: HINT_RING } : {}),
        }
      }
    }
    return styles
  }, [hint, lastMove, selected, targets])

  function tryMove(from: string, to: string): boolean {
    setSelected(null)
    return onMove(from, to)
  }

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (!interactive) return
    if (selected && targets.includes(square as Square)) {
      tryMove(selected, square)
    } else if (piece && piece.pieceType[0] === myColor) {
      setSelected(square === selected ? null : square)
    } else {
      setSelected(null)
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!interactive || !targetSquare || targetSquare === sourceSquare) return false
    return tryMove(sourceSquare, targetSquare)
  }

  return (
    <div className="board-frame">
      <Chessboard
        options={{
          id: 'puzzle',
          position: fen,
          boardOrientation: orientation,
          pieces: cedarPieces,
          squareStyles,
          lightSquareStyle: {},
          darkSquareStyle: {},
          lightSquareNotationStyle: { color: 'rgba(48, 88, 72, 0.9)' },
          darkSquareNotationStyle: { color: 'rgba(242, 239, 234, 0.9)' },
          dropSquareStyle: { boxShadow: 'inset 0 0 0 4px rgba(255, 205, 80, 0.8)' },
          allowDrawingArrows: false,
          arrows: hint?.showTarget ? [{ startSquare: hint.from, endSquare: hint.to, color: HINT_ARROW }] : [],
          animationDurationInMs: 250,
          allowDragging: interactive,
          canDragPiece: ({ piece }) => interactive && piece.pieceType[0] === myColor,
          onPieceDrop,
          onSquareClick,
        }}
      />
    </div>
  )
}
