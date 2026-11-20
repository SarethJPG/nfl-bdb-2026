import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MIN_SNAPS, SLOT_LAYOUT, TIER_COLOR, TIER_LABEL, pct, rateTier, type Tier } from '../constants'
import type { AlternativeCell, LineupPlayer, PositionRate } from '../types'

interface Props {
  player: LineupPlayer
  alternatives: AlternativeCell[]
}

interface Row {
  position: string
  rate: number // en %
  snaps: number
  assigned: boolean
  tier: Tier
  label: string
}

function buildRows(player: LineupPlayer, alternatives: AlternativeCell[]): Row[] {
  const source: PositionRate[] =
    player.position_rates && player.position_rates.length > 0
      ? player.position_rates
      : alternatives.filter((a) => a.nflId === player.nflId)

  const byPos = new Map<string, PositionRate>()
  for (const r of source) byPos.set(r.position, r)
  // La posición asignada siempre aparece, con las métricas del contexto actual.
  byPos.set(player.position, { position: player.position, pressure_rate: player.pressure_rate, snaps: player.snaps })

  return [...byPos.values()]
    .map((r) => ({
      position: r.position,
      rate: +(r.pressure_rate * 100).toFixed(1),
      snaps: r.snaps,
      assigned: r.position === player.position,
      tier: rateTier(r.pressure_rate, r.snaps),
      label: `${(r.pressure_rate * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.rate - a.rate)
}

function fallbackExplanation(player: LineupPlayer, rows: Row[]): string {
  const others = rows.filter((r) => !r.assigned && r.snaps >= MIN_SNAPS)
  if (others.length === 0) {
    return `Solo tiene muestra suficiente (≥${MIN_SNAPS} snaps) como ${player.position}: ${pct(player.pressure_rate)} en ${player.snaps} snaps.`
  }
  const best = others[0]
  return `Genera ${pct(player.pressure_rate)} de presión alineado como ${player.position} (${player.snaps} snaps) frente a ${best.rate.toFixed(1)}% como ${best.position} (${best.snaps} snaps).`
}

function formatHeight(h: string | null): string {
  if (!h) return '—'
  const m = /^(\d)-(\d{1,2})$/.exec(h)
  return m ? `${m[1]}'${m[2]}"` : h
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Row }> }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-md border border-slate-600 bg-board px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-white">
        {row.position} {row.assigned && <span className="text-nfl-red">· asignada</span>}
      </p>
      <p className="text-slate-200">PressureRate: {row.rate.toFixed(1)}%</p>
      <p className="text-slate-400">
        {row.snaps} snaps{row.tier === 'na' ? ` (muestra < ${MIN_SNAPS})` : ''}
      </p>
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
export default function PlayerPanel({ player, alternatives }: Props) {
  const rows = buildRows(player, alternatives)
  const tier = rateTier(player.pressure_rate, player.snaps)
  const tech = SLOT_LAYOUT[player.position]?.tech
  const explanation = player.explanation?.trim() || fallbackExplanation(player, rows)

  return (
    <section aria-live="polite" aria-label={`Ficha de ${player.displayName}`} className="flex flex-col gap-4 rounded-xl bg-board-panel p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-nfl-red">
            Asignado a {player.position}
            {tech && tech !== '?' && tech !== 'LB' ? ` · técnica ${tech}` : ''}
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

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">PressureRate por posición alineada</h3>
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="position" tick={{ fill: '#CBD5E1', fontSize: 12 }} axisLine={{ stroke: '#475569' }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#FFFFFF', fillOpacity: 0.06 }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell
                    key={r.position}
                    fill={TIER_COLOR[r.tier]}
                    fillOpacity={r.assigned ? 1 : 0.55}
                    stroke={r.assigned ? '#FFFFFF' : 'none'}
                    strokeWidth={r.assigned ? 2 : 0}
                  />
                ))}
                <LabelList dataKey="label" position="top" fill="#E2E8F0" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Barra con borde blanco = posición asignada. Gris = menos de {MIN_SNAPS} snaps (no elegible).
        </p>
      </div>

      <div className="rounded-lg border-l-4 border-nfl-red bg-board p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Por qué aquí</p>
        <p className="mt-1 text-sm text-slate-100">{explanation}</p>
      </div>
    </section>
  )
}
