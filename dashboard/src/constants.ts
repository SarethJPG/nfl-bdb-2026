import type { Situation } from './types'

/** Lista blanca de situaciones (selector cerrado). */
export const SITUATIONS: ReadonlyArray<{ value: Situation; label: string }> = [
  { value: 'all', label: 'Todas las jugadas de pase' },
  { value: '3rd_down', label: '3er down' },
  { value: '3rd_long', label: '3er down y largo (7+ yardas)' },
]

export const isSituation = (v: string): v is Situation => SITUATIONS.some((s) => s.value === v)

/** Abreviaturas válidas: 2–3 letras mayúsculas. Cualquier otra cosa se descarta. */
export const TEAM_CODE_RE = /^[A-Z]{2,3}$/

export const TEAM_NAMES: Readonly<Record<string, string>> = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LA: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
}

/** Mínimo de snaps para que una combinación jugador–posición sea elegible (reglas de negocio). */
export const MIN_SNAPS = 5

/** Umbrales del código semántico de PressureRate (fracción 0–1). */
export const RATE_HIGH = 0.1
export const RATE_MID = 0.06

export type Tier = 'high' | 'mid' | 'low' | 'na'

export function rateTier(rate: number, snaps: number): Tier {
  if (snaps < MIN_SNAPS) return 'na'
  if (rate >= RATE_HIGH) return 'high'
  if (rate >= RATE_MID) return 'mid'
  return 'low'
}

export const TIER_COLOR: Readonly<Record<Tier, string>> = {
  high: '#22C55E', // verde
  mid: '#F59E0B', // ámbar
  low: '#EF4444', // rojo
  na: '#64748B', // gris: muestra insuficiente
}

export const TIER_LABEL: Readonly<Record<Tier, string>> = {
  high: 'Alta',
  mid: 'Media',
  low: 'Baja',
  na: `Muestra < ${MIN_SNAPS} snaps`,
}

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`

/**
 * Coordenadas en la cancha SVG (viewBox 800×440), vista desde detrás de la defensa:
 * la izquierda de la pantalla es la izquierda de la defensa, que enfrenta al lado derecho de la ofensiva (RT, RG).
 */
export const OL_X = { RT: 200, RG: 300, C: 400, LG: 500, LT: 600 } as const
export const LOS_Y = 200
export const DL_Y = 250
export const LB_Y = 330

export interface Slot {
  x: number
  y: number
  /** Técnica de alineación (0, 1, 2i, 3, 4, 5, 7, 9). */
  tech: string
}

export const SLOT_LAYOUT: Readonly<Record<string, Slot>> = {
  LEO: { x: 95, y: DL_Y, tech: '9' },
  LE: { x: 165, y: DL_Y, tech: '5' },
  DLT: { x: 265, y: DL_Y, tech: '3' },
  NT: { x: 400, y: DL_Y, tech: '0' },
  NLT: { x: 370, y: DL_Y, tech: '1' },
  NRT: { x: 430, y: DL_Y, tech: '1' },
  DRT: { x: 535, y: DL_Y, tech: '3' },
  RE: { x: 635, y: DL_Y, tech: '5' },
  REO: { x: 705, y: DL_Y, tech: '9' },
  LOLB: { x: 120, y: LB_Y, tech: 'LB' },
  LILB: { x: 330, y: LB_Y, tech: 'LB' },
  MLB: { x: 400, y: LB_Y, tech: 'LB' },
  RILB: { x: 470, y: LB_Y, tech: 'LB' },
  ROLB: { x: 680, y: LB_Y, tech: 'LB' },
}

/** Marcas de técnica sobre la línea de golpeo (referencia visual RF-09). */
export const TECH_MARKS: ReadonlyArray<{ x: number; label: string }> = [
  { x: 95, label: '9' }, { x: 130, label: '7' }, { x: 165, label: '5' }, { x: 200, label: '4' },
  { x: 265, label: '3' }, { x: 300, label: '2' }, { x: 335, label: '2i' }, { x: 370, label: '1' },
  { x: 400, label: '0' }, { x: 430, label: '1' }, { x: 465, label: '2i' }, { x: 500, label: '2' },
  { x: 535, label: '3' }, { x: 600, label: '4' }, { x: 635, label: '5' }, { x: 670, label: '7' },
  { x: 705, label: '9' },
]

/** Nombre corto para el marcador de la cancha ("DeMarcus Lawrence" → "D. Lawrence"). */
export function shortName(name: string): string {
  if (name.length <= 13) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.slice(0, 12) + '…'
  const short = `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  return short.length <= 14 ? short : short.slice(0, 13) + '…'
}
