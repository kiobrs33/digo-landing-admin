import { useOutletContext } from 'react-router-dom'
import type { Site } from '@/api/types'

export const contentSections = {
  empresa: 'Datos de la empresa',
  planes: 'Planes',
  carrusel: 'Carrusel',
  redes: 'Redes sociales',
  nosotros: 'Fotos de Nosotros',
  zonas: 'Zonas de cobertura',
} as const

export type ContentSection = keyof typeof contentSections

export type ContentContext = { site: Site; slug: 'hogar' | 'empresas' }

/** Sitio que se está editando (lo leen las pantallas de contenido). */
export function useContentSite() {
  return useOutletContext<ContentContext>()
}

/** Estado de publicación (botón del encabezado): se refresca tras cada cambio de contenido. */
export const publishKey = ['publish'] as const
