import type { OptimizeResponse } from '../types'

/** Formato con signo; usa 2 decimales si el valor es muy pequeño para no mostrar un "+0.0" engañoso. */
function signed(v: number, unit: string): string {
  const digits = v !== 0 && Math.abs(v) < 0.1 ? 2 : 1
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(digits)} ${unit}`
}

/**
 * Lo primero que lee el coach. El backend suma el PressureRate de los 4 jugadores (score del frente);
 * aquí se muestra el promedio por jugador como métrica principal y el score acumulado como subtítulo.
 */
export default function GainSummary({ data }: { data: OptimizeResponse }) {
  const { optimal_score, habitual_score, gain_pp } = data
  const n = Math.max(1, data.lineup.length)
  const relative = habitual_score > 0 ? (gain_pp / 100 / habitual_score) * 100 : null
  const positive = gain_pp > 0
  const neutral = gain_pp === 0

  const cards = [
    {
      key: 'habitual',
      title: 'Habitual',
      avg: habitual_score / n,
      total: habitual_score,
      cls: 'bg-board-panel',
      titleCls: 'text-slate-400',
      valueCls: 'text-slate-200',
      subCls: 'text-slate-400',
    },
    {
      key: 'optimal',
      title: 'Óptima',
      avg: optimal_score / n,
      total: optimal_score,
      cls: 'bg-nfl-navy ring-1 ring-white/20',
      titleCls: 'text-blue-100',
      valueCls: 'text-white',
      subCls: 'text-blue-100',
    },
  ]

  return (
    <section aria-label="Resumen de ganancia" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:gap-3">
      {cards.map((c) => (
        <div key={c.key} className={`rounded-xl p-3 sm:p-4 ${c.cls}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider sm:text-xs ${c.titleCls}`}>{c.title}</p>
          <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${c.valueCls}`}>
            {(c.avg * 100).toFixed(1)}%
            <span className="ml-1 text-[11px] font-medium opacity-80">prom./jugador</span>
          </p>
          <p className={`text-[11px] ${c.subCls}`}>
            Score acumulado del frente: <span className="font-semibold tabular-nums">{(c.total * 100).toFixed(1)} pts</span>
          </p>
        </div>
      ))}
      <div className={`rounded-xl p-3 sm:p-4 ${positive ? 'bg-emerald-600' : neutral ? 'bg-slate-600' : 'bg-nfl-red'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/90 sm:text-xs">Ganancia Δ</p>
        <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{signed(gain_pp, 'pts')}</p>
        <p className="text-[11px] text-white/90">
          {neutral
            ? 'La alineación habitual ya es la óptima'
            : `${signed(gain_pp / n, 'pp')} por jugador${relative === null ? '' : ` · ${signed(relative, '%').replace(' %', '%')} vs. habitual`}`}
        </p>
      </div>
    </section>
  )
}
