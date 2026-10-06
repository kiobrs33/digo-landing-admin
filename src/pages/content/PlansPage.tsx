import { Pencil, Plus, Trash2, Tv, Wifi } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Plan } from '@/api/types'
import { FilterField, FilterPanel, Pager, SortHeader, TableCard, Th } from '@/components/DataTable'
import { Badge, Button, Card, EmptyState, ErrorNotice, Field, Input, ListSkeleton, Select, Textarea } from '@/components/ui'
import { cx } from '@/lib/cx'
import { filterChips, paginate, theadClass } from '@/lib/table'
import { useSearchFilters } from '@/lib/useSearchFilters'
import { formatPrice } from '@/lib/labels'
import { SortableList } from '@/components/Sortable'
import { CollectionEditor, type EditorProps, NewItemLink, OrderCell, OrderHint, SortableTr, Toggle } from './collection'
import { useCollection } from './useCollection'
import { useContentSite } from './site'

type PlanBody = {
  name: string
  downloadMbps: number
  uploadMbps: number
  price: number
  promoPrice: number | null
  promoMonths: number | null
  badge: string
  tvPackage: string
  features: string[]
  highlighted: boolean
  active: boolean
}

const filterKeys = ['search', 'visible', 'tv', 'sort', 'pageSize'] as const
const narrowingKeys = ['search', 'visible', 'tv'] as const
const DEFAULT_SORT = 'position'

/** Orden de la tabla. `position` es el orden en la web: el único en que se puede mover un plan. */
const comparePlans: Record<string, (a: Plan, b: Plan) => number> = {
  position: (a, b) => a.position - b.position,
  'speed:desc': (a, b) => b.downloadMbps - a.downloadMbps,
  'speed:asc': (a, b) => a.downloadMbps - b.downloadMbps,
  'price:asc': (a, b) => effectivePrice(a) - effectivePrice(b),
  'price:desc': (a, b) => effectivePrice(b) - effectivePrice(a),
}

/** Lo que paga el cliente hoy: el precio de promoción si lo hay. */
const effectivePrice = (plan: Plan) => Number(plan.promoPrice ?? plan.price)

export function PlansPage() {
  const { site } = useContentSite()
  const { list, remove, moveById } = useCollection<Plan, PlanBody>(site, 'plans')
  const { filters, page, setFilter, setFilters } = useSearchFilters(filterKeys)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const pageSize = Number(filters.pageSize) || 20
  const sort = filters.sort in comparePlans ? filters.sort : DEFAULT_SORT
  const onSort = (value: string) => setFilter('sort', value === DEFAULT_SORT ? '' : value)

  const all = list.data ?? []
  const term = filters.search.toLowerCase()
  const matching = all
    .filter((plan) => !term || plan.name.toLowerCase().includes(term) || plan.tvPackage?.toLowerCase().includes(term))
    .filter((plan) => !filters.visible || (filters.visible === 'yes') === plan.active)
    .filter((plan) => !filters.tv || (filters.tv === 'yes') === Boolean(plan.tvPackage))
    .sort(comparePlans[sort])
  const { page: current, rows } = paginate(matching, page, pageSize)
  const narrowed = narrowingKeys.some((key) => filters[key])
  const clearFilters = () => setFilters({ search: '', visible: '', tv: '' })
  // Mover solo tiene sentido viendo la lista completa en el orden de la web.
  const canReorder = sort === DEFAULT_SORT && !narrowed
  const reorderHint = canReorder ? undefined : 'Para mover, quita los filtros y ordena por "Orden".'

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <OrderHint>
          {canReorder
            ? 'El orden de esta lista es el orden de las tarjetas en la web. Arrastra las filas para cambiarlo.'
            : 'Viendo un orden o filtro distinto al de la web: para mover, vuelve a "Orden" sin filtros.'}
        </OrderHint>
        <NewItemLink>
          <Plus className="size-4" aria-hidden />
          Nuevo plan
        </NewItemLink>
      </div>

      <FilterPanel
        search={filters.search}
        onSearch={(value) => setFilter('search', value)}
        placeholder="Nombre del plan o paquete de TV"
        searchLabel="Buscar planes"
        chips={filterChips(
          filters,
          [
            { key: 'visible', label: 'En la web', display: (value) => (value === 'yes' ? 'Visibles' : 'Ocultos') },
            { key: 'tv', label: 'TV Digital', display: (value) => (value === 'yes' ? 'Con TV' : 'Solo internet') },
          ],
          (key) => setFilter(key, ''),
        )}
        onClearFilters={() => setFilters({ visible: '', tv: '' })}
        onClear={clearFilters}
      >
        <FilterField id="filtro-visible" label="Visibilidad">
          <Select className="h-10" id="filtro-visible" value={filters.visible} onChange={(event) => setFilter('visible', event.target.value)}>
            <option value="">Todos</option>
            <option value="yes">Visibles en la web</option>
            <option value="no">Ocultos</option>
          </Select>
        </FilterField>
        <FilterField id="filtro-tv" label="TV Digital">
          <Select className="h-10" id="filtro-tv" value={filters.tv} onChange={(event) => setFilter('tv', event.target.value)}>
            <option value="">Todos</option>
            <option value="yes">Con TV</option>
            <option value="no">Solo internet</option>
          </Select>
        </FilterField>
      </FilterPanel>

      <ErrorNotice error={list.error ?? remove.error} />
      {list.isPending ? (
        <ListSkeleton rows={3} />
      ) : !all.length ? (
        <EmptyState title="Aún no hay planes" icon={<Wifi />}>
          Crea el primero con “Nuevo plan”.
        </EmptyState>
      ) : !matching.length ? (
        <EmptyState title="Ningún plan coincide" icon={<Wifi />}>
          <button type="button" className="font-semibold text-navy underline" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </EmptyState>
      ) : (
        <TableCard>
          <SortableList
            ids={rows.map((plan) => plan.id)}
            names={Object.fromEntries(rows.map((plan) => [plan.id, plan.name]))}
            disabled={!canReorder}
            onMove={moveById}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className={theadClass}>
                  <tr>
                    <SortHeader label="Orden" options={['position']} hint="como en la web" sort={sort} onSort={onSort} className="w-20 pl-4" />
                    <Th>Plan</Th>
                    <SortHeader label="Velocidad" options={['speed:desc', 'speed:asc']} sort={sort} onSort={onSort} />
                    <SortHeader label="Precio" options={['price:asc', 'price:desc']} sort={sort} onSort={onSort} />
                    <Th>TV Digital</Th>
                    <Th>En la web</Th>
                    <Th className="pr-4 text-right">Acciones</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((plan) => {
                    const index = all.findIndex((entry) => entry.id === plan.id)
                    return (
                      <SortableTr key={plan.id} id={plan.id} className="align-middle hover:bg-surface/60">
                        {(handle) => (
                          <>
                        <td className="py-2.5 pr-2 pl-4">
                          <OrderCell
                            index={index}
                            name={plan.name}
                            handle={handle}
                            disabledReason={reorderHint}
                          />
                        </td>
                        <td className={cx('px-3 py-2.5', !plan.active && 'opacity-60')}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={plan.id} className="font-semibold text-navy hover:underline">
                              {plan.name}
                            </Link>
                            {plan.highlighted && <Badge tone="accent">{plan.badge || 'Destacado'}</Badge>}
                          </div>
                          {plan.features.length > 0 && <p className="max-w-64 truncate text-xs text-muted">{plan.features[0]}</p>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                          {plan.downloadMbps} Mbps
                          {plan.uploadMbps !== plan.downloadMbps && <span className="text-xs text-muted"> / {plan.uploadMbps} subida</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                          {plan.promoPrice ? (
                            <>
                              <strong>{formatPrice(plan.promoPrice)}</strong>
                              <p className="text-xs text-muted">
                                {plan.promoMonths} {plan.promoMonths === 1 ? 'mes' : 'meses'}, luego {formatPrice(plan.price)}
                              </p>
                            </>
                          ) : (
                            <strong>{formatPrice(plan.price)}</strong>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {plan.tvPackage ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <Tv className="size-3.5 text-muted" aria-hidden />
                              {plan.tvPackage}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap', plan.active ? 'text-emerald-800' : 'text-muted')}>
                            <span aria-hidden className={cx('size-2 rounded-full', plan.active ? 'bg-emerald-500' : 'bg-navy/25')} />
                            {plan.active ? 'Visible' : 'Oculto'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 pl-3">
                          {confirmingId === plan.id ? (
                            <span className="flex items-center justify-end gap-2" role="group" aria-label={`Confirmar eliminar ${plan.name}`}>
                              <Button variant="ghost" onClick={() => setConfirmingId(null)}>
                                Cancelar
                              </Button>
                              <Button
                                variant="danger"
                                autoFocus
                                loading={remove.isPending && remove.variables === plan.id}
                                onClick={() => remove.mutate(plan.id, { onSuccess: () => setConfirmingId(null) })}
                              >
                                Sí, eliminar
                              </Button>
                            </span>
                          ) : (
                            <span className="flex justify-end gap-1">
                              <Link
                                to={plan.id}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy transition-colors hover:bg-surface-alt"
                              >
                                <Pencil className="size-4" aria-hidden />
                                Editar
                              </Link>
                              <Button
                                variant="ghost"
                                aria-label={`Eliminar ${plan.name}`}
                                className="text-muted hover:bg-red-50 hover:text-red-700"
                                onClick={() => setConfirmingId(plan.id)}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </span>
                          )}
                        </td>
                          </>
                        )}
                      </SortableTr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SortableList>
          <Pager
            page={current}
            pageSize={pageSize}
            total={matching.length}
            noun={['plan', 'planes']}
            onPage={(next) => setFilter('page', String(next))}
            onPageSize={(size) => setFilter('pageSize', size === 20 ? '' : String(size))}
          />
        </TableCard>
      )}
    </>
  )
}

/** Crear o editar, en su propia vista. */
export function PlanEditPage() {
  return (
    <CollectionEditor<Plan, PlanBody> resource="plans" newTitle="Nuevo plan" name={(plan) => plan.name}>
      {(plan, props) => <PlanForm plan={plan} {...props} />}
    </CollectionEditor>
  )
}

function PlanForm({ plan, saving, error, onSave, onCancel }: { plan: Plan | null } & EditorProps<PlanBody>) {
  const [name, setName] = useState(plan?.name ?? '')
  const [download, setDownload] = useState(String(plan?.downloadMbps ?? ''))
  const [upload, setUpload] = useState(String(plan?.uploadMbps ?? ''))
  const [price, setPrice] = useState(plan ? Number(plan.price).toFixed(2) : '')
  const [hasPromo, setHasPromo] = useState(Boolean(plan?.promoPrice))
  const [promoPrice, setPromoPrice] = useState(plan?.promoPrice ? Number(plan.promoPrice).toFixed(2) : '')
  const [promoMonths, setPromoMonths] = useState(String(plan?.promoMonths ?? '3'))
  const [tvPackage, setTvPackage] = useState(plan?.tvPackage ?? '')
  const [features, setFeatures] = useState((plan?.features ?? []).join('\n'))
  const [highlighted, setHighlighted] = useState(plan?.highlighted ?? false)
  const [badge, setBadge] = useState(plan?.badge ?? 'Recomendado')
  const [active, setActive] = useState(plan?.active ?? true)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSave({
      name,
      downloadMbps: Number(download),
      uploadMbps: Number(upload),
      price: Number(price),
      promoPrice: hasPromo ? Number(promoPrice) : null,
      promoMonths: hasPromo ? Number(promoMonths) : null,
      tvPackage,
      features: features.split('\n'),
      highlighted,
      badge: highlighted ? badge : '',
      active,
    })
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Nombre" hint="Como se ve en la tarjeta, p. ej. 1000 Mbps">
            {(id) => <Input id={id} required maxLength={60} placeholder="Ej.: 1000 Mbps" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </div>
        <Field label="Bajada (Mbps)">
          {(id) => <Input id={id} type="number" required min={1} placeholder="Ej.: 1000" value={download} onChange={(e) => {
            // Fibra simétrica: la subida sigue a la bajada mientras coincidan.
            if (upload === download) setUpload(e.target.value)
            setDownload(e.target.value)
          }} />}
        </Field>
        <Field label="Subida (Mbps)">
          {(id) => <Input id={id} type="number" required min={1} placeholder="Ej.: 1000" value={upload} onChange={(e) => setUpload(e.target.value)} />}
        </Field>
        <Field label="Precio mensual (S/)">
          {(id) => <Input id={id} type="number" required min={0} step="0.01" placeholder="Ej.: 89.00" value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Paquete de TV incluido" hint="Opcional, p. ej. TV Digital Premium">
            {(id) => <Input id={id} maxLength={60} placeholder="Ej.: TV Digital Premium" value={tvPackage} onChange={(e) => setTvPackage(e.target.value)} />}
          </Field>
        </div>

        <fieldset className="rounded-lg bg-surface p-4 sm:col-span-2 lg:col-span-4">
          <legend className="sr-only">Promoción</legend>
          <Toggle checked={hasPromo} onChange={setHasPromo} label="Tiene precio de promoción" description="Reemplaza al precio regular durante los primeros meses." />
          {hasPromo && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Precio de promoción (S/)">
                {(id) => <Input id={id} type="number" required min={0} step="0.01" placeholder="Ej.: 44.50" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />}
              </Field>
              <Field label="Durante cuántos meses">
                {(id) => <Input id={id} type="number" required min={1} max={36} placeholder="Ej.: 3" value={promoMonths} onChange={(e) => setPromoMonths(e.target.value)} />}
              </Field>
            </div>
          )}
        </fieldset>

        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Beneficios" hint="Uno por línea. Los comunes a todos los planes no hace falta repetirlos.">
            {(id) => <Textarea id={id} rows={4} placeholder={'Más de 130 canales HD\nCine y series premium'} value={features} onChange={(e) => setFeatures(e.target.value)} />}
          </Field>
        </div>

        <div className="flex flex-col gap-3 sm:col-span-2">
          <Toggle checked={highlighted} onChange={setHighlighted} label="Destacar este plan" description="Se resalta con una insignia." />
          {highlighted && (
            <Field label="Texto de la insignia">
              {(id) => <Input id={id} required maxLength={30} placeholder="Ej.: Recomendado" value={badge} onChange={(e) => setBadge(e.target.value)} />}
            </Field>
          )}
        </div>
        <div className="sm:col-span-2">
          <Toggle checked={active} onChange={setActive} label="Visible en la web" description="Apágalo para ocultarlo sin borrarlo." />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <ErrorNotice error={error} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" loading={saving}>
            {plan ? 'Guardar plan' : 'Crear plan'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}
