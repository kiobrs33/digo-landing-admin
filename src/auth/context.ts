import type { UseMutationResult } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import type { AuthUser } from '@/api/types'

// Contexto aparte de los componentes: así la recarga en caliente de auth.tsx no crea un
// contexto nuevo que deje al resto del panel sin sesión.
export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  error: unknown
  retry: () => void
  login: UseMutationResult<{ user: AuthUser }, Error, { email: string; password: string }>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
