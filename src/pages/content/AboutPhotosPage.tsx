import { Images, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { AboutCategory, AboutPhoto, MediaAsset } from '@/api/types'
import { ImageField } from '@/components/ImageField'
import { saveAltIfChanged } from '@/lib/upload'
import { Badge, Button, Card, EmptyState, ErrorNotice, Field, Input, ListSkeleton, Select } from '@/components/ui'
import { aboutCategoryLabel } from '@/lib/labels'
import { CollectionEditor, CollectionRow, type EditorProps, NewItemLink, OrderHint, Toggle } from './collection'
import { useCollection } from './useCollection'
import { useContentSite } from './site'
import { SortableList } from '@/components/Sortable'

type PhotoBody = { imageId: string; category: AboutCategory; caption: string; active: boolean }

export function AboutPhotosPage() {
  const { site } = useContentSite()
  const { list, remove, moveById } = useCollection<AboutPhoto, PhotoBody>(site, 'about-photos')

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <OrderHint>Galería de la página Nosotros: la foto 1 se ve primero. Arrastra las fotos para cambiar el orden.</OrderHint>
        <NewItemLink>
          <Plus className="size-4" aria-hidden />
          Nueva foto
        </NewItemLink>
      </div>

      <ErrorNotice error={list.error ?? remove.error} />
      {list.isPending ? (
        <ListSkeleton rows={3} />
      ) : !list.data?.length ? (
        <EmptyState title="Sin fotos" icon={<Images />}>
          Sube fotos del equipo, obras, oficinas o actividades.
        </EmptyState>
      ) : (
        <SortableList
          ids={list.data.map((item) => item.id)}
          names={Object.fromEntries(list.data.map((photo) => [photo.id, photo.caption || 'Foto']))}
          onMove={moveById}
        >
          <ul className="divide-y divide-line overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
            {list.data.map((photo, index) => (
              <CollectionRow
                id={photo.id}
                key={photo.id}
                index={index}
                editTo={photo.id}
                active={photo.active}
                name={photo.caption || 'Foto'}
                onDelete={() => remove.mutate(photo.id)}
                deleting={remove.isPending && remove.variables === photo.id}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={photo.image.url}
                    alt=""
                    loading="lazy"
                    className="h-20 w-16 shrink-0 rounded-lg bg-surface object-cover ring-1 ring-line"
                  />
                  <div className="min-w-0">
                    <Badge tone="brand">{aboutCategoryLabel[photo.category]}</Badge>
                    <p className="mt-1 line-clamp-2 text-sm">{photo.caption || <span className="text-muted">Sin texto</span>}</p>
                  </div>
                </div>
              </CollectionRow>
            ))}
          </ul>
        </SortableList>
      )}
    </>
  )
}

/** Crear o editar, en su propia vista. */
export function PhotoEditPage() {
  return (
    <CollectionEditor<AboutPhoto, PhotoBody> resource="about-photos" newTitle="Nueva foto" name={(photo) => photo.caption || 'foto'}>
      {(photo, props) => <PhotoForm photo={photo} {...props} />}
    </CollectionEditor>
  )
}

function PhotoForm({ photo, saving, error, onSave, onCancel }: { photo: AboutPhoto | null } & EditorProps<PhotoBody>) {
  const { site } = useContentSite()
  const [image, setImage] = useState<MediaAsset | null>(photo?.image ?? null)
  const [alt, setAlt] = useState(photo?.image.alt ?? '')
  const [category, setCategory] = useState<AboutCategory>(photo?.category ?? 'PROYECTOS')
  const [caption, setCaption] = useState(photo?.caption ?? '')
  const [active, setActive] = useState(photo?.active ?? true)
  const [imageError, setImageError] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!image) return setImageError(true)
    await saveAltIfChanged(image, alt)
    onSave({ imageId: image.id, category, caption, active })
  }

  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <ImageField
            label="Foto"
            site={site}
            value={image}
            onChange={(asset) => {
              setImage(asset)
              setImageError(false)
            }}
            alt={alt}
            onAltChange={setAlt}
            aspect="aspect-[4/5]"
          />
          {imageError && <p className="mt-2 text-xs text-red-700">Sube una foto.</p>}
        </div>
        <div className="grid content-start gap-4">
          <Field label="Categoría">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as AboutCategory)}>
                {Object.entries(aboutCategoryLabel).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Texto que acompaña la foto" hint="Opcional.">
            {(id) => <Input id={id} maxLength={200} placeholder="Ej.: Ampliamos la red de fibra óptica en las calles de Arequipa." value={caption} onChange={(e) => setCaption(e.target.value)} />}
          </Field>
          <Toggle checked={active} onChange={setActive} label="Visible en la web" />
          <ErrorNotice error={error} />
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {photo ? 'Guardar foto' : 'Agregar foto'}
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
