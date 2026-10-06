import { useState } from 'react'

/** Utilidades de las tablas del panel (ver `components/DataTable`). */

export const pageSizes = [10, 20, 50, 100]

/** Página de una lista que ya está entera en el navegador (planes, usuarios). */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), pages)
  return { page: current, rows: items.slice((current - 1) * pageSize, current * pageSize) }
}

export const theadClass = 'border-b border-line bg-surface/70 text-xs text-muted'

/** Toda la fila abre el detalle, salvo las casillas, enlaces y botones de la fila. */
export function rowClick(open: () => void) {
  return (event: { target: EventTarget }) => {
    if ((event.target as HTMLElement).closest('input, a, button, select')) return
    open()
  }
}

/** Filas marcadas de la página visible (la `key` de la tabla la reinicia al cambiar de página). */
export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
  const someSelected = !allSelected && ids.some((id) => selected.has(id))
  return {
    selected,
    allSelected,
    someSelected,
    toggle: (id: string) =>
      setSelected((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(ids)),
    clear: () => setSelected(new Set()),
  }
}


/** Filtro aplicado, como chip que se quita con un clic ("Estado: Nuevas ✕"). */
export type FilterChip = { key: string; label: string; value: string; onRemove: () => void }

/**
 * Chips de los filtros con valor. `display` traduce el valor de la URL a texto ("HOGAR" →
 * "Hogar"); sin `display` se muestra tal cual.
 */
export function filterChips<K extends string>(
  filters: Record<K, string>,
  defs: { key: K; label: string; display?: (value: string) => string }[],
  remove: (key: K) => void,
): FilterChip[] {
  return defs
    .filter((def) => filters[def.key])
    .map((def) => ({
      key: def.key,
      label: def.label,
      value: def.display ? def.display(filters[def.key]) : filters[def.key],
      onRemove: () => remove(def.key),
    }))
}

/** Texto del filtro de responsable: "me", "none" o el id de un usuario. */
export function assigneeName(value: string, users: { id: string; name: string }[]) {
  if (value === 'me') return 'Asignadas a mí'
  if (value === 'none') return 'Sin asignar'
  return users.find((user) => user.id === value)?.name ?? 'Otro usuario'
}

/** Fila mientras se arrastra: flota sobre las demás. */
export const draggingRowClass = 'z-20 bg-white shadow-[0_16px_40px_-12px_rgb(4_28_123/0.45)] ring-1 ring-navy/15'
