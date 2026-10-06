import type { ReactNode } from 'react'

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-bold text-navy">{children}</h2>
}

/**
 * Lista de pares etiqueta/valor. En móvil la etiqueta va sobre su valor y cada par se separa
 * del siguiente (antes etiqueta y valor flotaban a la misma distancia que la fila vecina).
 */
export function Dl({ rows, compact }: { rows: [string, ReactNode][]; compact?: boolean }) {
  return (
    <dl
      className={`grid text-sm ${
        compact ? 'grid-cols-[110px_1fr] gap-x-4 gap-y-3' : 'gap-y-4 sm:grid-cols-[180px_1fr] sm:gap-x-6 sm:gap-y-3'
      }`}
    >
      {rows
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([label, value]) => (
          <div key={label} className={compact ? 'contents' : 'grid gap-0.5 sm:contents'}>
            <dt className="text-muted">{label}</dt>
            <dd className="whitespace-pre-wrap break-words">{value}</dd>
          </div>
        ))}
    </dl>
  )
}
