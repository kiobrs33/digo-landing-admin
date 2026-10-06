import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Hand, MessageSquareText, UserCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { InquiryList, InquiryStatus } from '@/api/types'
import { useAssignable } from '@/api/useAssignable'
import { useAuth } from '@/auth/context'
import {
  BulkBar,
  BulkButton,
  ExportButton,
  FilterField,
  FilterPanel,
  Pager,
  RowCheckbox,
  SelectAllCheckbox,
  SortHeader,
  TableCard,
  Th,
} from '@/components/DataTable'
import { assigneeName, filterChips, rowClick, theadClass, useSelection } from '@/lib/table'
import { Badge, EmptyState, ErrorNotice, Input, ListSkeleton, PageHeader, Select } from '@/components/ui'
import { cx } from '@/lib/cx'
import { formatDate, formatDateTime, formatShortDate, timeAgo } from '@/lib/format'
import { inquiryStatusLabel } from '@/lib/labels'
import { useSpace, useSpacePath } from '@/lib/space'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'
import { useSearchFilters } from '@/lib/useSearchFilters'

const statusTone = { NUEVA: 'warning', EN_PROCESO: 'info', ATENDIDA: 'success' } as const
const statuses = Object.keys(inquiryStatusLabel) as InquiryStatus[]
/** El filtro nombra grupos: "Nuevas", no "Nueva". */
const statusFilterLabel: Record<InquiryStatus, string> = { NUEVA: 'Nuevas', EN_PROCESO: 'En proceso', ATENDIDA: 'Atendidas' }
const DEFAULT_SORT = 'status:asc'

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge tone={statusTone[status]}>{inquiryStatusLabel[status]}</Badge>
}

const filterKeys = ['status', 'search', 'assignedTo', 'from', 'to', 'sort', 'pageSize'] as const
/** Filtros que se limpian con "Limpiar filtros" (el orden y el tamaño de página se conservan). */
const narrowingKeys = ['status', 'search', 'assignedTo', 'from', 'to'] as const

export function InquiriesPage() {
  usePageTitle('Consultas')
  const space = useSpace()
  const { filters, page, setFilter, setFilters } = useSearchFilters(filterKeys)
  const assignable = useAssignable().data ?? []
  const pageSize = Number(filters.pageSize) || 20
  const sort = filters.sort || DEFAULT_SORT

  const filterQuery = {
    status: filters.status,
    search: filters.search,
    // El espacio fija el sitio: Hogar y Empresas nunca se mezclan.
    site: space.site,
    assignedTo: filters.assignedTo,
    from: filters.from,
    to: filters.to,
    sort,
  }
  const query = { ...filterQuery, page, pageSize }
  const list = useQuery({
    queryKey: ['inquiries', 'list', query],
    queryFn: () => api<InquiryList>('/admin/inquiries', { query }),
    placeholderData: keepPreviousData,
  })

  const narrowed = narrowingKeys.some((key) => filters[key])
  const clearFilters = () => setFilters(Object.fromEntries(narrowingKeys.map((key) => [key, ''])))
  const counts = list.data?.counts

  return (
    <>
      <PageHeader
        title="Consultas"
        description={`Mensajes del formulario de contacto de ${space.domain}.`}
        actions={<ExportButton path="/admin/inquiries/export" query={filterQuery} filename="consultas" total={list.data?.total} />}
      />

      <FilterPanel
        search={filters.search}
        onSearch={(value) => setFilter('search', value)}
        placeholder="Nombre, empresa, RUC, teléfono, correo o texto del mensaje"
        searchLabel="Buscar consultas"
        chips={filterChips(
          filters,
          [
            { key: 'status', label: 'Estado', display: (value) => statusFilterLabel[value as InquiryStatus] ?? value },
            { key: 'assignedTo', label: 'Responsable', display: (value) => assigneeName(value, assignable) },
            { key: 'from', label: 'Desde', display: formatDate },
            { key: 'to', label: 'Hasta', display: formatDate },
          ],
          (key) => setFilter(key, ''),
        )}
        onClearFilters={() => setFilters({ status: '', assignedTo: '', from: '', to: '' })}
        onClear={clearFilters}
      >
        <FilterField id="filtro-estado" label="Estado">
          <Select className="h-10" id="filtro-estado" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">Todos</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusFilterLabel[status]}
                {counts ? ` (${counts[status]})` : ''}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="filtro-responsable" label="Responsable" wide>
          <Select
            className="h-10"
            id="filtro-responsable"
            value={filters.assignedTo}
            onChange={(event) => setFilter('assignedTo', event.target.value)}
          >
            <option value="">Todos</option>
            <option value="me">Asignadas a mí</option>
            <option value="none">Sin asignar</option>
            {assignable.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="filtro-desde" label="Recibidas desde">
          <Input
            className="h-10"
            id="filtro-desde"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilter('from', event.target.value)}
          />
        </FilterField>
        <FilterField id="filtro-hasta" label="Hasta">
          <Input
            className="h-10"
            id="filtro-hasta"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilter('to', event.target.value)}
          />
        </FilterField>
      </FilterPanel>

      <ErrorNotice error={list.error} />
      {list.isPending ? (
        <ListSkeleton rows={6} />
      ) : !list.data?.items.length ? (
        <EmptyState title={narrowed ? 'Ninguna consulta coincide' : 'Aún no hay consultas'} icon={<MessageSquareText />}>
          {narrowed ? (
            <>
              Prueba con otros filtros o{' '}
              <button type="button" className="font-semibold text-navy underline" onClick={clearFilters}>
                límpialos
              </button>
              .
            </>
          ) : (
            'Aquí aparecerán los mensajes del formulario de contacto de las webs.'
          )}
        </EmptyState>
      ) : (
        <InquiryTable
          key={JSON.stringify(query)}
          data={list.data}
          fetching={list.isFetching}
          sort={sort}
          onSort={(value) => setFilter('sort', value === DEFAULT_SORT ? '' : value)}
          pageSize={pageSize}
          onPage={(next) => setFilter('page', String(next))}
          onPageSize={(size) => setFilter('pageSize', size === 20 ? '' : String(size))}
        />
      )}
    </>
  )
}

/**
 * Tabla de consultas (tarjetas en móvil): selección para acciones en lote, columnas ordenables
 * y paginación. La `key` del padre reinicia la selección al cambiar de página o de filtros.
 */
function InquiryTable({
  data,
  fetching,
  sort,
  onSort,
  pageSize,
  onPage,
  onPageSize,
}: {
  data: InquiryList
  fetching: boolean
  sort: string
  onSort: (sort: string) => void
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const navigate = useNavigate()
  const path = useSpacePath()
  const selection = useSelection(data.items.map((item) => item.id))
  const { selected } = selection

  return (
    <>
      {selected.size > 0 && <InquiryBulkBar ids={[...selected]} onDone={selection.clear} />}

      <TableCard fetching={fetching}>
        <table className="hidden w-full text-left text-sm md:table">
          <thead className={theadClass}>
            <tr>
              <th scope="col" className="w-10 py-3 pr-1 pl-4">
                <SelectAllCheckbox selection={selection} />
              </th>
              <SortHeader label="Recibida" options={['createdAt:desc', 'createdAt:asc']} sort={sort} onSort={onSort} />
              <SortHeader label="Contacto" options={['name:asc', 'name:desc']} sort={sort} onSort={onSort} />
              <Th>Mensaje</Th>
              <SortHeader label="Estado" options={['status:asc']} hint="pendientes primero" sort={sort} onSort={onSort} />
              <Th>Responsable</Th>
              <SortHeader label="Atendida" options={['attendedAt:desc']} sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.items.map((inquiry) => (
              <tr
                key={inquiry.id}
                onClick={rowClick(() => navigate(path(`/consultas/${inquiry.id}`)))}
                className={cx(
                  'cursor-pointer align-top transition-colors hover:bg-surface/60',
                  selected.has(inquiry.id) && 'bg-navy/5 hover:bg-navy/8',
                )}
              >
                <td className="py-3.5 pr-1 pl-4">
                  <RowCheckbox
                    label={`Seleccionar consulta de ${inquiry.company ?? inquiry.name}`}
                    checked={selected.has(inquiry.id)}
                    onChange={() => selection.toggle(inquiry.id)}
                  />
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  <time dateTime={inquiry.createdAt} title={formatDateTime(inquiry.createdAt)} className="font-medium text-ink">
                    {timeAgo(inquiry.createdAt)}
                  </time>
                </td>
                <td className="max-w-56 px-3 py-3.5">
                  <Link to={path(`/consultas/${inquiry.id}`)} className="block truncate font-semibold text-navy hover:underline">
                    {inquiry.company ?? inquiry.name}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {inquiry.company ? `${inquiry.name} · ` : ''}
                    {inquiry.phone}
                  </p>
                </td>
                <td className="max-w-80 px-3 py-3.5">
                  <p className="line-clamp-2 text-muted">{inquiry.message}</p>
                </td>
                <td className="px-3 py-3.5">
                  <InquiryStatusBadge status={inquiry.status} />
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  {inquiry.assignedTo?.name ?? <span className="text-muted">Sin asignar</span>}
                </td>
                <td className="px-3 py-3.5 pr-4 text-xs whitespace-nowrap text-muted">
                  {inquiry.attendedAt ? (
                    <>
                      <span className="font-medium text-ink">{formatShortDate(inquiry.attendedAt)}</span>
                      {inquiry.attendedBy && <p>{inquiry.attendedBy.name}</p>}
                    </>
                  ) : (
                    <span aria-label="No atendida">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Móvil: tarjetas con la misma información esencial. */}
        <ul className="divide-y divide-line md:hidden">
          {data.items.map((inquiry) => (
            <li key={inquiry.id} className={cx('flex gap-3 px-4 py-3.5', selected.has(inquiry.id) && 'bg-navy/5')}>
              <RowCheckbox
                label={`Seleccionar consulta de ${inquiry.company ?? inquiry.name}`}
                checked={selected.has(inquiry.id)}
                onChange={() => selection.toggle(inquiry.id)}
                className="mt-1 shrink-0"
              />
              <Link to={path(`/consultas/${inquiry.id}`)} className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-navy">{inquiry.company ?? inquiry.name}</p>
                  <InquiryStatusBadge status={inquiry.status} />
                </div>
                <p className="line-clamp-2 text-sm text-muted">{inquiry.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {timeAgo(inquiry.createdAt)} · {inquiry.assignedTo?.name ?? 'Sin asignar'}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <Pager
          page={data.page}
          pageSize={pageSize}
          total={data.total}
          noun={['consulta', 'consultas']}
          onPage={onPage}
          onPageSize={onPageSize}
        />
      </TableCard>
    </>
  )
}

type BulkChange = { status?: InquiryStatus; assignedToId?: string }

/** Acciones sobre las consultas seleccionadas. */
function InquiryBulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const bulk = useMutation({
    mutationFn: (change: BulkChange) =>
      api<{ updated: number }>('/admin/inquiries/bulk', { method: 'PATCH', body: { ids, ...change } }),
    onSuccess: async ({ updated }) => {
      await queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      toast({ message: updated === 1 ? '1 consulta actualizada.' : `${updated} consultas actualizadas.` })
      onDone()
    },
  })
  const running = (change: BulkChange) =>
    bulk.isPending && bulk.variables?.status === change.status && bulk.variables?.assignedToId === change.assignedToId

  return (
    <BulkBar count={ids.length} noun={['seleccionada', 'seleccionadas']} error={bulk.error} onClear={onDone}>
      {user && (
        <BulkButton loading={running({ assignedToId: user.id })} onClick={() => bulk.mutate({ assignedToId: user.id })}>
          <UserCheck className="size-4" aria-hidden />
          Asignarme
        </BulkButton>
      )}
      <BulkButton loading={running({ status: 'EN_PROCESO' })} onClick={() => bulk.mutate({ status: 'EN_PROCESO' })}>
        <Hand className="size-4" aria-hidden />
        En proceso
      </BulkButton>
      <BulkButton loading={running({ status: 'ATENDIDA' })} onClick={() => bulk.mutate({ status: 'ATENDIDA' })}>
        <CircleCheck className="size-4" aria-hidden />
        Marcar atendidas
      </BulkButton>
    </BulkBar>
  )
}
