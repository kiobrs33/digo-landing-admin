import { useQuery } from '@tanstack/react-query'
import { ImagePlus, RefreshCw } from 'lucide-react'
import { type DragEvent, useId, useRef, useState } from 'react'
import { api } from '@/api/client'
import type { MediaAsset, Site, UploadConfig } from '@/api/types'
import { ErrorNotice } from '@/components/ui'
import { cx } from '@/lib/cx'
import { ACCEPT_ATTR, uploadImage } from '@/lib/upload'

/**
 * Imagen de un formulario: vista previa, subir/reemplazar (clic o arrastrar) y texto alternativo.
 * La imagen se sube al elegirla; el formulario guarda el id al enviar.
 */
export function ImageField({
  label,
  site,
  value,
  onChange,
  alt,
  onAltChange,
  aspect = 'aspect-square',
  hint,
}: {
  label: string
  site: Site
  value: MediaAsset | null
  onChange: (asset: MediaAsset) => void
  alt: string
  onAltChange: (alt: string) => void
  aspect?: string
  hint?: string
}) {
  const inputId = useId()
  const altId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [dragging, setDragging] = useState(false)

  const config = useQuery({
    queryKey: ['media', 'config'],
    queryFn: () => api<UploadConfig>('/admin/media/config'),
    staleTime: Infinity,
  })

  const handleFile = async (file: File | undefined) => {
    if (!file || !config.data) return
    setError(null)
    setUploading(true)
    try {
      onChange(await uploadImage(file, site, config.data, alt))
    } catch (uploadError) {
      setError(uploadError)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'relative grid w-full max-w-xs place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-surface transition-colors',
          aspect,
          dragging ? 'border-magenta bg-magenta/5' : 'border-line',
        )}
      >
        {value ? (
          <img src={value.url} alt={alt} className="size-full object-contain" />
        ) : (
          <div className="px-4 text-center text-sm text-muted">
            <ImagePlus className="mx-auto mb-2 size-7 text-navy/40" aria-hidden />
            Arrastra una imagen o elígela
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-navy" role="status">
            Subiendo…
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !config.data}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-navy ring-1 ring-line transition-colors hover:bg-surface-alt disabled:opacity-60"
        >
          {value ? <RefreshCw className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
          {value ? 'Reemplazar imagen' : 'Elegir imagen'}
        </button>
        <span className="text-xs text-muted">
          JPG, PNG o WebP · máx. 5 MB
          {config.data?.mode === 'local' && ' · modo local (sin Cloudinary)'}
        </span>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>
      {error ? <ErrorNotice error={error} /> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={altId} className="text-sm font-medium text-ink">
          Descripción de la imagen
        </label>
        <input
          id={altId}
          value={alt}
          maxLength={300}
          onChange={(event) => onAltChange(event.target.value)}
          placeholder="Qué se ve en la imagen (para lectores de pantalla y Google)"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15"
        />
      </div>
    </div>
  )
}
