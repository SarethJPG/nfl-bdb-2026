import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SLOT_LAYOUT, TIER_COLOR, TIER_LABEL, pct, rateTier, type Tier } from '../constants'
import type { LineupPlayer } from '../types'

interface Props {
  player: LineupPlayer
  minSnaps: number
}

type Kind = 'assigned' | 'eligible' | 'low'

interface Row {
  position: string
  rate: number // en %
  snaps: number
  kind: Kind
  tier: Tier
  label: string
  sitRate: number | null
  sitSnaps: number
}

const LOW_SAMPLE = TIER_COLOR.na

/** Todas las posiciones que devuelve el backend (by_position, temporada completa), en su orden (más snaps primero). */
function buildRows(player: LineupPlayer): Row[] {
  const rows: Row[] = player.by_position.map((r) => {
    const assigned = r.is_assigned || r.position === player.position
    return {
      position: r.position,
      rate: +(r.pressure_rate * 100).toFixed(1),
      snaps: r.snaps,
      kind: assigned ? 'assigned' : r.eligible ? 'eligible' : 'low',
      tier: rateTier(r.pressure_rate, r.eligible),
      label: `${(r.pressure_rate * 100).toFixed(1)}%`,
      sitRate: r.situation_pressure_rate,
      sitSnaps: r.situation_snaps,
    }
  })
  if (!rows.some((r) => r.kind === 'assigned')) {
    rows.unshift({
      position: player.position,
      rate: +(player.pressure_rate * 100).toFixed(1),
      snaps: player.snaps,
      kind: 'assigned',
      tier: rateTier(player.pressure_rate, player.eligible),
      label: `${(player.pressure_rate * 100).toFixed(1)}%`,
      sitRate: player.pressure_rate,
      sitSnaps: player.snaps,
    })
  }
  return rows
}

function barFill(r: Row): string {
  if (r.tier === 'na') return LOW_SAMPLE
  return TIER_COLOR[r.tier]
}

function formatHeight(h: string | null): string {
  if (!h) return '—'
  const m = /^(\d)-(\d{1,2})$/.exec(h)
  return m ? `${m[1]}'${m[2]}"` : h
}

const KIND_TEXT: Record<Kind, string> = {
  assigned: 'posición asignada',
  eligible: 'elegible',
  low: 'muestra baja',
}

function ChartTooltip({ active, payload, minSnaps }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Row }>; minSnaps: number }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-md border border-slate-600 bg-board px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-white">
        {row.position} <span className={row.kind === 'assigned' ? 'text-nfl-red' : 'text-slate-400'}>· {KIND_TEXT[row.kind]}</span>
      </p>
      <p className="text-slate-200">Temporada: {row.rate.toFixed(1)}% · {row.snaps} snaps</p>
      <p className="text-slate-400">
        En la situación: {row.sitRate === null ? 'sin snaps' : `${(row.sitRate * 100).toFixed(1)}% · ${row.sitSnaps} snaps`}
      </p>
      {row.kind === 'low' && <p className="text-amber-400">Menos de {minSnaps} snaps: no elegible</p>}
    </div>
  )
}

const STATS: ReadonlyArray<{ key: 'sacks' | 'hits' | 'hurries' | 'snaps'; label: string }> = [
  { key: 'sacks', label: 'Sacks' },
  { key: 'hits', label: 'Hits' },
  { key: 'hurries', label: 'Hurries' },
  { key: 'snaps', label: 'Snaps' },
]

/** Ficha del jugador seleccionado: métricas reales + comparativa de PressureRate por posición. */
export default function PlayerPanel({ player, minSnaps }: Props) {
  const rows = buildRows(player)
  const tier = rateTier(player.pressure_rate, player.eligible)
  const tech = SLOT_LAYOUT[player.position]?.tech
  const crowded = rows.length > 6

  return (
    <section aria-live="polite" aria-label={`Ficha de ${player.displayName}`} className="flex flex-col gap-4 rounded-xl bg-board-panel p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-nfl-red">
            Asignado a {player.position}
            {tech && /^\d/.test(tech) ? ` · técnica ${tech}` : ''}
          </p>
          <h2 className="truncate text-xl font-bold text-white sm:text-2xl">{player.displayName}</h2>
          <p className="text-sm text-slate-300">
            {player.officialPosition} · {formatHeight(player.height)} · {player.weight ? `${player.weight} lbs` : '—'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-extrabold tabular-nums sm:text-3xl" style={{ color: TIER_COLOR[tier] }}>
            {pct(player.pressure_rate)}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-slate-400">PressureRate · {TIER_LABEL[tier]}</p>
        </div>
      </header>

      <dl className="grid grid-cols-4 gap-2">
        {STATS.map((s) => (
          <div key={s.key} className={`rounded-lg p-2 text-center sm:p-3 ${s.key === 'snaps' ? 'bg-nfl-navy' : 'bg-board'}`}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">{s.label}</dt>
            <dd className="text-lg font-bold tabular-nums text-white sm:text-xl">{player[s.key]}</dd>
          </div>
        ))}
      </dl>
      {player.rate_source === 'player_average' && (
        <p className="-mt-2 text-xs text-amber-400">
          Menos de {minSnaps} snaps en {player.position}: el optimizador usó su promedio ({pct(player.score_rate)}).
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-200">PressureRate por posición alineada</h3>
        <p className="mb-2 text-[11px] text-slate-400">Temporada completa · {rows.length} posiciones registradas</p>
        <div className="h-60 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 20, right: 8, left: -12, bottom: crowded ? 16 : 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="position"
                interval={0}
                tick={{ fill: '#CBD5E1', fontSize: crowded ? 10 : 12 }}
                angle={crowded ? -35 : 0}
                textAnchor={crowded ? 'end' : 'middle'}
                axisLine={{ stroke: '#475569' }}
                tickLine={false}
              />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip minSnaps={minSnaps} />} cursor={{ fill: '#FFFFFF', fillOpacity: 0.06 }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell
                    key={r.position}
                    fill={barFill(r)}
                    fillOpacity={r.kind === 'assigned' ? 1 : r.kind === 'eligible' ? 0.7 : 0.45}
                    stroke={r.kind === 'assigned' ? '#FFFFFF' : 'none'}
                    strokeWidth={r.kind === 'assigned' ? 2.5 : 0}
                  />
                ))}
                {!crowded && <LabelList dataKey="label" position="top" fill="#E2E8F0" fontSize={11} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-white bg-emerald-500" /> Asignada
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/70" /> Elegible (≥ {minSnaps} snaps)
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: LOW_SAMPLE, opacity: 0.6 }} /> Muestra baja (&lt; {minSnaps} snaps)
          </li>
        </ul>
      </div>

      {player.explanation && (
        <div className="rounded-lg border-l-4 border-nfl-red bg-board p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Por qué aquí</p>
          <p className="mt-1 text-sm text-slate-100">{player.explanation}</p>
        </div>
      )}
    </section>
  )
}
