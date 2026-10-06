import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Assignable } from '@/api/types'
import { useSpace } from '@/lib/space'

/** Usuarios activos que pueden ser responsables en el espacio actual (cualquier rol). */
export function useAssignable() {
  const { site } = useSpace()
  return useQuery({
    queryKey: ['users', 'assignable', site],
    queryFn: () => api<Assignable[]>('/admin/users/assignable', { query: { site } }),
    staleTime: 5 * 60_000,
  })
}
