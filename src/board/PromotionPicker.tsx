import { cedarPieces } from './cedarPieces'

const CHOICES = [
  { code: 'q', name: 'Queen' },
  { code: 'r', name: 'Rook' },
  { code: 'b', name: 'Bishop' },
  { code: 'n', name: 'Knight' },
] as const

interface Props {
  color: 'white' | 'black'
  onPick: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}

/** Asks which piece a pawn promotes to. Some mates need a knight, not a queen! */
export function PromotionPicker({ color, onPick, onCancel }: Props) {
  const prefix = color === 'white' ? 'w' : 'b'
  return (
    <div className="promotion" role="dialog" aria-label="Choose a promotion piece" onClick={onCancel}>
      <div className="promotion-box" onClick={(e) => e.stopPropagation()}>
        <p>Promote to</p>
        <div className="promotion-choices">
          {CHOICES.map(({ code, name }) => (
            <button key={code} type="button" aria-label={name} title={name} onClick={() => onPick(code)}>
              {cedarPieces[`${prefix}${code.toUpperCase()}`]()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
