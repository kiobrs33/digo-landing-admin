import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { useId } from 'react'
import { FieldContext, useFieldContext } from '@/lib/field-context'
import { cx } from '@/lib/cx'


type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-magenta text-white hover:bg-magenta-deep disabled:bg-surface-alt disabled:text-muted disabled:opacity-100',
  secondary: 'bg-white text-navy ring-1 ring-line hover:bg-surface-alt',
  ghost: 'text-navy hover:bg-surface-alt',
  danger: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50',
}

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {children}
    </button>
  )
}

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/85 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 disabled:bg-surface'

/** Etiqueta + control + ayuda/error, con el id conectado. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {/* La ayuda o el error quedan conectados al control (aria-describedby). */}
      <FieldContext.Provider value={{ describedBy: note ? noteId : undefined, invalid: Boolean(error) }}>
        {children(id)}
      </FieldContext.Provider>
      {note && (
        <p id={noteId} className={cx('text-xs', error ? 'text-red-700' : 'text-muted')}>
          {note}
        </p>
      )}
    </div>
  )
}

/** Atributos de accesibilidad heredados del `Field` que envuelve al control. */
function useFieldA11y() {
  const field = useFieldContext()
  return field ? { 'aria-describedby': field.describedBy, 'aria-invalid': field.invalid || undefined } : {}
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(fieldClass, className)} {...useFieldA11y()} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, 'pr-8', className)} {...useFieldA11y()} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(fieldClass, 'min-h-28', className)} {...useFieldA11y()} {...props} />
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-xl bg-white p-5 shadow-sm ring-1 ring-line', className)}>
      {children}
    </section>
  )
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'accent'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-muted',
  info: 'bg-blue-50 text-blue-800',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-800',
  brand: 'bg-navy/8 text-navy',
  accent: 'bg-magenta/10 text-magenta-deep',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null
  const messages =
    error instanceof Error && 'messages' in error
      ? (error as { messages: string[] }).messages
      : [error instanceof Error ? error.message : 'Error inesperado']
  return (
    <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
      {messages.length === 1 ? (
        messages[0]
      ) : (
        <ul className="list-disc pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-navy/40 [&>svg]:size-8">{icon}</div>}
      <p className="font-semibold text-navy">{title}</p>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-navy border-r-transparent" />
      {label}
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-muted" aria-label="Paginación">
      <span>
        {pages === 1
          ? `${total} ${total === 1 ? 'resultado' : 'resultados'}`
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
      </span>
      <div className={pages === 1 ? 'hidden' : 'flex gap-2'}>
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </nav>
  )
}

/** Placeholder de un listado mientras carga. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-xl bg-white shadow-sm ring-1 ring-line" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="skeleton h-4 w-24" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/5" />
            <div className="skeleton h-3 w-1/4" />
          </div>
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Placeholder de una ficha de detalle mientras carga. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-8 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    </div>
  )
}

