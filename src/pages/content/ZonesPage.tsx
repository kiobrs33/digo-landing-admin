import { Check, MapPinned, Plus, Search } from 'lucide-react'
import { type FormEvent, lazy, Suspense, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { BoundaryResult, CoverageZone, LatLng } from '@/api/types'
import { SortableList } from '@/components/Sortable'
import { Button, Card, EmptyState, ErrorNotice, Field, Input, ListSkeleton } from '@/components/ui'
import { cx } from '@/lib/cx'
import { CollectionEditor, CollectionRow, type EditorProps, NewItemLink, OrderHint, Toggle } from './collection'
import { useContentSite } from './site'
import { useCollection } from './useCollection'

// Leaflet solo se descarga al abrir una pantalla de zonas.
const ZonesMap = lazy(() => import('./ZonesMap').then((module) => ({ default: module.ZonesMap })))

type ZoneBody = {
  name: string
  detail: string | null
  color: string
  rings: LatLng[][]
  osmRef: string | null
  active: boolean
}

/** Paleta del mapa (la misma que valida el backend): contrasta con las teselas y entre sí. */
const palette = [
  { value: '#de087e', label: 'Magenta' },
  { value: '#3552c4', label: 'Azul' },
  { value: '#0f8a7e', label: 'Turquesa' },
  { value: '#7a3fc0', label: 'Violeta' },
  { value: '#d2601a', label: 'Naranja' },
  { value: '#2f7d32', label: 'Verde' },
  { value: '#b0306a', label: 'Frambuesa' },
  { value: '#041c7b', label: 'Navy' },
]

const pointsOf = (rings: LatLng[][]) => rings.reduce((sum, ring) => sum + ring.length, 0)

function MapFallback({ className = 'h-80' }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-alt ring-1 ring-line', className)} />
}

function Swatch({ color, className = 'size-4' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('shrink-0 rounded border-2', className)}
      style={{ borderColor: color, background: `color-mix(in srgb, ${color} 30%, transparent)` }}
    />
  )
}

export function ZonesPage() {
  const { site } = useContentSite()
  const { list, remove, moveById } = useCollection<CoverageZone, ZoneBody>(site, 'coverage-zones')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const zones = list.data ?? []

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <OrderHint>
          Se muestran en la sección Cobertura de la web en este orden. Arrastra las filas para cambiarlo.
        </OrderHint>
        <NewItemLink>
          <Plus className="size-4" aria-hidden />
          Nueva zona
        </NewItemLink>
      </div>

      <ErrorNotice error={list.error ?? remove.error} />
      {list.isPending ? (
        <ListSkeleton rows={3} />
      ) : !zones.length ? (
        <EmptyState title="Sin zonas de cobertura" icon={<MapPinned />}>
          Agrega el primer distrito con fibra: búscalo por nombre y su contorno se dibuja solo.
        </EmptyState>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <SortableList
            ids={zones.map((zone) => zone.id)}
            names={Object.fromEntries(zones.map((zone) => [zone.id, zone.name]))}
            onMove={moveById}
          >
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
              {zones.map((zone, index) => (
                <CollectionRow
                  id={zone.id}
                  key={zone.id}
                  index={index}
                  editTo={zone.id}
                  active={zone.active}
                  name={zone.name}
                  onDelete={() => remove.mutate(zone.id)}
                  deleting={remove.isPending && remove.variables === zone.id}
                >
                  <div
                    className="flex items-center gap-3"
                    onMouseEnter={() => setHoverId(zone.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <Swatch color={zone.color} className="size-5" />
                    <div className="min-w-0">
                      <p className="font-bold text-navy">{zone.name}</p>
                      <p className="truncate text-xs text-muted">
                        {zone.detail ?? 'Sin nota'}
                      </p>
                    </div>
                  </div>
                </CollectionRow>
              ))}
            </ul>
          </SortableList>

          <div className="lg:sticky lg:top-20">
            <Suspense fallback={<MapFallback className="h-96 lg:h-[30rem]" />}>
              <ZonesMap
                zones={zones.map((zone) => ({ ...zone, muted: !zone.active }))}
                fitTo={zones.filter((zone) => zone.active).map((zone) => zone.id)}
                highlightId={hoverId}
                className="h-96 lg:h-[30rem]"
              />
            </Suspense>
            <p className="mt-2 text-xs text-muted">
              Así se verán en la web. Las ocultas aparecen en gris punteado.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

/** Crear o editar, en su propia vista. */
export function ZoneEditPage() {
  return (
    <CollectionEditor<CoverageZone, ZoneBody> resource="coverage-zones" newTitle="Nueva zona" name={(zone) => zone.name}>
      {(zone, props) => <ZoneForm zone={zone} {...props} />}
    </CollectionEditor>
  )
}

function ZoneForm({ zone, saving, error, onSave, onCancel }: { zone: CoverageZone | null } & EditorProps<ZoneBody>) {
  const { site } = useContentSite()
  const { list } = useCollection<CoverageZone, ZoneBody>(site, 'coverage-zones')
  const others = (list.data ?? []).filter((other) => other.id !== zone?.id)
  // Una zona nueva toma el primer color que aún no usa otra zona.
  const freeColor = palette.find((color) => !others.some((other) => other.color === color.value))?.value

  const [name, setName] = useState(zone?.name ?? '')
  const [detail, setDetail] = useState(zone?.detail ?? '')
  const [color, setColor] = useState(zone?.color ?? freeColor ?? palette[0].value)
  const [rings, setRings] = useState<LatLng[][]>(zone?.rings ?? [])
  const [osmRef, setOsmRef] = useState(zone?.osmRef ?? null)
  const [active, setActive] = useState(zone?.active ?? true)
  const [query, setQuery] = useState('')
  const [missingShape, setMissingShape] = useState(false)

  const search = useMutation({
    mutationFn: (q: string) =>
      api<BoundaryResult[]>(`/admin/sites/${site.toLowerCase()}/coverage-zones/boundaries`, { query: { q } }),
  })

  const choose = (result: BoundaryResult) => {
    // El nombre y la nota siguen al distrito mientras no se hayan escrito a mano.
    if (!name || name === nameFromRef(osmRef, search.data)) setName(result.name)
    if (!detail || detail === `Distrito de ${nameFromRef(osmRef, search.data)}`) setDetail(`Distrito de ${result.name}`)
    setRings(result.rings)
    setOsmRef(result.osmRef)
    setMissingShape(false)
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 3) return
    // Sin la provincia, Nominatim mezcla lugares homónimos de todo el Perú.
    search.mutate(/arequipa/i.test(q) ? q : `${q}, Arequipa`)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!rings.length) {
      setMissingShape(true)
      return
    }
    onSave({ name, detail: detail.trim() || null, color, rings, osmRef, active })
  }

  const draft = rings.length ? [{ id: 'draft', name: name || 'Zona nueva', color, rings }] : []

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid gap-5">
        <Card>
          <h2 className="font-bold text-navy">1. Contorno de la zona</h2>
          <p className="mt-1 text-sm text-muted">
            Busca el distrito en OpenStreetMap y elige el resultado: su límite oficial se dibuja en el mapa.
          </p>
          <form onSubmit={onSearch} className="mt-4 flex gap-2" role="search">
            <div className="flex-1">
              <label htmlFor="zone-search" className="sr-only">
                Distrito a buscar
              </label>
              <Input
                id="zone-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ej.: Cerro Colorado"
                minLength={3}
                maxLength={100}
              />
            </div>
            <Button type="submit" variant="secondary" loading={search.isPending}>
              <Search className="size-4" aria-hidden />
              Buscar
            </Button>
          </form>
          <ErrorNotice error={search.error} />

          {search.data && (
            <div className="mt-3" aria-live="polite">
              {search.data.length === 0 ? (
                <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
                  No hay distritos con contorno para “{search.variables}”. Prueba con otro nombre.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {search.data.map((result) => {
                    const chosen = result.osmRef === osmRef
                    return (
                      <li key={result.osmRef}>
                        <button
                          type="button"
                          onClick={() => choose(result)}
                          aria-pressed={chosen}
                          className={cx(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ring-1 transition-colors',
                            chosen ? 'bg-navy/5 ring-2 ring-navy' : 'ring-line hover:bg-surface',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-navy">{result.name}</span>
                            <span className="block truncate text-xs text-muted">{result.place}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted">{result.points} puntos</span>
                          {chosen && <Check className="size-4 shrink-0 text-navy" aria-label="Elegido" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {!search.data && rings.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Contorno actual: {pointsOf(rings)} puntos
              {osmRef && (
                <>
                  {' · '}
                  <a
                    href={`https://www.openstreetmap.org/${osmRef}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-navy hover:underline"
                  >
                    ver en OpenStreetMap
                  </a>
                </>
              )}
              . Busca otro distrito para reemplazarlo.
            </p>
          )}
          {missingShape && (
            <p className="mt-3 text-sm font-medium text-red-700" role="alert">
              Busca y elige un distrito para dibujar la zona.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-navy">2. Cómo se muestra</h2>
          <form id="zone-form" onSubmit={onSubmit} className="mt-4 grid gap-4">
            <Field label="Nombre en la web">
              {(id) => (
                <Input
                  id={id}
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Ej.: Cerro Colorado"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
            <Field label="Nota (opcional)" hint="Aparece al elegir la zona, p. ej. “Distrito de Cerro Colorado”.">
              {(id) => (
                <Input id={id} maxLength={80} value={detail} onChange={(event) => setDetail(event.target.value)} />
              )}
            </Field>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Color en el mapa</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {palette.map((option) => {
                  const usedBy = others.find((other) => other.color === option.value)
                  return (
                    <label
                      key={option.value}
                      title={usedBy ? `${option.label} (lo usa ${usedBy.name})` : option.label}
                      className="cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="zone-color"
                        value={option.value}
                        checked={color === option.value}
                        onChange={() => setColor(option.value)}
                        className="peer sr-only"
                      />
                      <span className="sr-only">
                        {option.label}
                        {usedBy ? `, lo usa ${usedBy.name}` : ''}
                      </span>
                      <span
                        aria-hidden
                        className={cx(
                          'grid size-9 place-items-center rounded-lg ring-1 ring-line transition-shadow peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-magenta peer-checked:ring-2 peer-checked:ring-navy',
                          usedBy && 'opacity-50',
                        )}
                      >
                        <span className="size-5 rounded-md" style={{ background: option.value }} />
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted">Los colores más tenues ya los usa otra zona.</p>
            </fieldset>
            <Toggle
              checked={active}
              onChange={setActive}
              label="Visible en la web"
              description="Apágalo para preparar una zona antes de anunciarla."
            />
            <ErrorNotice error={error} />
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>
                {zone ? 'Guardar' : 'Agregar zona'}
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <div className="lg:sticky lg:top-20">
        <Suspense fallback={<MapFallback className="h-96 lg:h-[34rem]" />}>
          <ZonesMap
            zones={[
              ...others.map((other) => ({ ...other, muted: true })),
              ...draft,
            ]}
            fitTo={draft.length ? ['draft'] : undefined}
            highlightId="draft"
            className="h-96 lg:h-[34rem]"
          />
        </Suspense>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <Swatch color={color} className="size-3.5" />
          {draft.length ? 'Esta zona' : 'Aún sin contorno'} · en gris punteado, las demás zonas.
        </p>
      </div>
    </div>
  )
}

/** Nombre del resultado elegido antes (para saber si el nombre se escribió a mano). */
function nameFromRef(osmRef: string | null, results: BoundaryResult[] | undefined) {
  return results?.find((result) => result.osmRef === osmRef)?.name
}
