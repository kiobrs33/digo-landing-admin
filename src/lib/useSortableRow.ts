import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Fila de un `SortableList`: `setNodeRef` y `style` van en la fila; `handle` en su asa de
 * arrastre (`setActivatorRef` + `props`). `dragging` permite elevar la fila mientras se arrastra.
 */
export function useSortableRow(id: string) {
  const sortable = useSortable({ id })
  return {
    setNodeRef: sortable.setNodeRef,
    style: { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition },
    handle: { setActivatorRef: sortable.setActivatorNodeRef, props: { ...sortable.attributes, ...sortable.listeners } },
    dragging: sortable.isDragging,
  }
}

export type DragHandleProps = ReturnType<typeof useSortableRow>['handle']
