import { Link } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'

export function NotFoundPage() {
  return (
    <EmptyState title="Página no encontrada">
      <Link to="/" className="font-semibold text-magenta hover:underline">
        Volver al inicio
      </Link>
    </EmptyState>
  )
}

/** Error inesperado al renderizar una pantalla: mensaje claro y forma de salir. */
export function RouteErrorPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-bold text-navy">Algo salió mal</h1>
        <p className="mt-1 text-sm text-muted">
          Ocurrió un error inesperado en esta pantalla. Recarga la página; si se repite, avísale al
          equipo técnico.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Recargar</Button>
          <a
            href="/"
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-navy hover:bg-surface-alt"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
