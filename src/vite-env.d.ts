/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Webs públicas, para el enlace "Ver la web" tras publicar. */
  readonly VITE_HOGAR_URL?: string
  readonly VITE_EMPRESAS_URL?: string
}
