import { ExternalLink, Plus, Share2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { MediaAsset, SocialLink, SocialNetwork } from '@/api/types'
import { ImageField } from '@/components/ImageField'
import { saveAltIfChanged } from '@/lib/upload'
import { Button, Card, EmptyState, ErrorNotice, Field, Input, ListSkeleton, Select } from '@/components/ui'
import { socialNetworkLabel } from '@/lib/labels'
import { CollectionEditor, CollectionRow, type EditorProps, NewItemLink, OrderHint, Toggle } from './collection'
import { useCollection } from './useCollection'
import { useContentSite } from './site'
import { SortableList } from '@/components/Sortable'

type SocialBody = { network: SocialNetwork; label: string; url: string; iconId: string | null; active: boolean }

export function SocialPage() {
  const { site } = useContentSite()
  const { list, remove, moveById } = useCollection<SocialLink, SocialBody>(site, 'social')

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <OrderHint>Aparecen en el pie de página en este orden. Arrastra las filas para cambiarlo.</OrderHint>
        <NewItemLink>
          <Plus className="size-4" aria-hidden />
          Nueva red
        </NewItemLink>
      </div>

      <ErrorNotice error={list.error ?? remove.error} />
      {list.isPending ? (
        <ListSkeleton rows={2} />
      ) : !list.data?.length ? (
        <EmptyState title="Sin redes sociales" icon={<Share2 />}>
          Agrega Facebook, Instagram, TikTok u otra.
        </EmptyState>
      ) : (
        <SortableList
          ids={list.data.map((item) => item.id)}
          names={Object.fromEntries(list.data.map((link) => [link.id, link.label]))}
          onMove={moveById}
        >
          <ul className="divide-y divide-line overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
            {list.data.map((link, index) => (
              <CollectionRow
                id={link.id}
                key={link.id}
                index={index}
                editTo={link.id}
                active={link.active}
                name={link.label}
                onDelete={() => remove.mutate(link.id)}
                deleting={remove.isPending && remove.variables === link.id}
              >
                <div className="flex items-center gap-3">
                  {link.icon ? (
                    <img src={link.icon.url} alt="" className="size-9 rounded-lg object-contain ring-1 ring-line" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-lg bg-navy text-xs font-bold text-white">
                      {socialNetworkLabel[link.network].slice(0, 2)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-navy">{link.label}</p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-1 text-xs text-muted hover:text-navy"
                    >
                      <span className="truncate">{link.url}</span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
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
export function SocialEditPage() {
  return (
    <CollectionEditor<SocialLink, SocialBody> resource="social" newTitle="Nueva red social" name={(link) => link.label}>
      {(link, props) => <SocialForm link={link} {...props} />}
    </CollectionEditor>
  )
}

function SocialForm({ link, saving, error, onSave, onCancel }: { link: SocialLink | null } & EditorProps<SocialBody>) {
  const { site } = useContentSite()
  const [network, setNetwork] = useState<SocialNetwork>(link?.network ?? 'INSTAGRAM')
  const [label, setLabel] = useState(link?.label ?? socialNetworkLabel.INSTAGRAM)
  const [url, setUrl] = useState(link?.url ?? 'https://')
  const [customIcon, setCustomIcon] = useState(Boolean(link?.icon))
  const [icon, setIcon] = useState<MediaAsset | null>(link?.icon ?? null)
  const [iconAlt, setIconAlt] = useState(link?.icon?.alt ?? '')
  const [active, setActive] = useState(link?.active ?? true)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const iconId = customIcon && icon ? icon.id : null
    if (iconId) await saveAltIfChanged(icon, iconAlt)
    onSave({ network, label, url, iconId, active })
  }

  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Red">
          {(id) => (
            <Select
              id={id}
              value={network}
              onChange={(e) => {
                const next = e.target.value as SocialNetwork
                // El nombre sigue a la red mientras no se haya personalizado.
                if (label === socialNetworkLabel[network]) setLabel(socialNetworkLabel[next])
                setNetwork(next)
              }}
            >
              {Object.entries(socialNetworkLabel).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nombre visible">
          {(id) => <Input id={id} required maxLength={40} placeholder="Ej.: Facebook" value={label} onChange={(e) => setLabel(e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Enlace" hint="La dirección completa del perfil, empezando con https://">
            {(id) => <Input id={id} type="url" required pattern="https://.+" placeholder="https://www.facebook.com/digotelecom" value={url} onChange={(e) => setUrl(e.target.value)} />}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Toggle
            checked={customIcon}
            onChange={setCustomIcon}
            label="Usar un ícono propio"
            description="Si está apagado, la web usa el ícono oficial de la red."
          />
        </div>
        {customIcon && (
          <div className="sm:col-span-2">
            <ImageField label="Ícono" hint="Cuadrado, idealmente PNG con fondo transparente." site={site} value={icon} onChange={setIcon} alt={iconAlt} onAltChange={setIconAlt} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Toggle checked={active} onChange={setActive} label="Visible en la web" />
        </div>
        <div className="sm:col-span-2">
          <ErrorNotice error={error} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={saving}>
            {link ? 'Guardar' : 'Agregar red'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}
