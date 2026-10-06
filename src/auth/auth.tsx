import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ApiError, api } from '@/api/client'
import type { AuthUser } from '@/api/types'
import { CloudOff } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { AuthContext, useAuth } from './context'

const meKey = ['auth', 'me']


function useLoginMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: AuthUser }>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ user }) => queryClient.setQueryData(meKey, user),
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const me = useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api<AuthUser>('/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
  const login = useLoginMutation()

  // Cierra la sesión en el cliente: marca "sin usuario" y descarta los datos del resto del panel.
  // No usa `queryClient.clear()`: borraría también la consulta de sesión que está observando
  // AuthProvider y la pantalla quedaría esperando para siempre.
  const endSession = useCallback(() => {
    queryClient.setQueryData(meKey, null)
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] })
  }, [queryClient])

  // Cualquier 401 de la API (sesión vencida o usuario desactivado) devuelve al login.
  useEffect(() => {
    window.addEventListener('digo:unauthorized', endSession)
    return () => window.removeEventListener('digo:unauthorized', endSession)
  }, [endSession])

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    endSession()
  }

  return (
    <AuthContext.Provider
      value={{
        user: me.data ?? null,
        loading: me.isPending,
        error: me.error,
        retry: () => void me.refetch(),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function RequireAuth({ children, role }: { children: ReactNode; role?: AuthUser['role'] }) {
  const { user, loading, error, retry } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Verificando sesión…" />
  // Sin conexión con la API no sabemos si hay sesión: avisar en vez de mandar al login.
  if (error) return <ConnectionError onRetry={retry} />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <CloudOff className="mx-auto size-10 text-navy/40" aria-hidden />
        <h1 className="mt-4 text-lg font-bold text-navy">No se pudo conectar con el servidor</h1>
        <p className="mt-1 text-sm text-muted">
          Revisa tu conexión a internet. Si el problema sigue, el servidor del panel puede estar caído.
        </p>
        <Button className="mt-5" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    </div>
  )
}
