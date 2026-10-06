import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudUpload, ExternalLink, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import type { ContentChange, PublishStatus, Site } from '@/api/types'
import { useAuth } from '@/auth/context'
import { Modal } from '@/components/Modal'
import { Badge, Button, ErrorNotice } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/lib/toast-context'
import { spaceOfSite, useSpace } from '@/lib/space'
import { publishKey } from '@/pages/content/site'

const siteName = (site: Site) => spaceOfSite(site).name
const siteUrl = (site: Site) => spaceOfSite(site).url

const actionLabel: Record<ContentChange['action'], string> = {
  CREADO: 'Agregado',
  EDITADO: 'Editado',
  ELIMINADO: 'Eliminado',
  REORDENADO: 'Reordenado',
}

const actionTone = { CREADO: 'success', EDITADO: 'info', ELIMINADO: 'danger', REORDENADO: 'neutral' } as const

/**
 * Publicar, en el encabezado del panel (solo administradores). Aparece solo si hay cambios sin
 * publicar; abre un modal con lo que cambió en cada web para publicarlo o descartarlo.
 */
export function PublishCenter() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const status = useQuery({
    queryKey: [...publishKey, 'all'],
    queryFn: () => api<PublishStatus[]>('/admin/publish'),
    enabled: user?.role === 'ADMIN',
  })

  // Solo los cambios del espacio en el que se está trabajando.
  const space = useSpace()
  const pending = (status.data ?? []).filter((site) => site.pendingChanges && site.site === space.site)
  const count = pending.reduce((sum, site) => sum + Math.max(1, site.changes.length), 0)
  if (user?.role !== 'ADMIN' || (!pending.length && !open)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-magenta/10 px-3 text-sm font-semibold text-magenta-deep transition-colors hover:bg-magenta/15"
      >
        <CloudUpload className="size-4" aria-hidden />
        <span className="hidden sm:inline">{count === 1 ? '1 cambio sin publicar' : `${count} cambios sin publicar`}</span>
        <span className="grid min-w-5 place-items-center rounded-full bg-magenta px-1.5 text-[11px] leading-5 text-white tabular-nums sm:hidden">
          {count}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cambios sin publicar"
        description="La web sigue mostrando la versión anterior hasta que publiques."
      >
        <div className="flex flex-col divide-y divide-line">
          {pending.length ? (
            pending.map((site) => <SitePending key={site.site} status={site} />)
          ) : (
            <p className="px-6 py-8 text-center text-sm text-muted">Todo está publicado.</p>
          )}
        </div>
      </Modal>
    </>
  )
}

/** Cambios de un sitio, con Publicar y Descartar (este último pide confirmación). */
function SitePending({ status }: { status: PublishStatus }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const path = `/admin/sites/${status.site.toLowerCase()}/publish`
  const changes = status.changes

  const publish = useMutation({
    mutationFn: () => api<PublishStatus>(path, { method: 'POST' }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: publishKey })
      toast({
        message: data.simulated
          ? `${siteName(status.site)}: publicación registrada (modo de prueba).`
          : `${siteName(status.site)}: la web se actualiza en 1 a 2 minutos.`,
        action: { label: 'Ver la web', onClick: () => window.open(siteUrl(status.site), '_blank', 'noopener') },
      })
    },
  })

  const discard = useMutation({
    mutationFn: () => api<PublishStatus>(`${path}/discard`, { method: 'POST' }),
    onSuccess: () => {
      // El contenido volvió a lo publicado: listas y formularios se recargan.
      void queryClient.invalidateQueries({ queryKey: ['content'] })
      void queryClient.invalidateQueries({ queryKey: publishKey })
      setConfirmingDiscard(false)
      toast({ message: `${siteName(status.site)}: cambios descartados. Todo quedó como en la web.` })
    },
  })

  // Deshacer un solo cambio: ese elemento (o el orden de esa lista) vuelve a lo publicado.
  const undo = useMutation({
    mutationFn: (change: ContentChange) =>
      api<PublishStatus>(`${path}/undo`, { method: 'POST', body: { key: change.key } }),
    onSuccess: (_data, change) => {
      void queryClient.invalidateQueries({ queryKey: ['content'] })
      void queryClient.invalidateQueries({ queryKey: publishKey })
      toast({ message: `Se deshizo: ${change.entity} «${change.label}».` })
    },
  })

  const busy = publish.isPending || discard.isPending || undo.isPending

  return (
    <section aria-label={siteName(status.site)} className="px-6 py-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold text-navy">
          {siteName(status.site)}{' '}
          <span className="font-normal text-muted">
            · {changes.length === 1 ? '1 cambio' : `${changes.length} cambios`}
          </span>
        </h3>
        <a
          href={siteUrl(status.site)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
        >
          Ver la web
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </header>

      <ul className="scroll-thin mb-4 grid max-h-64 gap-2 overflow-y-auto rounded-lg bg-surface p-3 text-sm">
        {changes.map((change) => (
          <li key={change.key} className="flex items-center gap-x-2">
            <Badge tone={actionTone[change.action]}>{actionLabel[change.action]}</Badge>
            <span className="min-w-0 flex-1">
              {change.entity}: <strong className="font-semibold">{change.label}</strong>
              <span className="block text-xs text-muted">{formatDateTime(change.at)}</span>
            </span>
            {change.undoable && (
              <button
                type="button"
                onClick={() => undo.mutate(change)}
                disabled={busy}
                aria-label={`Deshacer: ${change.entity} ${change.label}`}
                title="Deshacer este cambio"
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-white hover:text-red-700 disabled:opacity-50"
              >
                {undo.isPending && undo.variables?.key === change.key ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                ) : (
                  <Undo2 className="size-3.5" aria-hidden />
                )}
                Deshacer
              </button>
            )}
          </li>
        ))}
        {changes.length === 0 && <li className="text-muted">Cambios anteriores al registro detallado.</li>}
      </ul>

      {status.simulated && (
        <p className="mb-3 text-xs text-muted">
          Modo de prueba: falta configurar el Deploy Hook de Vercel; la publicación solo se registra.
        </p>
      )}

      {confirmingDiscard ? (
        <div className="flex flex-col gap-3 rounded-lg bg-red-50 p-3 ring-1 ring-red-200 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-900">
            ¿Descartar todo? {siteName(status.site)} vuelve a la versión publicada
            {status.publishedAt ? ` (${formatDateTime(status.publishedAt)})` : ''}. No se puede deshacer.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={() => setConfirmingDiscard(false)} disabled={discard.isPending}>
              Cancelar
            </Button>
            <Button variant="danger" autoFocus loading={discard.isPending} onClick={() => discard.mutate()}>
              Sí, descartar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {status.canDiscard ? (
            <Button variant="ghost" className="text-red-700 hover:bg-red-50" disabled={busy} onClick={() => setConfirmingDiscard(true)}>
              <Undo2 className="size-4" aria-hidden />
              Descartar todo
            </Button>
          ) : (
            <p className="text-xs text-muted">Descartar estará disponible después de la próxima publicación.</p>
          )}
          <Button loading={publish.isPending} disabled={busy} onClick={() => publish.mutate()}>
            <CloudUpload className="size-4" aria-hidden />
            Publicar {siteName(status.site)}
          </Button>
        </div>
      )}
      <div className="mt-3 empty:hidden">
        <ErrorNotice error={publish.error ?? discard.error ?? undo.error} />
      </div>
    </section>
  )
}
