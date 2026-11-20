/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base opcional del backend (ej. http://127.0.0.1:8000). Vacío = mismo origen / proxy de Vite. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
