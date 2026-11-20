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

/** Nivel semántico; `eligible` viene del backend (snaps >= min_snaps). */
export function rateTier(rate: number, eligible: boolean): Tier {
  if (!eligible) return 'na'
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
 * Coordenadas en la cancha SVG (viewBox 800×470), vista desde detrás de la defensa:
 * la izquierda de la pantalla es la izquierda de la defensa, que enfrenta al lado derecho de la ofensiva (RT, RG).
 */
export const OL_X = { RT: 220, RG: 310, C: 400, LG: 490, LT: 580 } as const
export const LOS_Y = 200
export const DL_Y = 250
export const LB_Y = 345

export interface Slot {
  x: number
  y: number
  /** Técnica de alineación (0, 1, 2i, 3, 4, 5, 7, 9). */
  tech: string
}

/**
 * Cada hueco tiene su propia X; los adyacentes del borde (LOLB↔LEO↔LE, RE↔REO↔ROLB) quedan a ≥ 70 px
 * para que los marcadores no se toquen. Las tarjetas de nombre se alternan en Y dentro de Field.tsx.
 */
export const SLOT_LAYOUT: Readonly<Record<string, Slot>> = {
  // OLB de pass rush: de pie en el borde, por fuera de la 9-tech
  LOLB: { x: 45, y: DL_Y, tech: 'OLB' },
  LEO: { x: 115, y: DL_Y, tech: '9' },
  LE: { x: 190, y: DL_Y, tech: '5' },
  DLT: { x: 280, y: DL_Y, tech: '3' },
  NLT: { x: 365, y: DL_Y, tech: '1' },
  NT: { x: 400, y: DL_Y, tech: '0' },
  NRT: { x: 435, y: DL_Y, tech: '1' },
  DRT: { x: 520, y: DL_Y, tech: '3' },
  RE: { x: 610, y: DL_Y, tech: '5' },
  REO: { x: 685, y: DL_Y, tech: '9' },
  ROLB: { x: 755, y: DL_Y, tech: 'OLB' },
  LLB: { x: 290, y: LB_Y, tech: 'LB' },
  LILB: { x: 320, y: LB_Y, tech: 'LB' },
  MLB: { x: 400, y: LB_Y, tech: 'LB' },
  RILB: { x: 480, y: LB_Y, tech: 'LB' },
  RLB: { x: 510, y: LB_Y, tech: 'LB' },
}

/** Marcas de técnica sobre la línea de golpeo (referencia visual RF-09). */
export const TECH_MARKS: ReadonlyArray<{ x: number; label: string }> = [
  { x: 115, label: '9' }, { x: 155, label: '7' }, { x: 190, label: '5' }, { x: 220, label: '4' },
  { x: 280, label: '3' }, { x: 310, label: '2' }, { x: 338, label: '2i' }, { x: 365, label: '1' },
  { x: 400, label: '0' }, { x: 435, label: '1' }, { x: 462, label: '2i' }, { x: 490, label: '2' },
  { x: 520, label: '3' }, { x: 580, label: '4' }, { x: 610, label: '5' }, { x: 645, label: '7' },
  { x: 685, label: '9' },
]

/** Nombre corto para el marcador de la cancha ("DeMarcus Lawrence" → "D. Lawrence"). */
export function shortName(name: string): string {
  if (name.length <= 13) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.slice(0, 12) + '…'
  const short = `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  return short.length <= 14 ? short : short.slice(0, 13) + '…'
}
