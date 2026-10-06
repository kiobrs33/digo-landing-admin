import { ArrowLeft, Check } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { cx } from '@/lib/cx'

export type PasoAsistente = {
  titulo: string
  /** Lo elegido en ese paso, cuando ya se completó (archivo, ciclo, tipo de carga…). */
  resumen?: string
}

/**
 * Asistente por pasos: barra de progreso arriba (los pasos hechos se pueden reabrir), un solo
 * paso a la vista y la navegación abajo. En móvil la barra se reduce a "Paso 2 de 4" y una línea
 * de avance.
 */
export function Asistente({
  pasos,
  actual,
  alcanzado,
  onIr,
  children,
  pie,
}: {
  pasos: PasoAsistente[]
  /** Paso visible (0-based). */
  actual: number
  /**
   * Último paso al que se puede ir: el más lejano que se visitó, siempre que lo anterior siga
   * listo (si se cambia el archivo o el ciclo, los pasos siguientes vuelven a cerrarse).
   */
  alcanzado: number
  onIr: (paso: number) => void
  children: ReactNode
  /** Botones de navegación del paso. */
  pie: ReactNode
}) {
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const primerRender = useRef(true)

  // Al cambiar de paso, el foco va a su título: el lector de pantalla anuncia dónde se está.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    tituloRef.current?.focus({ preventScroll: true })
    tituloRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [actual])

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
      <nav aria-label="Pasos" className="border-b border-line bg-surface/60 px-5 py-4 sm:px-6">
        {/* Móvil: paso actual y barra de avance. */}
        <div className="sm:hidden">
          <p className="text-xs font-medium text-muted">
            Paso {actual + 1} de {pasos.length}
          </p>
          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }}>
            {pasos.map((paso, index) => (
              <button
                key={paso.titulo}
                type="button"
                disabled={index > alcanzado}
                onClick={() => onIr(index)}
                aria-label={`Paso ${index + 1}: ${paso.titulo}`}
                aria-current={index === actual ? 'step' : undefined}
                className={cx(
                  'h-1.5 rounded-full transition-colors',
                  index < actual ? 'bg-navy' : index === actual ? 'bg-magenta' : 'bg-line',
                )}
              />
            ))}
          </div>
        </div>

        {/* Escritorio: los pasos con su número, título y lo elegido. */}
        <ol className="hidden items-start sm:flex">
          {pasos.map((paso, index) => {
            // Hecho: ya se pasó por él y lo elegido sigue valiendo.
            const hecho = index !== actual && index <= alcanzado
            const disponible = index <= alcanzado
            const esActual = index === actual
            return (
              <li key={paso.titulo} className="flex min-w-0 flex-1 items-start last:flex-none">
                <button
                  type="button"
                  disabled={!disponible || esActual}
                  onClick={() => onIr(index)}
                  aria-current={esActual ? 'step' : undefined}
                  className={cx(
                    'group flex min-w-0 items-start gap-3 rounded-lg p-1 pr-3 text-left transition-colors',
                    disponible && !esActual && 'hover:bg-white',
                    !disponible && 'cursor-default',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors',
                      esActual && 'bg-magenta text-white ring-4 ring-magenta/15',
                      !esActual && hecho && 'bg-navy text-white',
                      !esActual && !hecho && 'bg-white text-muted ring-1 ring-line',
                    )}
                  >
                    {hecho && !esActual ? <Check className="size-4" aria-hidden /> : index + 1}
                  </span>
                  <span className="min-w-0 pt-1">
                    <span
                      className={cx(
                        'block text-sm leading-tight font-semibold',
                        esActual ? 'text-navy' : hecho ? 'text-ink group-hover:text-navy' : 'text-muted',
                      )}
                    >
                      {paso.titulo}
                    </span>
                    {paso.resumen && hecho && (
                      <span className="mt-0.5 block truncate text-xs text-muted" title={paso.resumen}>
                        {paso.resumen}
                      </span>
                    )}
                  </span>
                </button>
                {index < pasos.length - 1 && (
                  <span
                    aria-hidden
                    className={cx('mx-1 mt-5 h-px min-w-4 flex-1 transition-colors', index < actual ? 'bg-navy' : 'bg-line')}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div key={actual} className="paso-enter px-5 py-6 sm:px-6">
        <h2 ref={tituloRef} tabIndex={-1} className="mb-1 text-lg font-bold text-navy outline-none">
          {pasos[actual].titulo}
        </h2>
        {children}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/40 px-5 py-4 sm:px-6">
        {pie}
      </footer>
    </section>
  )
}

/** Botón "Atrás" del pie del asistente. */
export function BotonAtras({ onClick, children = 'Atrás' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <Button variant="ghost" onClick={onClick} className="-ml-3">
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Button>
  )
}
