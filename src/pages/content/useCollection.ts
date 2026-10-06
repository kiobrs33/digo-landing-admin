import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { arrayMove } from '@dnd-kit/sortable'
import { api } from '@/api/client'
import type { Site } from '@/api/types'
import { useToast } from '@/lib/toast-context'
import { publishKey } from './site'

/**
 * Estado y acciones de una colección ordenable de un sitio (planes, carrusel, redes, fotos):
 * listar, crear/editar, eliminar y reordenar. Cada cambio refresca el estado de publicación.
 */
export function useCollection<T extends { id: string }, Body>(site: Site, resource: string) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const base = `/admin/sites/${site.toLowerCase()}/${resource}`
  const key = ['content', site, resource]
  const afterChange = () => queryClient.invalidateQueries({ queryKey: publishKey })

  const list = useQuery({ queryKey: key, queryFn: () => api<T[]>(base) })

  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Body }) =>
      id ? api<T>(`${base}/${id}`, { method: 'PUT', body }) : api<T>(base, { method: 'POST', body }),
    onSuccess: async (_data, { id }) => {
      await queryClient.invalidateQueries({ queryKey: key })
      void afterChange()
      toast({ message: `${id ? 'Cambios guardados' : 'Agregado'}. Publica para verlo en la web.` })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key })
      void afterChange()
      toast({ message: 'Eliminado. Publica para quitarlo de la web.' })
    },
  })

  // Optimista: la lista se reordena al instante y vuelve atrás si el servidor falla.
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api(`${base}/order`, { method: 'PUT', body: { ids } }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<T[]>(key)
      if (previous) {
        const byId = new Map(previous.map((item) => [item.id, item]))
        queryClient.setQueryData(key, ids.map((id) => byId.get(id)!))
      }
      return { previous }
    },
    onError: (_error, _ids, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void afterChange()
    },
  })

  /** Cambia un elemento de puesto (el orden de la lista es el de la web). */
  const moveTo = (from: number, to: number) => {
    const items = list.data
    if (!items || from === to || to < 0 || to >= items.length) return
    const ids = arrayMove(
      items.map((item) => item.id),
      from,
      to,
    )
    reorder.mutate(ids)
  }
  /** Arrastrar y soltar: `activeId` pasa al lugar que ocupaba `overId`. */
  const moveById = (activeId: string, overId: string) => {
    const ids = list.data?.map((item) => item.id) ?? []
    moveTo(ids.indexOf(activeId), ids.indexOf(overId))
  }

  return { list, save, remove, reorder, moveById }
}

