import type { KeyboardEvent } from 'react'
import {
  DL_Y, LOS_Y, OL_X, SLOT_LAYOUT, TECH_MARKS, TIER_COLOR, TIER_LABEL, pct, rateTier, shortName,
  type Slot, type Tier,
} from '../constants'
import type { LineupPlayer } from '../types'

interface Props {
  lineup: LineupPlayer[]
  selectedId: number | null
  onSelect: (nflId: number) => void
}

const W = 800
const MIN_H = 440
const OL_Y = 165
const QB_Y = 95

const R = 25 // radio del marcador
const MARKER_GAP = 66 // distancia mínima entre centros de marcadores en la misma fila
const CARD_W = 120
const CARD_H = 38
const CARD_DY = R + 6 // separación marcador → tarjeta
const ROW_STEP = CARD_H + 8 // desplazamiento vertical al alternar tarjetas
const MAX_ROWS = 4
const EDGE = 40

interface Box { x1: number; y1: number; x2: number; y2: number }

interface Placed {
  p: LineupPlayer
  slot: Slot
  x: number
  y: number
  cardX: number
  cardY: number
  row: number
}

const overlaps = (a: Box, b: Box, pad = 3) =>
  a.x1 < b.x2 + pad && b.x1 < a.x2 + pad && a.y1 < b.y2 + pad && b.y1 < a.y2 + pad

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function slotFor(position: string, index: number): Slot {
  return SLOT_LAYOUT[position] ?? { x: 165 + index * 157, y: DL_Y, tech: '?' }
}

/**
 * 1) Separa marcadores de la misma fila que queden a < MARKER_GAP.
 * 2) Coloca cada tarjeta de nombre en la primera fila libre (alternando hacia abajo)
 *    que no se encime con otra tarjeta ni con otro marcador.
 */
function layout(lineup: LineupPlayer[]): Placed[] {
  const items = lineup.map((p, i) => {
    const slot = slotFor(p.position, i)
    return { p, slot, x: slot.x, y: slot.y }
  })

  const rows = new Map<number, typeof items>()
  for (const it of items) rows.set(it.y, [...(rows.get(it.y) ?? []), it])
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) row[i].x = Math.max(row[i].x, row[i - 1].x + MARKER_GAP)
    row[row.length - 1].x = Math.min(row[row.length - 1].x, W - EDGE)
    for (let i = row.length - 2; i >= 0; i--) row[i].x = Math.min(row[i].x, row[i + 1].x - MARKER_GAP)
    for (const it of row) it.x = Math.max(it.x, EDGE)
  }

  const markerBoxes = items.map((it) => ({ id: it.p.nflId, box: { x1: it.x - R - 4, y1: it.y - R - 4, x2: it.x + R + 4, y2: it.y + R + 4 } }))
  const cards: Box[] = []
  const placed: Placed[] = []

  for (const it of [...items].sort((a, b) => a.x - b.x || a.y - b.y)) {
    const cardX = clamp(it.x - CARD_W / 2, 4, W - 4 - CARD_W)
    let row = 0
    let box: Box = { x1: cardX, y1: 0, x2: cardX + CARD_W, y2: 0 }
    for (; row < MAX_ROWS; row++) {
      const y1 = it.y + CARD_DY + row * ROW_STEP
      box = { x1: cardX, y1, x2: cardX + CARD_W, y2: y1 + CARD_H }
      const hitsCard = cards.some((c) => overlaps(c, box))
      const hitsMarker = markerBoxes.some((m) => m.id !== it.p.nflId && overlaps(m.box, box, 0))
      if (!hitsCard && !hitsMarker) break
    }
    row = Math.min(row, MAX_ROWS - 1)
    cards.push(box)
    placed.push({ ...it, cardX, cardY: box.y1, row })
  }
  // Conserva el orden original del lineup (izquierda → derecha según backend).
  return lineup.map((p) => placed.find((q) => q.p.nflId === p.nflId)!)
}

/** Cancha pre-snap en SVG: línea ofensiva + los 4 defensivos en su hueco óptimo. */
export default function Field({ lineup, selectedId, onSelect }: Props) {
  const placed = layout(lineup)
  const H = Math.max(MIN_H, ...placed.map((q) => q.cardY + CARD_H + 16))

  const handleKey = (e: KeyboardEvent<SVGGElement>, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <figure className="overflow-hidden rounded-xl ring-1 ring-white/10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        role="group"
        aria-label="Cancha: alineación óptima del frente defensivo"
      >
        {/* Césped con franjas de 5 yardas */}
        {Array.from({ length: Math.ceil(H / 40) }, (_, i) => (
          <rect key={i} x={0} y={i * 40} width={W} height={40} fill={i % 2 ? '#1B5E20' : '#2E7D32'} />
        ))}
        {/* Hash marks */}
        {Array.from({ length: Math.ceil(H / 20) }, (_, i) => (
          <g key={i} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2}>
            <line x1={6} x2={16} y1={i * 20 + 10} y2={i * 20 + 10} />
            <line x1={W - 16} x2={W - 6} y1={i * 20 + 10} y2={i * 20 + 10} />
          </g>
        ))}

        {/* Línea de golpeo */}
        <line x1={0} x2={W} y1={LOS_Y} y2={LOS_Y} stroke="#FFFFFF" strokeWidth={3} strokeOpacity={0.9} />
        <text x={22} y={LOS_Y - 8} fill="#FFFFFF" fontSize={12} fontWeight={700} opacity={0.85}>
          LOS
        </text>

        {/* Técnicas de alineación */}
        {TECH_MARKS.map((m, i) => (
          <text key={i} x={m.x} y={LOS_Y + 16} textAnchor="middle" fill="#FFFFFF" fontSize={10} opacity={0.6}>
            {m.label}
          </text>
        ))}

        {/* Ofensiva: QB, balón y línea ofensiva (vista desde la defensa) */}
        <circle cx={OL_X.C} cy={QB_Y} r={18} fill="#FFFFFF" fillOpacity={0.15} stroke="#FFFFFF" strokeWidth={2} />
        <text x={OL_X.C} y={QB_Y + 4} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight={700}>
          QB
        </text>
        <ellipse cx={OL_X.C} cy={LOS_Y - 4} rx={8} ry={5} fill="#8B4513" stroke="#FFFFFF" strokeWidth={1} />
        {(Object.entries(OL_X) as Array<[keyof typeof OL_X, number]>).map(([label, x]) => (
          <g key={label}>
            <rect x={x - 22} y={OL_Y - 17} width={44} height={34} rx={6} fill="#013369" stroke="#FFFFFF" strokeWidth={2} />
            <text x={x} y={OL_Y + 5} textAnchor="middle" fill="#FFFFFF" fontSize={13} fontWeight={700}>
              {label}
            </text>
          </g>
        ))}

        {/* Guías marcador → tarjeta (capa inferior para no cruzar por encima de otras tarjetas) */}
        {placed
          .filter((q) => q.row > 0)
          .map(({ p, x, y, cardX, cardY }) => (
            <line key={p.nflId} x1={x} y1={y + R} x2={cardX + CARD_W / 2} y2={cardY}
              stroke={TIER_COLOR[rateTier(p.pressure_rate, p.eligible)]} strokeWidth={2} strokeDasharray="3 3" />
          ))}

        {/* Defensivos */}
        {placed.map(({ p, x, y, cardX, cardY }) => {
          const tier: Tier = rateTier(p.pressure_rate, p.eligible)
          const color = TIER_COLOR[tier]
          const selected = p.nflId === selectedId
          const cx = cardX + CARD_W / 2
          return (
            <g
              key={p.nflId}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${p.displayName}, ${p.position}, presión ${pct(p.pressure_rate)} en ${p.snaps} snaps`}
              onClick={() => onSelect(p.nflId)}
              onKeyDown={(e) => handleKey(e, p.nflId)}
              className="cursor-pointer outline-none [&:focus-visible_.focus-ring]:opacity-100"
            >
              {selected && (
                <circle cx={x} cy={y} r={R + 8} fill="none" stroke="#D50A0A" strokeWidth={5} className="animate-pulse" />
              )}
              <circle className="focus-ring" cx={x} cy={y} r={R + 13} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeDasharray="4 4" opacity={0} />
              <circle cx={x} cy={y} r={R} fill={color} stroke="#FFFFFF" strokeWidth={selected ? 4 : 2.5} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={p.position.length > 3 ? 12 : 14} fontWeight={800} fill={tier === 'na' ? '#FFFFFF' : '#0F172A'}>
                {p.position}
              </text>
              <rect x={cardX} y={cardY} width={CARD_W} height={CARD_H} rx={6} fill="#0F172A" fillOpacity={selected ? 0.95 : 0.85}
                stroke={selected ? '#D50A0A' : color} strokeOpacity={selected ? 1 : 0.6} strokeWidth={selected ? 2 : 1} />
              <text x={cx} y={cardY + 16} textAnchor="middle" fill="#FFFFFF" fontSize={13} fontWeight={700}>
                {shortName(p.displayName)}
              </text>
              <text x={cx} y={cardY + 32} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>
                {pct(p.pressure_rate)} · {p.snaps} sn
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-board-panel px-3 py-2 text-xs text-slate-300">
        <span>Vista desde la defensa · toca un jugador para ver su ficha</span>
        <span className="flex flex-wrap gap-3">
          {(['high', 'mid', 'low', 'na'] as Tier[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_COLOR[t] }} />
              {TIER_LABEL[t]}
            </span>
          ))}
        </span>
      </figcaption>
    </figure>
  )
}
