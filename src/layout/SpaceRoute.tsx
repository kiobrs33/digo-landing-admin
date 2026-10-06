import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { isSpaceSlug, rememberSpace, spaces } from '@/lib/space'
import { useHomeSpace } from '@/lib/useHomeSpace'

/**
 * `/:space/...`: valida el espacio de la URL y que el usuario tenga acceso. Si no, lo lleva a uno
 * permitido (misma sección si existe). Recuerda el espacio para la próxima vez.
 */
export function SpaceRoute() {
  const { space = '' } = useParams()
  const { pathname, search } = useLocation()
  const { user } = useAuth()
  const home = useHomeSpace()
  const allowed = isSpaceSlug(space) && Boolean(user?.sites.includes(spaces[space].site))

  useEffect(() => {
    if (allowed && isSpaceSlug(space)) rememberSpace(space)
  }, [allowed, space])

  if (!allowed) {
    const rest = isSpaceSlug(space) ? pathname.slice(space.length + 1) : ''
    return <Navigate to={`/${home.slug}${rest}${search}`} replace />
  }
  return <Outlet />
}

/** `/`: entra al espacio de siempre. */
export function SpaceHomeRedirect() {
  const home = useHomeSpace()
  return <Navigate to={`/${home.slug}`} replace />
}

/**
 * Enlaces de antes de los espacios (`/reclamos/…`, `/consultas/…`, `/contenido/hogar/…`):
 * llevan a la misma vista dentro del espacio que corresponde.
 */
export function LegacyRedirect() {
  const { pathname, search } = useLocation()
  const home = useHomeSpace()
  const content = pathname.match(/^\/contenido\/(hogar|empresas)(\/.*)?$/)
  const target = content ? `/${content[1]}/contenido${content[2] ?? ''}` : `/${home.slug}${pathname}`
  return <Navigate to={`${target}${search}`} replace />
}
