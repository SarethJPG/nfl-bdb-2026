import { SITUATIONS, TEAM_NAMES, isSituation } from '../constants'
import type { Situation } from '../types'

interface Props {
  teams: string[]
  teamsLoading: boolean
  team: string
  situation: Situation
  onTeamChange: (team: string) => void
  onSituationChange: (s: Situation) => void
}

const selectCls =
  'w-full min-h-11 rounded-lg border border-slate-600 bg-board px-3 py-2 text-sm font-medium text-white ' +
  'focus:border-nfl-red focus:outline-none focus:ring-2 focus:ring-nfl-red/40 disabled:opacity-50'

/** Únicos controles de la pantalla. Al cambiar un valor se recalcula automáticamente (sin botón extra). */
export default function Filters({ teams, teamsLoading, team, situation, onTeamChange, onSituationChange }: Props) {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[560px]">
      <div>
        <label htmlFor="team" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Equipo defensivo
        </label>
        <select
          id="team"
          className={selectCls}
          value={team}
          disabled={teamsLoading || teams.length === 0}
          onChange={(e) => {
            if (teams.includes(e.target.value)) onTeamChange(e.target.value)
          }}
        >
          {teamsLoading && <option value="">Cargando equipos…</option>}
          {!teamsLoading && teams.length === 0 && <option value="">Sin equipos disponibles</option>}
          {teams.map((t) => (
            <option key={t} value={t}>
              {TEAM_NAMES[t] ? `${t} · ${TEAM_NAMES[t]}` : t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="situation" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Situación de juego
        </label>
        <select
          id="situation"
          className={selectCls}
          value={situation}
          onChange={(e) => {
            if (isSituation(e.target.value)) onSituationChange(e.target.value)
          }}
        >
          {SITUATIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
