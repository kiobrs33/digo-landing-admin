import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef } from 'react'

/**
 * Ventana modal sobre `<dialog>`: el navegador atrapa el foco, Escape la cierra y el foco vuelve
 * al botón que la abrió. Clic en el fondo también cierra. El contenido se monta solo al abrir,
 * así un formulario empieza siempre con los datos actuales.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,34rem)] overflow-hidden rounded-2xl border-0 bg-white p-0 text-ink shadow-[0_24px_64px_-24px_rgb(3_11_51/0.55)] backdrop:bg-navy-900/55"
    >
      {open && (
        // Una sola zona con scroll: el cuerpo. Cabecera y pie (si el contenido lo trae) quedan fijos.
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-bold text-navy">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-alt hover:text-navy"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      )}
    </dialog>
  )
}
