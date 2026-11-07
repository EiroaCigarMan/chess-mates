/**
 * Shared SVG gradients for the cedar pieces. Rendered once, invisibly, near
 * the top of the page; every piece's fill points at these by id.
 *
 * The "grain" is a linear gradient with many close, uneven stops at a slight
 * angle, so each piece gets stripes like a turned wooden piece. It costs
 * nothing at runtime (no filters), which keeps dragging smooth on phones.
 */
const grainStops = (a: string, b: string) =>
  [0, 0.07, 0.11, 0.2, 0.26, 0.33, 0.41, 0.46, 0.55, 0.6, 0.68, 0.74, 0.83, 0.88, 0.95, 1].map((offset, i) => (
    <stop key={offset} offset={offset} stopColor={i % 2 === 0 ? a : b} />
  ))

export function CedarDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* Light side: pale cedar sapwood, honey-blonde */}
        <linearGradient id="cedar-light" x1="0" y1="0" x2="1" y2="0.25">
          {grainStops('#ecd0a6', '#ddb684')}
        </linearGradient>
        {/* Dark side: red cedar heartwood */}
        <linearGradient id="cedar-dark" x1="0" y1="0" x2="1" y2="0.25">
          {grainStops('#8b4126', '#713119')}
        </linearGradient>
      </defs>
    </svg>
  )
}
