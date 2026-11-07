import { defaultPieces, type PieceRenderObject } from 'react-chessboard'

/**
 * The classic "cburnett" piece shapes (by Colin M.L. Burnett, the set Lichess
 * and Wikipedia use; shipped inside react-chessboard), filled with the cedar
 * gradients from CedarDefs and given a soft shadow so they stand on the marble.
 */
const SHADOW = 'drop-shadow(0 2px 1.5px rgba(0, 0, 0, 0.45))'

export const cedarPieces: PieceRenderObject = Object.fromEntries(
  Object.entries(defaultPieces).map(([key, render]) => {
    const fill = key.startsWith('w') ? 'url(#cedar-light)' : 'url(#cedar-dark)'
    return [key, (props) => render({ ...props, fill, svgStyle: { ...props?.svgStyle, filter: SHADOW } })]
  }),
)
