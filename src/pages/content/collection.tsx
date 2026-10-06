import { ArrowDownUp, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, DetailSkeleton, EmptyState, ErrorNotice, PageHeader } from '@/components/ui'
import { useCrumbLabel } from '@/lib/crumbs'
import { draggingRowClass } from '@/lib/table'
import { type DragHandleProps, useSortableRow } from '@/lib/useSortableRow'
import { cx } from '@/lib/cx'
import { usePageTitle } from '@/lib/usePageTitle'
import { contentSections, useContentSite } from './site'
import { useCollection } from './useCollection'

/** Fila de una colección: asa para arrastrar + contenido + editar (en su vista) + eliminar (con confirmación). */
export function CollectionRow({
  id,
  index,
  name,
  active,
  editTo,
  onDelete,
  deleting,
  children,
}: {
  id: string
  index: number
  /** Nombre del elemento para los lectores de pantalla. */
  name: string
  active: boolean
  /** Vista de edición del elemento, relativa a la lista. */
  editTo: string
  onDelete: () => void
  deleting: boolean
  children: ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const { setNodeRef, style, handle, dragging } = useSortableRow(id)
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cx(
        'relative flex flex-wrap items-center gap-x-4 gap-y-3 bg-white px-4 py-3 sm:flex-nowrap',
        dragging && draggingRowClass,
      )}
    >
      <OrderCell index={index} name={name} handle={handle} />
      <div className={cx('min-w-0 flex-1', !active && 'opacity-60')}>{children}</div>
      {!active && <Badge tone="neutral">Oculto</Badge>}
      <div className="flex w-full justify-end gap-1 sm:w-auto">
        {confirming ? (
          <>
            <Button variant="danger" loading={deleting} onClick={onDelete}>
              Sí, eliminar
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Link
              to={editTo}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-surface-alt"
            >
              <Pencil className="size-4" aria-hidden />
              Editar
            </Link>
            <Button variant="ghost" className="text-muted hover:bg-red-50 hover:text-red-700" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Eliminar</span>
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

/**
 * Asa para arrastrar y puesto en la web. Con `disabledReason` el asa se desactiva (el motivo lo
 * explica la nota de la lista y lo leen los lectores de pantalla).
 */
export function OrderCell({
  index,
  name,
  handle: { setActivatorRef, props },
  disabledReason,
}: {
  index: number
  name: string
  handle: DragHandleProps
  disabledReason?: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        ref={setActivatorRef}
        {...props}
        disabled={Boolean(disabledReason)}
        aria-label={disabledReason ? `Mover ${name}: ${disabledReason}` : `Mover ${name}, en el puesto ${index + 1}`}
        className="-ml-1 grid h-10 w-6 touch-none place-items-center rounded-md text-muted/70 transition-colors enabled:cursor-grab enabled:hover:bg-surface-alt enabled:hover:text-navy enabled:active:cursor-grabbing disabled:pointer-events-none disabled:opacity-30"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="grid size-7 place-items-center rounded-md bg-navy/8 text-xs font-bold text-navy tabular-nums" aria-hidden>
        {index + 1}
      </span>
    </div>
  )
}

/** Fila de tabla arrastrable: `children` recibe el asa para ponerla en su `OrderCell`. */
export function SortableTr({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const { setNodeRef, style, handle, dragging } = useSortableRow(id)
  return (
    <tr ref={setNodeRef} style={style} className={cx('relative bg-white', className, dragging && draggingRowClass)}>
      {children(handle)}
    </tr>
  )
}

/** Nota sobre una lista ordenable: el orden de la lista es el de la web. */
export function OrderHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted">
      <ArrowDownUp className="mt-0.5 size-4 shrink-0 text-navy/60" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Interruptor accesible para "Visible en la landing". */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className={cx(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-magenta',
          checked ? 'bg-navy' : 'bg-navy/20',
        )}
      >
        <span className={cx('size-4 rounded-full bg-white shadow transition-transform duration-150', checked && 'translate-x-4')} />
      </span>
      <span className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}

/** Enlace "Nuevo …" de la cabecera de una lista: abre el formulario en su propia vista. */
export function NewItemLink({ children }: { children: ReactNode }) {
  return (
    <Link
      to="nuevo"
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy ring-1 ring-line transition-colors hover:bg-surface-alt"
    >
      {children}
    </Link>
  )
}

export type EditorProps<Body> = {
  saving: boolean
  error: unknown
  onSave: (body: Body) => void
  onCancel: () => void
}

/**
 * Vista de crear/editar un elemento de una colección (`…/nuevo` o `…/:itemId`). Carga el
 * elemento de la lista, registra su nombre en las migas y, al guardar o cancelar, vuelve a la lista.
 */
export function CollectionEditor<T extends { id: string }, Body>({
  resource,
  newTitle,
  name,
  children,
}: {
  resource: string
  /** Título al crear: "Nuevo plan", "Nueva pieza"… */
  newTitle: string
  /** Nombre del elemento para el título y la miga. */
  name: (item: T) => string
  children: (item: T | null, props: EditorProps<Body>) => ReactNode
}) {
  const { site, slug } = useContentSite()
  const { itemId } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const section = pathname.split('/')[3] as keyof typeof contentSections
  const { list, save } = useCollection<T, Body>(site, resource)
  const item = itemId ? (list.data?.find((entry) => entry.id === itemId) ?? null) : null
  const title = item ? `Editar ${name(item)}` : newTitle
  const listPath = `/${slug}/contenido/${section}`

  useCrumbLabel(pathname, item ? name(item) : undefined)
  usePageTitle(`${title} · ${contentSections[section]}`)

  const back = () => {
    save.reset()
    navigate(listPath)
  }

  if (itemId && list.isPending) return <DetailSkeleton />
  if (itemId && list.error) return <ErrorNotice error={list.error} />
  if (itemId && !item) {
    return (
      <EmptyState title="No encontramos este elemento">
        Puede que lo hayan eliminado.{' '}
        <Link to={listPath} className="font-semibold text-navy underline">
          Volver a {contentSections[section]}
        </Link>
      </EmptyState>
    )
  }

  return (
    <>
      <PageHeader
        title={title}
        description={`${slug === 'empresas' ? 'DIGO EMPRESAS' : 'DIGO HOGAR'} · Al guardar, publica desde ${contentSections[section]} para verlo en la web.`}
      />
      {children(item, {
        saving: save.isPending,
        error: save.error,
        onSave: (body) => save.mutate({ id: item?.id, body }, { onSuccess: () => navigate(listPath) }),
        onCancel: back,
      })}
    </>
  )
}
