import { TEAM_CODE_RE, isSituation } from './constants'
import type { OptimizeResponse, Situation } from './types'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    /** 0 = sin conexión con el backend. */
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('No se pudo conectar con la API.', 0)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* cuerpo no JSON */
    }
    throw new ApiError(detail, res.status)
  }
  return res.json()
}

export async function fetchTeams(signal?: AbortSignal): Promise<string[]> {
  const body = await getJson('/api/teams', signal)
  const raw = Array.isArray(body) ? body : (body as { teams?: unknown })?.teams
  if (!Array.isArray(raw)) throw new ApiError('Respuesta inesperada de /api/teams.', 500)
  const teams = raw.filter((t): t is string => typeof t === 'string' && TEAM_CODE_RE.test(t))
  return [...new Set(teams)].sort()
}

export async function fetchOptimize(
  team: string,
  situation: Situation,
  signal?: AbortSignal,
): Promise<OptimizeResponse> {
  // Validación previa en cliente; el backend vuelve a validar con Pydantic.
  if (!TEAM_CODE_RE.test(team) || !isSituation(situation)) {
    throw new ApiError('Parámetros inválidos.', 422)
  }
  const qs = new URLSearchParams({ team, situation }).toString()
  const body = (await getJson(`/api/optimize?${qs}`, signal)) as Partial<OptimizeResponse>
  if (!body || !Array.isArray(body.lineup)) {
    throw new ApiError('Respuesta inesperada de /api/optimize.', 500)
  }
  const optimal = Number(body.optimal_score ?? 0)
  const baseline = Number(body.baseline_score ?? 0)
  return {
    team: body.team ?? team,
    situation: body.situation ?? situation,
    lineup: body.lineup,
    optimal_score: optimal,
    baseline_score: baseline,
    gain: typeof body.gain === 'number' ? body.gain : optimal - baseline,
    alternatives: body.alternatives ?? [],
  }
}
