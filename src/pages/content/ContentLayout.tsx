import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSpace } from '@/lib/space'
import { usePageTitle } from '@/lib/usePageTitle'
import { type ContentContext, type ContentSection, contentSections } from './site'

/** Lo que solo usa la web de Hogar: en Empresas no se muestra. */
const hogarOnly: ContentSection[] = ['planes', 'carrusel', 'nosotros', 'zonas']

/**
 * Marco de las pantallas de contenido del espacio actual (publicar está en el encabezado). Los
 * formularios (`…/nuevo`, `…/:itemId`) son vistas aparte: solo reciben el sitio, sin el marco.
 */
export function ContentLayout() {
  const space = useSpace()
  const [, , , section = '', item] = useLocation().pathname.split('/')
  const sectionLabel = contentSections[section as ContentSection]
  const isForm = Boolean(item)
  usePageTitle(!isForm && sectionLabel ? `${sectionLabel} · ${space.name}` : undefined)
  if (!(section in contentSections) || (space.slug === 'empresas' && hogarOnly.includes(section as ContentSection))) {
    return <Navigate to={`/${space.slug}/contenido/empresa`} replace />
  }
  const context = { site: space.site, slug: space.slug } satisfies ContentContext
  if (isForm) return <Outlet context={context} />

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{sectionLabel}</h1>
        <p className="mt-1 text-sm text-muted">
          Contenido de la web de {space.name}:{' '}
          <a href={space.url} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">
            {space.domain}
          </a>
        </p>
      </header>
      <Outlet context={context} />
    </>
  )
}
