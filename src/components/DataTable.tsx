import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  ListFilter,
  Search,
  X,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { apiDownload } from '@/api/client'
import { Button } from '@/components/ui'
import { cx } from '@/lib/cx'
import { useToast } from '@/lib/toast-context'
import { type FilterChip, pageSizes, type useSelection } from '@/lib/table'
import { useSlashFocus } from '@/lib/useSlashFocus'

/**
 * Piezas de las tablas del panel (Consultas, Libro de Reclamaciones, Planes, Usuarios): el mismo
 * buscador, filtros, encabezados ordenables, selección en lote, paginación y exportación.
 */

// ─── Filtros ───

/**
 * Barra sobre la tabla: buscador compacto (el botón de buscar aparece dentro del campo cuando hay
 * texto sin aplicar; Enter también busca), botón "Filtros" que abre los campos en un panel, y
 * los filtros activos como chips que se quitan de a uno.
 */
export function FilterPanel({
  search,
  onSearch,
  placeholder,
  searchLabel,
  chips,
  onClearFilters,
  onClear,
  children,
}: {
  /** Búsqueda aplicada (la de la URL). */
  search: string
  onSearch: (value: string) => void
  placeholder: string
  searchLabel: string
  /** Filtros activos (sin la búsqueda). */
  chips: FilterChip[]
  /** Quita los filtros (no la búsqueda) en un solo cambio de URL. */
  onClearFilters: () => void
  /** Quita búsqueda y filtros de una vez. */
  onClear: () => void
  /** Campos del panel de filtros (`FilterField`). */
  children: ReactNode
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  useSlashFocus(searchRef)
  const [text, setText] = useState(search)
  // Si la búsqueda cambia por fuera (limpiar filtros, volver atrás), el campo la sigue.
  const [synced, setSynced] = useState(search)
  if (search !== synced) {
    setSynced(search)
    setText(search)
  }
  const pending = text.trim() !== search

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSearch(text.trim())
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <form role="search" onSubmit={onSubmit} className="group relative w-full sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          placeholder={placeholder}
          aria-label={`${searchLabel} (atajo: tecla /)`}
          aria-keyshortcuts="/"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-9 w-full rounded-lg border border-line bg-white pr-20 pl-9 text-sm text-ink shadow-xs placeholder:text-muted/80 focus:border-navy focus:ring-2 focus:ring-navy/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {pending ? (
            <button
              type="submit"
              className="rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-navy-700"
            >
              Buscar
            </button>
          ) : text ? (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setText('')
                onSearch('')
                searchRef.current?.focus()
              }}
              className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-alt hover:text-navy"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            // Pista del atajo: se oculta mientras se escribe en el buscador y explica al pasar el ratón.
            <span className="group/kbd relative mr-1.5 hidden group-focus-within:hidden sm:block" aria-hidden>
              <kbd className="block cursor-help rounded border border-line px-1.5 text-[11px] font-medium text-muted">/</kbd>
              <span className="pointer-events-none absolute top-full right-0 z-30 mt-2 w-max max-w-60 rounded-lg bg-navy-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/kbd:opacity-100">
                Pulsa <kbd className="rounded bg-white/15 px-1 font-semibold">/</kbd> para ir al buscador desde cualquier
                parte de la página.
              </span>
            </span>
          )}
        </div>
      </form>

      <FiltersPopover count={chips.length} onClear={chips.length ? onClearFilters : undefined}>
        {children}
      </FiltersPopover>

      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-navy/8 pr-1 pl-3 text-xs text-navy"
        >
          <span className="text-muted">{chip.label}:</span>
          <strong className="max-w-40 truncate font-semibold">{chip.value}</strong>
          <button
            type="button"
            aria-label={`Quitar filtro ${chip.label}: ${chip.value}`}
            onClick={chip.onRemove}
            className="grid size-5 place-items-center rounded-full text-navy/60 hover:bg-navy/10 hover:text-navy"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {chips.length + (search ? 1 : 0) > 1 && (
        <button type="button" onClick={onClear} className="text-xs font-semibold text-muted underline-offset-4 hover:text-navy hover:underline">
          Limpiar todo
        </button>
      )}
    </div>
  )
}

/** Botón "Filtros" con su panel flotante. Se cierra con Escape, clic fuera o "Listo". */
function FiltersPopover({ count, onClear, children }: { count: number; onClear?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector<HTMLElement>('[data-filters] select, [data-filters] input')?.focus()
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="panel-filtros"
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold shadow-xs transition-colors',
          count || open ? 'border-navy/40 text-navy' : 'border-line text-ink hover:bg-surface',
        )}
      >
        <ListFilter className="size-4" aria-hidden />
        Filtros
        {count > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-navy px-1.5 text-[11px] leading-5 text-white tabular-nums">
            {count}
          </span>
        )}
        <ChevronDown className={cx('size-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          id="panel-filtros"
          role="group"
          aria-label="Filtros"
          className="absolute top-full left-0 z-30 mt-2 w-[min(calc(100vw-2rem),32rem)] rounded-xl bg-white shadow-[0_16px_40px_-16px_rgb(4_28_123/0.35)] ring-1 ring-line"
        >
          <div data-filters className="grid gap-3 p-4 sm:grid-cols-2">
            {children}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
            <button
              type="button"
              onClick={onClear}
              disabled={!onClear}
              className="text-sm font-semibold text-muted hover:text-navy disabled:invisible"
            >
              Limpiar filtros
            </button>
            <Button className="h-8 px-3" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function FilterField({
  id,
  label,
  wide,
  children,
}: {
  id: string
  label: string
  /** Ocupa las dos columnas del panel (deja juntas "desde" y "hasta"). */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cx('flex flex-col gap-1', wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Tabla ───

/** Caja de la tabla: se atenúa mientras llega la página siguiente. */
export function TableCard({ fetching, children }: { fetching?: boolean; children: ReactNode }) {
  return (
    <div
      aria-busy={fetching}
      className={cx('overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line transition-opacity', fetching && 'opacity-70')}
    >
      {children}
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cx('px-3 py-3 font-semibold', className)}>
      {children}
    </th>
  )
}

/**
 * Encabezado ordenable. `options` es el ciclo de órdenes de la columna (`campo:dirección`): el
 * primer clic aplica el primero; otro clic, el siguiente. Una opción sin dirección es un orden
 * fijo (p. ej. "pendientes primero").
 */
export function SortHeader({
  label,
  options,
  sort,
  onSort,
  hint,
  className,
}: {
  label: string
  options: string[]
  sort: string
  onSort: (sort: string) => void
  /** Cómo se lee el orden fijo, p. ej. "pendientes primero". */
  hint?: string
  className?: string
}) {
  const active = options.includes(sort)
  const direction = sort.split(':')[1]
  const next = active ? (options.find((option) => option !== sort) ?? sort) : options[0]
  const Icon = !active ? ArrowUpDown : direction === 'desc' ? ArrowDown : ArrowUp
  const reading = !direction ? hint : direction === 'asc' ? 'ascendente' : 'descendente'

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'desc' ? 'descending' : 'ascending') : 'none'}
      className={cx('px-3 py-3', className)}
    >
      <button
        type="button"
        onClick={() => onSort(next)}
        title={active ? `Ordenado: ${reading}` : `Ordenar por ${label.toLowerCase()}`}
        className={cx('inline-flex items-center gap-1 rounded font-semibold transition-colors hover:text-navy', active && 'text-navy')}
      >
        {label}
        <Icon className={cx('size-3.5', !active && 'opacity-50')} aria-hidden />
      </button>
    </th>
  )
}

// ─── Selección en lote ───

export function SelectAllCheckbox({ selection }: { selection: ReturnType<typeof useSelection> }) {
  return (
    <input
      type="checkbox"
      aria-label="Seleccionar todas las de esta página"
      checked={selection.allSelected}
      ref={(input) => {
        if (input) input.indeterminate = selection.someSelected
      }}
      onChange={selection.toggleAll}
      className="size-4 accent-navy"
    />
  )
}

export function RowCheckbox({
  label,
  checked,
  onChange,
  className,
}: {
  label: string
  checked: boolean
  onChange: () => void
  className?: string
}) {
  return (
    <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className={cx('size-4 accent-navy', className)} />
  )
}

/** Barra de acciones sobre las filas marcadas; queda a la vista al desplazarse. */
export function BulkBar({
  count,
  noun,
  error,
  onClear,
  children,
}: {
  count: number
  /** ["seleccionada", "seleccionadas"] */
  noun: [string, string]
  error?: Error | null
  onClear: () => void
  children: ReactNode
}) {
  return (
    <div
      role="region"
      aria-label="Acciones en lote"
      className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm text-white shadow-lg lg:top-20"
    >
      <span className="mr-auto font-semibold">
        {count} {count === 1 ? noun[0] : noun[1]}
      </span>
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar selección"
        className="grid size-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-red-200">
          {error.message}
        </p>
      )}
    </div>
  )
}

export function BulkButton({ loading, onClick, children }: { loading?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold transition-colors hover:bg-white/20 disabled:opacity-60"
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  )
}

// ─── Paginación ───

/**
 * Pie de la tabla: cuántas se muestran de cuántas, filas por página, la página actual (se puede
 * escribir para saltar) y primera / anterior / siguiente / última.
 */
export function Pager({
  page,
  pageSize,
  total,
  noun,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: number
  total: number
  /** ["consulta", "consultas"] */
  noun: [string, string]
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col gap-3 border-t border-line bg-surface/50 px-4 py-3 text-sm text-muted md:flex-row md:items-center md:justify-between"
    >
      <p>
        Mostrando{' '}
        <strong className="font-semibold text-ink tabular-nums">
          {first}–{last}
        </strong>{' '}
        de <strong className="font-semibold text-ink tabular-nums">{total}</strong> {total === 1 ? noun[0] : noun[1]}
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2">
          Filas por página
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink focus:border-navy focus:outline-none"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <PageJump key={page} page={page} pages={pages} onPage={onPage} />
          <div className="flex items-center gap-0.5">
            <PagerButton label="Primera página" disabled={page <= 1} onClick={() => onPage(1)}>
              <ChevronsLeft className="size-4" aria-hidden />
            </PagerButton>
            <PagerButton label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </PagerButton>
            <PagerButton label="Página siguiente" disabled={page >= pages} onClick={() => onPage(page + 1)}>
              <ChevronRight className="size-4" aria-hidden />
            </PagerButton>
            <PagerButton label="Última página" disabled={page >= pages} onClick={() => onPage(pages)}>
              <ChevronsRight className="size-4" aria-hidden />
            </PagerButton>
          </div>
        </div>
      </div>
    </nav>
  )
}

/** "Página [3] de 7": se escribe un número y se salta con Enter o al salir del campo. */
function PageJump({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const [value, setValue] = useState(String(page))
  const commit = () => {
    const target = Math.min(pages, Math.max(1, Math.round(Number(value)) || page))
    setValue(String(target))
    if (target !== page) onPage(target)
  }
  return (
    <label className="flex items-center gap-2">
      Página
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={pages}
        value={value}
        disabled={pages === 1}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        aria-label={`Página actual, de ${pages}`}
        className="h-8 w-14 rounded-md border border-line bg-white px-2 text-center text-sm text-ink tabular-nums [appearance:textfield] focus:border-navy focus:outline-none disabled:bg-transparent [&::-webkit-inner-spin-button]:appearance-none"
      />
      de <span className="tabular-nums">{pages}</span>
    </label>
  )
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-navy transition-colors hover:bg-white hover:ring-1 hover:ring-line disabled:pointer-events-none disabled:text-muted/40"
    >
      {children}
    </button>
  )
}

// ─── Exportar ───

/** "consultas-2026-10-05.xlsx". */
const datedFilename = (base: string) => `${base}-${new Date().toISOString().slice(0, 10)}.xlsx`

/** Descarga en Excel lo que se ve con los filtros actuales (todas las páginas). */
export function ExportButton({
  path,
  query,
  filename,
  total,
}: {
  path: string
  query: Record<string, string | number | undefined>
  /** Nombre base, sin fecha ni extensión. */
  filename: string
  total?: number
}) {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const run = async () => {
    setExporting(true)
    try {
      await apiDownload(path, query, datedFilename(filename))
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : 'No se pudo exportar.', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }
  return (
    <Button
      variant="secondary"
      loading={exporting}
      disabled={!total}
      title={total ? `Descarga las ${total} filas filtradas en Excel` : undefined}
      onClick={() => void run()}
    >
      <FileSpreadsheet className="size-4 text-emerald-700" aria-hidden />
      Exportar a Excel
    </Button>
  )
}
