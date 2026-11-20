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
const H = 440
const OL_Y = 165
const QB_Y = 95

function slotFor(position: string, index: number): Slot {
  return SLOT_LAYOUT[position] ?? { x: 165 + index * 157, y: DL_Y, tech: '?' }
}

/** Cancha pre-snap en SVG: línea ofensiva + los 4 defensivos en su hueco óptimo. */
export default function Field({ lineup, selectedId, onSelect }: Props) {
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
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={i} x={0} y={i * 40} width={W} height={40} fill={i % 2 ? '#1B5E20' : '#2E7D32'} />
        ))}
        {/* Hash marks */}
        {Array.from({ length: 22 }, (_, i) => (
          <g key={i} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2}>
            <line x1={40} x2={52} y1={i * 20 + 10} y2={i * 20 + 10} />
            <line x1={W - 52} x2={W - 40} y1={i * 20 + 10} y2={i * 20 + 10} />
          </g>
        ))}

        {/* Línea de golpeo */}
        <line x1={0} x2={W} y1={LOS_Y} y2={LOS_Y} stroke="#FFFFFF" strokeWidth={3} strokeOpacity={0.9} />
        <text x={12} y={LOS_Y - 8} fill="#FFFFFF" fontSize={12} fontWeight={700} opacity={0.85}>
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

        {/* Defensivos */}
        {lineup.map((p, i) => {
          const s = slotFor(p.position, i)
          const tier: Tier = rateTier(p.pressure_rate, p.snaps)
          const color = TIER_COLOR[tier]
          const selected = p.nflId === selectedId
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
                <circle cx={s.x} cy={s.y} r={33} fill="none" stroke="#D50A0A" strokeWidth={5} className="animate-pulse" />
              )}
              <circle className="focus-ring" cx={s.x} cy={s.y} r={38} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeDasharray="4 4" opacity={0} />
              <circle cx={s.x} cy={s.y} r={25} fill={color} stroke="#FFFFFF" strokeWidth={selected ? 4 : 2.5} />
              <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={tier === 'na' ? '#FFFFFF' : '#0F172A'}>
                {p.position}
              </text>
              <rect x={s.x - 58} y={s.y + 31} width={116} height={38} rx={6} fill="#0F172A" fillOpacity={selected ? 0.95 : 0.8}
                stroke={selected ? '#D50A0A' : 'none'} strokeWidth={2} />
              <text x={s.x} y={s.y + 47} textAnchor="middle" fill="#FFFFFF" fontSize={13} fontWeight={700}>
                {shortName(p.displayName)}
              </text>
              <text x={s.x} y={s.y + 63} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>
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
