import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import { ToastContext, type ToastInput } from '@/lib/toast-context'

type Toast = ToastInput & { id: number }

const icons = { success: CircleCheck, error: CircleAlert, info: Info }
const iconTone = { success: 'text-emerald-400', error: 'text-red-300', info: 'text-sky-300' }

/**
 * Avisos breves abajo a la derecha (abajo al centro en móvil). La región es `role="status"`:
 * el lector de pantalla los anuncia sin mover el foco. Con acción (p. ej. "Deshacer") duran más.
 */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), [])

  const show = useCallback((toast: ToastInput) => {
    const id = ++nextId.current
    setToasts((current) => [...current.slice(-2), { tone: 'success', ...toast, id }])
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDone={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const Icon = icons[toast.tone ?? 'success']
  const [hover, setHover] = useState(false)

  useEffect(() => {
    if (hover) return
    const timer = setTimeout(onDone, toast.action ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [hover, onDone, toast.action])

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="toast-enter pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-navy-900 px-4 py-3 text-sm text-white shadow-[0_12px_32px_-12px_rgb(3_11_51/0.6)]"
    >
      <Icon className={cx('size-4 shrink-0', iconTone[toast.tone ?? 'success'])} aria-hidden />
      <p className="flex-1">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="rounded-md px-2 py-1 font-semibold text-white underline-offset-4 hover:underline"
          onClick={() => {
            toast.action?.onClick()
            onDone()
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" aria-label="Cerrar aviso" onClick={onDone} className="rounded-md p-1 text-white/70 hover:text-white">
        <X className="size-4" />
      </button>
    </div>
  )
}
