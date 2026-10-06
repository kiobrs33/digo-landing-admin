import { CalendarClock, Plus, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { CarouselSlide, MediaAsset, SlideCtaKind } from '@/api/types'
import { ImageField } from '@/components/ImageField'
import { saveAltIfChanged } from '@/lib/upload'
import { Badge, Button, Card, EmptyState, ErrorNotice, Field, Input, ListSkeleton, Select } from '@/components/ui'
import { CollectionEditor, CollectionRow, type EditorProps, NewItemLink, OrderHint, Toggle } from './collection'
import { useCollection } from './useCollection'
import { useContentSite } from './site'
import { SortableList } from '@/components/Sortable'

type SlideBody = {
  title: string
  subtitle: string
  imageId: string
  ctaKind: SlideCtaKind
  ctaLabel: string | null
  ctaValue: string | null
  startsAt: string | null
  endsAt: string | null
  active: boolean
}

const ctaHelp: Record<SlideCtaKind, string> = {
  WHATSAPP: 'Abre WhatsApp con un mensaje sobre este tema.',
  LINK: 'Lleva a otra página del sitio o a una web externa.',
  NONE: 'Solo imagen y texto, sin botón.',
}

/** Estado de vigencia según las fechas programadas. */
function schedule(slide: CarouselSlide): { label: string; tone: 'warning' | 'neutral' | 'danger' } | null {
  const now = Date.now()
  if (slide.endsAt && new Date(slide.endsAt).getTime() <= now) return { label: 'Vencido', tone: 'danger' }
  if (slide.startsAt && new Date(slide.startsAt).getTime() > now) {
    return { label: `Desde ${new Date(slide.startsAt).toLocaleDateString('es-PE')}`, tone: 'warning' }
  }
  if (slide.endsAt) return { label: `Hasta ${new Date(slide.endsAt).toLocaleDateString('es-PE')}`, tone: 'neutral' }
  return null
}

export function CarouselPage() {
  const { site } = useContentSite()
  const { list, remove, moveById } = useCollection<CarouselSlide, SlideBody>(site, 'carousel')

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <OrderHint>Las piezas del cartel principal rotan en este orden: la 1 se ve primero. Arrastra las filas para cambiarlo.</OrderHint>
        <NewItemLink>
          <Plus className="size-4" aria-hidden />
          Nueva pieza
        </NewItemLink>
      </div>

      <ErrorNotice error={list.error ?? remove.error} />
      {list.isPending ? (
        <ListSkeleton rows={3} />
      ) : !list.data?.length ? (
        <EmptyState title="El carrusel está vacío" icon={<SlidersHorizontal />}>
          Agrega una pieza con imagen, título y botón.
        </EmptyState>
      ) : (
        <SortableList
          ids={list.data.map((item) => item.id)}
          names={Object.fromEntries(list.data.map((slide) => [slide.id, slide.title]))}
          onMove={moveById}
        >
          <ul className="divide-y divide-line overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
            {list.data.map((slide, index) => {
              const status = schedule(slide)
              return (
                <CollectionRow
                  id={slide.id}
                  key={slide.id}
                  index={index}
                  editTo={slide.id}
                  active={slide.active}
                  name={slide.title}
                  onDelete={() => remove.mutate(slide.id)}
                  deleting={remove.isPending && remove.variables === slide.id}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={slide.image.url}
                      alt=""
                      className="size-16 shrink-0 rounded-lg bg-surface object-cover ring-1 ring-line"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-navy">{slide.title}</p>
                      {slide.subtitle && <p className="truncate text-sm text-muted">{slide.subtitle}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {slide.ctaKind !== 'NONE' && (
                          <span>
                            Botón “{slide.ctaLabel}” → {slide.ctaKind === 'WHATSAPP' ? 'WhatsApp' : slide.ctaValue}
                          </span>
                        )}
                        {status && (
                          <Badge tone={status.tone}>
                            <CalendarClock className="mr-1 size-3" aria-hidden />
                            {status.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CollectionRow>
              )
            })}
          </ul>
        </SortableList>
      )}
    </>
  )
}

/** `datetime-local` trabaja en hora local sin zona: convertir desde/hacia ISO. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

/** Crear o editar, en su propia vista. */
export function SlideEditPage() {
  return (
    <CollectionEditor<CarouselSlide, SlideBody> resource="carousel" newTitle="Nueva pieza" name={(slide) => slide.title}>
      {(slide, props) => <SlideForm slide={slide} {...props} />}
    </CollectionEditor>
  )
}

function SlideForm({ slide, saving, error, onSave, onCancel }: { slide: CarouselSlide | null } & EditorProps<SlideBody>) {
  const { site } = useContentSite()
  const [image, setImage] = useState<MediaAsset | null>(slide?.image ?? null)
  const [alt, setAlt] = useState(slide?.image.alt ?? '')
  const [title, setTitle] = useState(slide?.title ?? '')
  const [subtitle, setSubtitle] = useState(slide?.subtitle ?? '')
  const [ctaKind, setCtaKind] = useState<SlideCtaKind>(slide?.ctaKind ?? 'WHATSAPP')
  const [ctaLabel, setCtaLabel] = useState(slide?.ctaLabel ?? 'Lo quiero')
  const [ctaValue, setCtaValue] = useState(slide?.ctaValue ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(slide?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(slide?.endsAt ?? null))
  const [active, setActive] = useState(slide?.active ?? true)
  const [imageError, setImageError] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!image) return setImageError(true)
    await saveAltIfChanged(image, alt)
    onSave({
      title,
      subtitle,
      imageId: image.id,
      ctaKind,
      ctaLabel: ctaKind === 'NONE' ? null : ctaLabel,
      ctaValue: ctaKind === 'NONE' ? null : ctaValue,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      active,
    })
  }

  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <ImageField
            label="Imagen"
            hint="Cuadrada (1080 × 1080) se ve mejor."
            site={site}
            value={image}
            onChange={(asset) => {
              setImage(asset)
              setImageError(false)
            }}
            alt={alt}
            onAltChange={setAlt}
          />
          {imageError && <p className="mt-2 text-xs text-red-700">Sube una imagen para la pieza.</p>}
        </div>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título" hint="Repite la oferta en texto: no dejes que viva solo en la imagen.">
              {(id) => <Input id={id} required maxLength={80} placeholder="Ej.: 1000 Mbps a S/ 44.50/mes" value={title} onChange={(e) => setTitle(e.target.value)} />}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Detalle" hint="Opcional. Condiciones o explicación breve.">
              {(id) => <Input id={id} maxLength={200} placeholder="Ej.: Los 3 primeros meses, con TV Digital Premium. Luego S/ 89.00/mes." value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />}
            </Field>
          </div>
          <Field label="Botón" hint={ctaHelp[ctaKind]}>
            {(id) => (
              <Select id={id} value={ctaKind} onChange={(e) => setCtaKind(e.target.value as SlideCtaKind)}>
                <option value="WHATSAPP">Abrir WhatsApp</option>
                <option value="LINK">Ir a una página</option>
                <option value="NONE">Sin botón</option>
              </Select>
            )}
          </Field>
          {ctaKind !== 'NONE' && (
            <Field label="Texto del botón">
              {(id) => <Input id={id} required maxLength={30} placeholder={ctaKind === 'LINK' ? 'Ej.: Ver cobertura' : 'Ej.: Lo quiero'} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />}
            </Field>
          )}
          {ctaKind !== 'NONE' && (
            <div className="sm:col-span-2">
              <Field
                label={ctaKind === 'LINK' ? 'Destino' : 'Tema del mensaje'}
                hint={
                  ctaKind === 'LINK'
                    ? 'Una página del sitio (/cobertura, /medios-de-pago) o una URL que empiece con https://'
                    : 'Se agrega al mensaje de WhatsApp, p. ej. “1000 Mbps (promoción S/ 44.50)”.'
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    required
                    maxLength={300}
                    placeholder={ctaKind === 'LINK' ? 'Ej.: /cobertura' : 'Ej.: 1000 Mbps (promoción S/ 44.50)'}
                    value={ctaValue}
                    onChange={(e) => setCtaValue(e.target.value)}
                  />
                )}
              </Field>
            </div>
          )}
          <Field label="Mostrar desde" hint="Opcional.">
            {(id) => <Input id={id} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
          </Field>
          <Field label="Mostrar hasta" hint="Opcional. Después se oculta sola.">
            {(id) => <Input id={id} type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} />}
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={active} onChange={setActive} label="Visible en la web" />
          </div>
          <div className="sm:col-span-2">
            <ErrorNotice error={error} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={saving}>
              {slide ? 'Guardar pieza' : 'Crear pieza'}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}
