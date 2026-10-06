import { createContext, useContext } from 'react'

export type ToastInput = {
  message: string
  tone?: 'success' | 'error' | 'info'
  /** Acción opcional, p. ej. "Deshacer". */
  action?: { label: string; onClick: () => void }
}

export const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

/** Muestra un aviso breve que también se anuncia al lector de pantalla. */
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast debe usarse dentro de Toaster')
  return toast
}
