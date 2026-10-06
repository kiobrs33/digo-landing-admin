import { createContext, useContext } from 'react'
import type { Site } from '@/api/types'

/**
 * Espacios del panel: Digo Hogar (clientes residenciales) y Digo Empresas (empresas e
 * instituciones). Cada uno tiene su web, su contenido, sus consultas y reclamos, su color y
 * su equipo; el panel nunca los mezcla.
 */
export type SpaceSlug = 'hogar' | 'empresas'

export type Space = {
  slug: SpaceSlug
  site: Site
  name: string
  /** Dominio de su web pública. */
  domain: string
  url: string
  /** A quién atiende, para el selector de espacio. */
  audience: string
}

export const spaces: Record<SpaceSlug, Space> = {
  hogar: {
    slug: 'hogar',
    site: 'HOGAR',
    name: 'Digo Hogar',
    domain: 'digo.net.pe',
    url: import.meta.env.VITE_HOGAR_URL || 'https://www.digo.net.pe',
    audience: 'Clientes residenciales',
  },
  empresas: {
    slug: 'empresas',
    site: 'EMPRESAS',
    name: 'Digo Empresas',
    domain: 'digoempresas.pe',
    url: import.meta.env.VITE_EMPRESAS_URL || 'https://digoempresas.pe',
    audience: 'Empresas e instituciones',
  },
}

export const spaceList = Object.values(spaces)

export const spaceOfSite = (site: Site) => (site === 'EMPRESAS' ? spaces.empresas : spaces.hogar)

export const isSpaceSlug = (value: string | undefined): value is SpaceSlug => value === 'hogar' || value === 'empresas'

/** Espacios a los que el usuario tiene acceso. */
export const allowedSpaces = (sites: Site[] | undefined) => spaceList.filter((space) => sites?.includes(space.site))

/** El último espacio usado: al entrar al panel (o a Usuarios / Mi perfil) se vuelve a él. */
const LAST_KEY = 'digo:espacio'
export function lastSpace(): SpaceSlug | null {
  try {
    const value = localStorage.getItem(LAST_KEY) ?? undefined
    return isSpaceSlug(value) ? value : null
  } catch {
    return null
  }
}
export function rememberSpace(slug: SpaceSlug) {
  try {
    localStorage.setItem(LAST_KEY, slug)
  } catch {
    /* sin almacenamiento: se vuelve al primer espacio permitido */
  }
}

export const SpaceContext = createContext<Space>(spaces.hogar)

/** Espacio en el que se está trabajando. */
export const useSpace = () => useContext(SpaceContext)

/** Ruta dentro del espacio actual: `path('/reclamos')` → `/empresas/reclamos`. */
export function useSpacePath() {
  const space = useSpace()
  return (path = '') => `/${space.slug}${path}`
}
