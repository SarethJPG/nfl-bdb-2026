/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Prefijo opcional para las rutas del backend. Vacío = mismo origen / proxy de Vite. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
