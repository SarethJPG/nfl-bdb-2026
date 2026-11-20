import { pct } from '../constants'
import type { OptimizeResponse } from '../types'

/** Lo primero que lee el coach: presión total óptima vs. habitual y la ganancia Δ. */
export default function GainSummary({ data }: { data: OptimizeResponse }) {
  const { optimal_score, baseline_score, gain } = data
  const relative = baseline_score > 0 ? gain / baseline_score : null
  const positive = gain >= 0
  const totalSnaps = data.lineup.reduce((acc, p) => acc + p.snaps, 0)

  return (
    <section aria-label="Resumen de ganancia" className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-xl bg-board-panel p-3 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">Habitual</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-slate-200 sm:text-2xl">{pct(baseline_score)}</p>
        <p className="text-[11px] text-slate-400">posición nominal</p>
      </div>
      <div className="rounded-xl bg-nfl-navy p-3 ring-1 ring-white/20 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-100 sm:text-xs">Óptima</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-white sm:text-2xl">{pct(optimal_score)}</p>
        <p className="text-[11px] text-blue-100">{totalSnaps.toLocaleString('es-MX')} snaps de respaldo</p>
      </div>
      <div className={`rounded-xl p-3 sm:p-4 ${positive ? 'bg-emerald-600' : 'bg-nfl-red'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/90 sm:text-xs">Ganancia Δ</p>
        <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">
          {positive ? '+' : ''}
          {(gain * 100).toFixed(1)} pp
        </p>
        <p className="text-[11px] text-white/90">
          {relative === null ? 'sin baseline' : `${positive ? '+' : ''}${(relative * 100).toFixed(0)}% relativo`}
        </p>
      </div>
    </section>
  )
}
