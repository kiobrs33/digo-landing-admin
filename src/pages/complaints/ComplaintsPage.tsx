import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenText, Hand, UserCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { ComplaintList, ComplaintStatus } from '@/api/types'
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
import { Badge, EmptyState, ErrorNotice, Input, ListSkeleton, PageHeader, Select } from '@/components/ui'
import { cx } from '@/lib/cx'
import { formatDate, formatDateTime } from '@/lib/format'
import { complaintStatusLabel } from '@/lib/labels'
import { useSpace, useSpacePath } from '@/lib/space'
import { assigneeName, filterChips, rowClick, theadClass, useSelection } from '@/lib/table'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'
import { useSearchFilters } from '@/lib/useSearchFilters'
import { ComplaintStatusBadge, DeadlineBadge } from './ComplaintBadges'

const statuses = Object.keys(complaintStatusLabel) as ComplaintStatus[]
const statusFilterLabel: Record<ComplaintStatus, string> = {
  PENDIENTE: 'Pendientes',
  EN_PROCESO: 'En proceso',
  RESPONDIDO: 'Respondidas',
}
const DEFAULT_SORT = 'priority'
const deadlineLabel = { abiertas: 'Sin responder', vencido: 'Vencidas', pronto: 'Por vencer' } as const

const filterKeys = [
  'status',
  'search',
  'kind',
  'plazo',
  'open',
  'assigned',
  'from',
  'to',
  'sort',
  'pageSize',
] as const
/** Filtros que se limpian con "Limpiar filtros" (el orden y el tamaño de página se conservan). */
const narrowingKeys = ['status', 'search', 'kind', 'plazo', 'open', 'assigned', 'from', 'to'] as const

export function ComplaintsPage() {
  usePageTitle('Libro de Reclamaciones')
  const space = useSpace()
  const { filters, page, setFilter, setFilters } = useSearchFilters(filterKeys)
  const assignable = useAssignable().data ?? []
  const pageSize = Number(filters.pageSize) || 20
  const sort = filters.sort || DEFAULT_SORT
  // "Plazo" junta dos parámetros de la API: `plazo` (vencidas / por vencer) y `open` (sin responder).
  const deadline = filters.plazo || (filters.open ? 'abiertas' : '')

  const filterQuery = {
    status: filters.status,
    search: filters.search,
    // El espacio fija el sitio: Hogar y Empresas nunca se mezclan.
    site: space.site,
    kind: filters.kind,
    plazo: filters.plazo,
    open: filters.open,
    assigned: filters.assigned,
    from: filters.from,
    to: filters.to,
    sort,
  }
  const query = { ...filterQuery, page, pageSize }
  const list = useQuery({
    queryKey: ['complaints', 'list', query],
    queryFn: () => api<ComplaintList>('/admin/complaints', { query }),
    placeholderData: keepPreviousData,
  })

  const narrowed = narrowingKeys.some((key) => filters[key])
  const clearFilters = () => setFilters(Object.fromEntries(narrowingKeys.map((key) => [key, ''])))
  const counts = list.data?.counts

  return (
    <>
      <PageHeader
        title="Libro de Reclamaciones"
        description="Plazo legal de respuesta: 15 días hábiles desde el registro."
        actions={
          <ExportButton
            path="/admin/complaints/export"
            query={filterQuery}
            filename="libro-de-reclamaciones"
            total={list.data?.total}
          />
        }
      />

      <FilterPanel
        search={filters.search}
        onSearch={(value) => setFilter('search', value)}
        placeholder="N° de hoja, documento, nombre, correo o teléfono"
        searchLabel="Buscar hojas"
        chips={[
          ...(deadline
            ? [
                {
                  key: 'plazo',
                  label: 'Plazo',
                  value: deadlineLabel[deadline as keyof typeof deadlineLabel],
                  onRemove: () => setFilters({ plazo: '', open: '' }),
                },
              ]
            : []),
          ...filterChips(
            filters,
            [
              { key: 'status', label: 'Estado', display: (value) => statusFilterLabel[value as ComplaintStatus] ?? value },
              { key: 'kind', label: 'Tipo', display: (value) => (value === 'QUEJA' ? 'Quejas' : 'Reclamos') },
              { key: 'assigned', label: 'Responsable', display: (value) => assigneeName(value, assignable) },
              { key: 'from', label: 'Desde', display: formatDate },
              { key: 'to', label: 'Hasta', display: formatDate },
            ],
            (key) => setFilter(key, ''),
          ),
        ]}
        onClearFilters={() =>
          setFilters({ status: '', kind: '', plazo: '', open: '', assigned: '', from: '', to: '' })
        }
        onClear={clearFilters}
      >
        <FilterField id="filtro-plazo" label="Plazo">
          <Select
            className="h-10"
            id="filtro-plazo"
            value={deadline}
            onChange={(event) => {
              const value = event.target.value
              setFilters({
                plazo: value === 'vencido' || value === 'pronto' ? value : '',
                open: value === 'abiertas' ? 'true' : '',
              })
            }}
          >
            <option value="">Todos</option>
            <option value="abiertas">{deadlineLabel.abiertas}</option>
            <option value="vencido">{deadlineLabel.vencido}</option>
            <option value="pronto">{deadlineLabel.pronto} (3 días)</option>
          </Select>
        </FilterField>
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
        <FilterField id="filtro-tipo" label="Tipo">
          <Select className="h-10" id="filtro-tipo" value={filters.kind} onChange={(event) => setFilter('kind', event.target.value)}>
            <option value="">Todos</option>
            <option value="RECLAMO">Reclamos</option>
            <option value="QUEJA">Quejas</option>
          </Select>
        </FilterField>
        <FilterField id="filtro-responsable" label="Responsable" wide>
          <Select
            className="h-10"
            id="filtro-responsable"
            value={filters.assigned}
            onChange={(event) => setFilter('assigned', event.target.value)}
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
        <FilterField id="filtro-desde" label="Registradas desde">
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
        <EmptyState
          title={filters.plazo === 'vencido' ? 'Ninguna hoja vencida' : narrowed ? 'Ninguna hoja coincide' : 'Aún no hay hojas de reclamación'}
          icon={<BookOpenText />}
        >
          {narrowed ? (
            <>
              Prueba con otros filtros o{' '}
              <button type="button" className="font-semibold text-navy underline" onClick={clearFilters}>
                límpialos
              </button>
              .
            </>
          ) : (
            'Aquí aparecerán las que registren los clientes en el Libro de Reclamaciones de las webs.'
          )}
        </EmptyState>
      ) : (
        <ComplaintTable
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
 * Tabla de hojas (tarjetas en móvil): selección para acciones en lote, columnas ordenables y
 * paginación. La `key` del padre reinicia la selección al cambiar de página o de filtros.
 */
function ComplaintTable({
  data,
  fetching,
  sort,
  onSort,
  pageSize,
  onPage,
  onPageSize,
}: {
  data: ComplaintList
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
      {selected.size > 0 && <ComplaintBulkBar ids={[...selected]} onDone={selection.clear} />}

      <TableCard fetching={fetching}>
        <table className="hidden w-full text-left text-sm md:table">
          <thead className={theadClass}>
            <tr>
              <th scope="col" className="w-10 py-3 pr-1 pl-4">
                <SelectAllCheckbox selection={selection} />
              </th>
              <SortHeader label="N° hoja" options={['code:desc', 'code:asc']} sort={sort} onSort={onSort} />
              <SortHeader label="Consumidor" options={['name:asc', 'name:desc']} sort={sort} onSort={onSort} />
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th>Responsable</Th>
              <SortHeader
                label="Plazo"
                options={['priority']}
                hint="sin responder primero, la que vence antes arriba"
                sort={sort}
                onSort={onSort}
                className="pr-4"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.items.map((complaint) => (
              <tr
                key={complaint.id}
                onClick={rowClick(() => navigate(path(`/reclamos/${complaint.id}`)))}
                className={cx(
                  'cursor-pointer align-top transition-colors hover:bg-surface/60',
                  selected.has(complaint.id) && 'bg-navy/5 hover:bg-navy/8',
                )}
              >
                <td className="py-3.5 pr-1 pl-4">
                  <RowCheckbox
                    label={`Seleccionar hoja ${complaint.code}`}
                    checked={selected.has(complaint.id)}
                    onChange={() => selection.toggle(complaint.id)}
                  />
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  <Link to={path(`/reclamos/${complaint.id}`)} className="font-semibold text-navy hover:underline">
                    {complaint.code}
                  </Link>
                  <p className="text-xs text-muted">{formatDateTime(complaint.createdAt)}</p>
                </td>
                <td className="max-w-64 px-3 py-3.5">
                  <p className="truncate font-medium text-ink">{complaint.fullName}</p>
                  <p className="truncate text-xs text-muted">{complaint.email}</p>
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  <Badge tone={complaint.kind === 'QUEJA' ? 'warning' : 'neutral'}>
                    {complaint.kind === 'QUEJA' ? 'Queja' : 'Reclamo'}
                  </Badge>
                </td>
                <td className="px-3 py-3.5">
                  <ComplaintStatusBadge status={complaint.status} />
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  {complaint.assignedTo?.name ?? <span className="text-muted">Sin asignar</span>}
                </td>
                <td className="px-3 py-3.5 pr-4 whitespace-nowrap">
                  <DeadlineBadge complaint={complaint} />
                  {complaint.status !== 'RESPONDIDO' && (
                    <p className="mt-1 text-xs text-muted">vence {formatDate(complaint.dueDate)}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Móvil: tarjetas con la misma información esencial. */}
        <ul className="divide-y divide-line md:hidden">
          {data.items.map((complaint) => (
            <li key={complaint.id} className={cx('flex gap-3 px-4 py-3.5', selected.has(complaint.id) && 'bg-navy/5')}>
              <RowCheckbox
                label={`Seleccionar hoja ${complaint.code}`}
                checked={selected.has(complaint.id)}
                onChange={() => selection.toggle(complaint.id)}
                className="mt-1 shrink-0"
              />
              <Link to={path(`/reclamos/${complaint.id}`)} className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-navy">{complaint.code}</span>
                  <DeadlineBadge complaint={complaint} />
                </div>
                <p className="mt-0.5 truncate text-sm">{complaint.fullName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <ComplaintStatusBadge status={complaint.status} />
                  {complaint.kind === 'QUEJA' ? 'Queja' : 'Reclamo'} ·{' '}
                  {complaint.assignedTo?.name ?? 'Sin asignar'}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Pager
          page={data.page}
          pageSize={pageSize}
          total={data.total}
          noun={['hoja', 'hojas']}
          onPage={onPage}
          onPageSize={onPageSize}
        />
      </TableCard>
    </>
  )
}

type BulkChange = { status?: 'EN_PROCESO'; assignedToId?: string }

/**
 * Acciones sobre las hojas seleccionadas. Responder no está aquí: es el acto legal de cada hoja
 * y se hace una por una, revisando el correo que recibe el consumidor.
 */
function ComplaintBulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const bulk = useMutation({
    mutationFn: (change: BulkChange) =>
      api<{ updated: number }>('/admin/complaints/bulk', { method: 'PATCH', body: { ids, ...change } }),
    onSuccess: async ({ updated }) => {
      await queryClient.invalidateQueries({ queryKey: ['complaints'] })
      toast({ message: updated === 1 ? '1 hoja actualizada.' : `${updated} hojas actualizadas.` })
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
        Pasar a En proceso
      </BulkButton>
    </BulkBar>
  )
}
