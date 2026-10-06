import { FileUp, X } from 'lucide-react'
import { type DragEvent, type ReactNode, useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui'
import { cx } from '@/lib/cx'

/**
 * Zona para soltar o elegir archivos. Solo acepta las extensiones de `accept` (p. ej. ".xlsx");
 * con `multiple`, los archivos nuevos se suman a los ya elegidos.
 */
export function FileDrop({
  accept,
  multiple,
  files,
  onChange,
  title,
  hint,
}: {
  accept: string
  multiple?: boolean
  files: File[]
  onChange: (files: File[]) => void
  title: string
  hint: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState('')

  const add = (list: FileList | null) => {
    const all = Array.from(list ?? [])
    const ok = all.filter((file) => file.name.toLowerCase().endsWith(accept))
    setRejected(ok.length < all.length ? `Solo se aceptan archivos ${accept}.` : '')
    if (!ok.length) return
    if (!multiple) return onChange([ok[0]])
    const names = new Set(files.map((file) => file.name))
    onChange([...files, ...ok.filter((file) => !names.has(file.name))])
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    add(event.dataTransfer.files)
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          over ? 'border-magenta bg-magenta/5' : 'border-line bg-surface/50',
        )}
      >
        <FileUp className="size-7 text-navy/50" aria-hidden />
        <p className="font-semibold text-navy">{title}</p>
        <p id={hintId} className="text-sm text-muted">
          Arrástralo aquí o{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-magenta underline-offset-2 hover:underline"
          >
            elígelo en tu equipo
          </button>
          . {hint}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          aria-describedby={hintId}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            add(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      {rejected && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {rejected}
        </p>
      )}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((file) => (
            <li
              key={file.name}
              className="inline-flex items-center gap-2 rounded-lg bg-surface-alt py-1 pr-1 pl-3 text-sm text-navy"
            >
              <span className="max-w-72 truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Quitar ${file.name}`}
                onClick={() => onChange(files.filter((item) => item !== file))}
                className="grid size-6 place-items-center rounded-md text-muted hover:bg-white hover:text-navy"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Cifras del resultado: una fila de datos breves. */
export function Stats({ items }: { items: { label: string; value: ReactNode; tone?: 'danger' | 'warning' }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {items.map((item, index) => (
        <div
          key={item.label}
          // En móvil (2 columnas), si son impares la última ocupa toda la fila: sin celda vacía.
          className={cx('bg-white px-4 py-3', items.length % 2 === 1 && index === items.length - 1 && 'col-span-2 sm:col-span-1')}
        >
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd
            className={cx(
              'mt-0.5 text-lg font-bold',
              item.tone === 'danger' ? 'text-red-700' : item.tone === 'warning' ? 'text-amber-700' : 'text-navy',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Una salida del proceso (descarga): su botón, los pasos a seguir y una nota. */
export function OpcionDescarga({
  titulo,
  etiqueta,
  boton,
  nota,
  children,
}: {
  titulo: string
  etiqueta?: string
  boton: ReactNode
  nota: string
  children: ReactNode
}) {
  return (
    <div className={cx('flex flex-col rounded-xl p-4 ring-1', etiqueta ? 'bg-magenta/[0.03] ring-magenta/30' : 'bg-white ring-line')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-bold text-navy">{titulo}</h3>
        {etiqueta && <Badge tone="accent">{etiqueta}</Badge>}
      </div>
      {boton}
      <ol className="mt-4 flex-1 list-decimal space-y-1.5 pl-5 text-sm text-ink marker:font-semibold marker:text-navy">
        {children}
      </ol>
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{nota}</p>
    </div>
  )
}
