/**
 * Contrato del backend (backend/main.py).
 *
 * GET /api/teams    -> { teams: string[], situations: {value,label}[] }
 * GET /api/optimize?team=DAL&situation=3rd_long -> OptimizeResponse
 *
 * Tasas y scores son fracciones (0.172 = 17.2%). El score de un frente es la SUMA
 * de los PressureRate de sus 4 jugadores; gain_pp = (optimal_score - habitual_score) * 100.
 * PressureRate = (1.5*Sacks + 1.0*Hits + 0.7*Hurries) / Snaps
 */

export type Situation = 'all' | '3rd_down' | '3rd_long'

/** Rendimiento del jugador en una posición (by_position). */
export interface PositionRate {
  position: string
  /** Temporada completa (todas las jugadas de pase). */
  pressure_rate: number
  snaps: number
  eligible: boolean
  is_assigned: boolean
  /** En la situación filtrada; null si no tiene snaps ahí. */
  situation_pressure_rate: number | null
  situation_snaps: number
}

/** Uno de los 4 defensivos de la alineación óptima. */
export interface LineupPlayer {
  position: string
  nflId: number
  displayName: string
  officialPosition: string
  height: string | null
  weight: number | null
  /** Métricas en el hueco asignado y la situación filtrada. */
  pressure_rate: number
  sacks: number
  hits: number
  hurries: number
  snaps: number
  eligible: boolean
  /** Tasa que usó el optimizador (observada o promedio del jugador si la muestra es baja). */
  score_rate: number
  rate_source: 'observed' | 'player_average'
  habitual_position: string | null
  by_position: PositionRate[]
  explanation: string
}

export interface HabitualEntry {
  nflId: number
  displayName: string
  position: string | null
  pressure_rate: number
  snaps: number
  source: string
}

export interface MatrixCell {
  pressure_rate: number
  snaps: number
  eligible: boolean
  score_rate: number
}

export interface MatrixRow {
  nflId: number
  displayName: string
  rates: Record<string, MatrixCell | null>
}

export interface OptimizeResponse {
  team: string
  situation: Situation
  slots: string[]
  min_snaps: number
  notices: string[]
  completed: boolean
  lineup: LineupPlayer[]
  optimal_score: number
  habitual_score: number
  gain: number
  gain_pp: number
  habitual_lineup: HabitualEntry[]
  alternatives_matrix: MatrixRow[]
}
