import { useEffect, useMemo, useState } from 'react'
import { ApiError, fetchOptimize, fetchTeams } from './api'
import Field from './components/Field'
import Filters from './components/Filters'
import GainSummary from './components/GainSummary'
import PlayerPanel from './components/PlayerPanel'
import { FieldSkeleton, PanelSkeleton, SummarySkeleton } from './components/Skeletons'
import { MIN_SNAPS, SITUATIONS, TEAM_NAMES } from './constants'
import type { OptimizeResponse, Situation } from './types'

type Load<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; error: ApiError }

const DEFAULT_TEAM = 'DAL'

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError('Error inesperado.', 500))

function friendlyMessage(err: ApiError, team: string, situation: Situation): { title: string; body: string } {
  if (err.status === 0) {
    return {
      title: 'Sin conexión con la API',
      body: 'Inicia el backend (uvicorn backend.main:app --port 8000) y recarga la página.',
    }
  }
  if (err.status === 404 || err.status === 422) {
    const sit = SITUATIONS.find((s) => s.value === situation)?.label ?? situation
    return {
      title: 'Muestra insuficiente',
      body: `${TEAM_NAMES[team] ?? team} no tiene suficientes snaps (≥${MIN_SNAPS} por posición) en "${sit}". Prueba otra situación. ${err.message}`,
    }
  }
  return { title: 'No se pudo calcular la alineación', body: err.message }
}

function Notice({ title, body, tone = 'error' }: { title: string; body: string; tone?: 'error' | 'warn' }) {
  const cls = tone === 'error' ? 'border-nfl-red bg-nfl-red/10' : 'border-amber-500 bg-amber-500/10'
  return (
    <div role="alert" className={`rounded-xl border-l-4 p-4 ${cls}`}>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-200">{body}</p>
    </div>
  )
}

export default function App() {
  const [teams, setTeams] = useState<Load<string[]>>({ status: 'loading' })
  const [team, setTeam] = useState('')
  const [situation, setSituation] = useState<Situation>('all')
  const [result, setResult] = useState<Load<OptimizeResponse>>({ status: 'idle' })
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Equipos disponibles (una sola vez)
  useEffect(() => {
    const ctrl = new AbortController()
    fetchTeams(ctrl.signal)
      .then((list) => {
        setTeams({ status: 'ok', data: list })
        setTeam(list.includes(DEFAULT_TEAM) ? DEFAULT_TEAM : (list[0] ?? ''))
      })
      .catch((e) => {
        if (!isAbort(e)) setTeams({ status: 'error', error: toApiError(e) })
      })
    return () => ctrl.abort()
  }, [])

  // Recalcular al cambiar cualquier filtro
  useEffect(() => {
    if (!team) return
    const ctrl = new AbortController()
    setResult({ status: 'loading' })
    fetchOptimize(team, situation, ctrl.signal)
      .then((data) => {
        setResult({ status: 'ok', data })
        setSelectedId((prev) =>
          prev !== null && data.lineup.some((p) => p.nflId === prev) ? prev : (data.lineup[0]?.nflId ?? null),
        )
      })
      .catch((e) => {
        if (!isAbort(e)) setResult({ status: 'error', error: toApiError(e) })
      })
    return () => ctrl.abort()
  }, [team, situation])

  const data = result.status === 'ok' ? result.data : null
  const selected = useMemo(() => data?.lineup.find((p) => p.nflId === selectedId) ?? null, [data, selectedId])
  const loading = teams.status === 'loading' || result.status === 'loading'

  return (
    <div className="min-h-screen bg-board">
      <header className="border-b-4 border-nfl-red bg-nfl-navy">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              kalk <span className="text-nfl-red">NFL</span>
            </h1>
            <p className="text-sm text-blue-100">Frente defensivo óptimo para generar presión al QB</p>
          </div>
          <Filters
            teams={teams.status === 'ok' ? teams.data : []}
            teamsLoading={teams.status === 'loading'}
            team={team}
            situation={situation}
            onTeamChange={setTeam}
            onSituationChange={setSituation}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5" aria-busy={loading}>
        {teams.status === 'error' && <Notice {...friendlyMessage(teams.error, team, situation)} />}
        {teams.status === 'ok' && teams.data.length === 0 && (
          <Notice title="Sin equipos" body="La API no devolvió equipos defensivos disponibles." tone="warn" />
        )}

        {result.status === 'error' && <Notice {...friendlyMessage(result.error, team, situation)} />}

        {(loading || data) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
            <div className="flex min-w-0 flex-col gap-4">
              {data ? <GainSummary data={data} /> : <SummarySkeleton />}
              {data && data.lineup.length > 0 && data.lineup.length < 4 && (
                <Notice
                  tone="warn"
                  title="Alineación incompleta"
                  body={`Solo ${data.lineup.length} jugadores cumplen el mínimo de ${MIN_SNAPS} snaps en esta situación.`}
                />
              )}
              {data && data.lineup.length === 0 ? (
                <Notice tone="warn" title="Sin jugadores elegibles" body={`Ningún jugador llega a ${MIN_SNAPS} snaps en esta situación. Prueba otra.`} />
              ) : data ? (
                <Field lineup={data.lineup} selectedId={selectedId} onSelect={setSelectedId} />
              ) : (
                <FieldSkeleton />
              )}
            </div>

            <aside className="min-w-0">
              {data && selected ? (
                <PlayerPanel player={selected} alternatives={data.alternatives ?? []} />
              ) : !data ? (
                <PanelSkeleton />
              ) : null}
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
