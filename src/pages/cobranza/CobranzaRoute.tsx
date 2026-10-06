import { Navigate, Outlet, useParams } from 'react-router-dom'
import { RequireAuth } from '@/auth/auth'

/** Cobranza es solo de Digo Hogar y solo para administradores. */
export function CobranzaRoute() {
  const { space } = useParams()
  if (space !== 'hogar') return <Navigate to={`/${space ?? ''}`} replace />
  return (
    <RequireAuth role="ADMIN">
      <Outlet />
    </RequireAuth>
  )
}
