import { MIN_SNAPS, TEAM_CODE_RE, isSituation } from './constants'
import type { LineupPlayer, OptimizeResponse, PositionRate, Situation } from './types'

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

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v : fallback)

export async function fetchTeams(signal?: AbortSignal): Promise<string[]> {
  const body = await getJson('api/teams', signal)
  const raw = Array.isArray(body) ? body : (body as { teams?: unknown })?.teams
  if (!Array.isArray(raw)) throw new ApiError('Respuesta inesperada de /api/teams.', 500)
  const teams = raw.filter((t): t is string => typeof t === 'string' && TEAM_CODE_RE.test(t))
  return [...new Set(teams)].sort()
}

function normalizePosition(r: Partial<PositionRate>, minSnaps: number): PositionRate {
  const snaps = num(r.snaps)
  const sitRate = r.situation_pressure_rate
  return {
    position: str(r.position, '?'),
    pressure_rate: num(r.pressure_rate),
    snaps,
    eligible: typeof r.eligible === 'boolean' ? r.eligible : snaps >= minSnaps,
    is_assigned: r.is_assigned === true,
    situation_pressure_rate: typeof sitRate === 'number' && Number.isFinite(sitRate) ? sitRate : null,
    situation_snaps: num(r.situation_snaps),
  }
}

function normalizePlayer(p: Partial<LineupPlayer>, minSnaps: number): LineupPlayer {
  const nflId = num(p.nflId)
  const snaps = num(p.snaps)
  const rate = num(p.pressure_rate)
  return {
    position: str(p.position, '?'),
    nflId,
    displayName: str(p.displayName, `#${nflId}`),
    officialPosition: str(p.officialPosition, '—'),
    height: typeof p.height === 'string' ? p.height : null,
    weight: typeof p.weight === 'number' ? p.weight : null,
    pressure_rate: rate,
    sacks: num(p.sacks),
    hits: num(p.hits),
    hurries: num(p.hurries),
    snaps,
    eligible: typeof p.eligible === 'boolean' ? p.eligible : snaps >= minSnaps,
    score_rate: num(p.score_rate, rate),
    rate_source: p.rate_source === 'player_average' ? 'player_average' : 'observed',
    habitual_position: typeof p.habitual_position === 'string' ? p.habitual_position : null,
    by_position: Array.isArray(p.by_position) ? p.by_position.map((r) => normalizePosition(r, minSnaps)) : [],
    explanation: str(p.explanation, ''),
  }
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
  const body = (await getJson(`api/optimize?${qs}`, signal)) as Partial<OptimizeResponse> | null
  if (!body || !Array.isArray(body.lineup)) {
    throw new ApiError('Respuesta inesperada de /api/optimize.', 500)
  }
  if (typeof body.optimal_score !== 'number' || typeof body.habitual_score !== 'number') {
    throw new ApiError('La respuesta de /api/optimize no incluye optimal_score / habitual_score.', 500)
  }
  const minSnaps = num(body.min_snaps, MIN_SNAPS)
  const optimal = body.optimal_score
  const habitual = body.habitual_score
  return {
    team: str(body.team, team),
    situation: body.situation && isSituation(body.situation) ? body.situation : situation,
    slots: Array.isArray(body.slots) ? body.slots : [],
    min_snaps: minSnaps,
    notices: Array.isArray(body.notices) ? body.notices.filter((n): n is string => typeof n === 'string') : [],
    completed: body.completed === true,
    lineup: body.lineup.map((p) => normalizePlayer(p, minSnaps)),
    optimal_score: optimal,
    habitual_score: habitual,
    gain: num(body.gain, optimal - habitual),
    gain_pp: num(body.gain_pp, (optimal - habitual) * 100),
    habitual_lineup: Array.isArray(body.habitual_lineup) ? body.habitual_lineup : [],
    alternatives_matrix: Array.isArray(body.alternatives_matrix) ? body.alternatives_matrix : [],
  }
}
