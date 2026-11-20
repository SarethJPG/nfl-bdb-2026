/**
 * Contrato esperado del backend (backend/main.py).
 *
 * GET /api/teams            -> string[]  (ej. ["ARI","ATL",...])   también se acepta { teams: string[] }
 * GET /api/optimize?team=DAL&situation=3rd_long -> OptimizeResponse
 *
 * Todas las tasas (pressure_rate, *_score, gain) son fracciones 0–1:
 * PressureRate = (1.5*Sacks + 1.0*Hits + 0.7*Hurries) / Snaps
 */

export type Situation = 'all' | '3rd_down' | '3rd_long'

/** Tasa de un jugador en una posición de alineación (pff_positionLinedUp). */
export interface PositionRate {
  position: string
  pressure_rate: number
  snaps: number
}

/** Uno de los 4 defensivos de la alineación óptima. */
export interface LineupPlayer {
  nflId: number
  displayName: string
  officialPosition: string
  height: string | null
  weight: number | null
  /** Hueco asignado por el optimizador (LE, DLT, DRT, RE…). */
  position: string
  pressure_rate: number
  sacks: number
  hits: number
  hurries: number
  snaps: number
  /** Tasas del jugador en todas sus posiciones (incluida la asignada). */
  position_rates?: PositionRate[]
  /** Justificación táctica legible para el coach. */
  explanation?: string
}

/** Celda de la matriz de alternativas jugador × posición. */
export interface AlternativeCell {
  nflId: number
  position: string
  pressure_rate: number
  snaps: number
}

export interface OptimizeResponse {
  team: string
  situation: Situation
  lineup: LineupPlayer[]
  /** Suma de PressureRate de la alineación óptima. */
  optimal_score: number
  /** Suma de PressureRate de la alineación habitual (posición nominal más frecuente). */
  baseline_score: number
  /** optimal_score - baseline_score. */
  gain: number
  /** Matriz de alternativas / explicabilidad de desplazamientos. */
  alternatives?: AlternativeCell[]
}
