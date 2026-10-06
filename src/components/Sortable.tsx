import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ReactNode } from 'react'

/**
 * Lista que se reordena arrastrando (con el ratón, el dedo o el teclado). Las filas usan
 * `useSortableRow` y su asa (`DragHandle`). Al soltar en otro lugar llama a `onMove`.
 */
export function SortableList({
  ids,
  names,
  disabled,
  onMove,
  children,
}: {
  ids: string[]
  /** Nombre de cada elemento, para los anuncios del lector de pantalla. */
  names: Record<string, string>
  disabled?: boolean
  onMove: (activeId: string, overId: string) => void
  children: ReactNode
}) {
  const sensors = useSensors(
    // Unos píxeles de margen: un clic en el asa no se confunde con un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const position = (id: string | number) => ids.indexOf(String(id)) + 1
  const name = (id: string | number) => names[String(id)] ?? 'El elemento'

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Levantaste ${name(active.id)}, en el puesto ${position(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} pasaría al puesto ${position(over.id)} de ${ids.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} quedó en el puesto ${position(over.id)} de ${ids.length}.` : `Soltaste ${name(active.id)}.`,
    onDragCancel: ({ active }) => `Cancelado: ${name(active.id)} vuelve al puesto ${position(active.id)}.`,
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para mover, pulsa Espacio, usa las flechas arriba y abajo y pulsa Espacio otra vez para soltar. Escape cancela.',
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
