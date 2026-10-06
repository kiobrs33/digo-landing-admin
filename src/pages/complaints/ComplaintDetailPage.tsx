import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  FileSignature,
  Hand,
  Mail,
  MailCheck,
  MessageCircle,
  PenLine,
  Phone,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { type FormEvent, Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Complaint, ComplaintStatus } from '@/api/types'
import { useAssignable } from '@/api/useAssignable'
import { useAuth } from '@/auth/context'
import { Dl, SectionTitle } from '@/components/DetailParts'
import { Modal } from '@/components/Modal'
import { Badge, Button, Card, DetailSkeleton, ErrorNotice, Field, PageHeader, Select, Textarea } from '@/components/ui'
import { useCrumbLabel } from '@/lib/crumbs'
import { cx } from '@/lib/cx'
import { formatDate, formatDateTime } from '@/lib/format'
import { documentLabel } from '@/lib/labels'
import { useSpacePath } from '@/lib/space'
import { pendingPlaceholders, responseTemplates } from '@/lib/responseTemplates'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'
import { DeadlineBadge } from './ComplaintBadges'

type ComplaintDetail = Complaint & { providerName?: string }

const detailKey = (id: string) => ['complaints', 'detail', id]
const kindWord = (c: Pick<Complaint, 'kind'>) => (c.kind === 'QUEJA' ? 'queja' : 'reclamo')

const linkPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700'

/**
 * Carga la hoja de la URL para sus tres vistas (detalle, responder, gestión) y nombra su miga.
 * `children` recibe la hoja ya cargada; la `key` reinicia el estado local al cambiar de hoja.
 */
function WithComplaint({ title, children }: { title?: (c: ComplaintDetail) => string; children: (c: ComplaintDetail) => ReactNode }) {
  const path = useSpacePath()
  const { id = '' } = useParams()
  const complaint = useQuery({
    queryKey: detailKey(id),
    queryFn: () => api<ComplaintDetail>(`/admin/complaints/${id}`),
  })
  const c = complaint.data
  useCrumbLabel(path(`/reclamos/${id}`), c && `Hoja N° ${c.code}`)
  usePageTitle(c ? (title?.(c) ?? `Hoja ${c.code}`) : 'Hoja de reclamación')

  if (complaint.isPending) return <DetailSkeleton />
  if (complaint.error) return <ErrorNotice error={complaint.error} />
  return <Fragment key={complaint.data.id}>{children(complaint.data)}</Fragment>
}

/** Refresca la hoja en caché tras un cambio (y marca el listado para recargar). */
function useRefreshComplaint() {
  const queryClient = useQueryClient()
  return (data: ComplaintDetail) => {
    queryClient.setQueryData(detailKey(data.id), data)
    void queryClient.invalidateQueries({ queryKey: ['complaints'], refetchType: 'none' })
  }
}

export function ComplaintDetailPage() {
  return <WithComplaint>{(c) => <ComplaintView complaint={c} />}</WithComplaint>
}

export function ComplaintRespondPage() {
  const path = useSpacePath()
  return (
    <WithComplaint title={(c) => `Responder hoja ${c.code}`}>
      {(c) => (c.status === 'RESPONDIDO' ? <Navigate to={path(`/reclamos/${c.id}`)} replace /> : <RespondView complaint={c} />)}
    </WithComplaint>
  )
}

/** La gestión vive en un modal sobre el detalle; la ruta antigua lo abre directamente. */
export function ComplaintManagePage() {
  const path = useSpacePath()
  const { id = '' } = useParams()
  return <Navigate to={path(`/reclamos/${id}?gestion=1`)} replace />
}

function ComplaintHeading({ complaint: c, title, actions }: { complaint: ComplaintDetail; title?: string; actions?: ReactNode }) {
  return (
    <PageHeader
      title={title ?? `Hoja N° ${c.code}`}
      description={`${c.kind === 'QUEJA' ? 'Queja' : 'Reclamo'} de ${c.fullName}`}
      actions={actions}
    />
  )
}

/** Qué significa cada estado: lo lee la franja de avance de la hoja. */
const statusMeaning: Record<ComplaintStatus, string> = {
  PENDIENTE: 'Nadie la ha tomado todavía, y el plazo legal ya corre.',
  EN_PROCESO: 'Alguien del equipo la está atendiendo.',
  RESPONDIDO: 'La respuesta oficial ya se envió al consumidor y no se puede modificar.',
}

const whatsappHref = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.length === 9 ? `51${digits}` : digits}`
}

function ComplaintView({ complaint: c }: { complaint: ComplaintDetail }) {
  const toast = useToast()
  const refresh = useRefreshComplaint()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const managing = params.get('gestion') === '1'
  const setManaging = (value: boolean) => {
    const next = new URLSearchParams(params)
    if (value) next.set('gestion', '1')
    else next.delete('gestion')
    setParams(next, { replace: true })
  }
  const open = c.status !== 'RESPONDIDO'

  // "Tomar la hoja": me la asigno y pasa a "En proceso", así nadie más la responde a la vez.
  const take = useMutation({
    mutationFn: async () => {
      await api(`/admin/complaints/${c.id}`, { method: 'PATCH', body: { assignedToId: user?.id } })
      if (c.status === 'PENDIENTE') {
        await api(`/admin/complaints/${c.id}/status`, { method: 'PATCH', body: { status: 'EN_PROCESO' } })
      }
      // La hoja completa (con responsable y remitente), no la respuesta parcial del cambio de estado.
      return api<ComplaintDetail>(`/admin/complaints/${c.id}`)
    },
    onSuccess: (data) => {
      refresh(data)
      toast({ message: `Tomaste la hoja ${c.code}.` })
    },
  })

  const takenByOther = c.assignedTo && c.assignedTo.id !== user?.id

  return (
    <>
      <ComplaintHeading
        complaint={c}
        actions={
          <>
            <a
              href={whatsappHref(c.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#117a3a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d6630]"
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </a>
            <a
              href={`tel:${c.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy ring-1 ring-line transition-colors hover:bg-surface-alt"
            >
              <Phone className="size-4" aria-hidden />
              Llamar
            </a>
          </>
        }
      />

      {/* Dónde está la hoja, cuánto plazo queda y el siguiente paso, arriba y en todos los tamaños. */}
      <section aria-label="Estado de la hoja" className="mb-6 rounded-xl bg-white shadow-sm ring-1 ring-line">
        <StatusTrack complaint={c} />
        <div className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Respondida, la fecha ya está en el avance: el plazo solo importa mientras corre. */}
            {open && <DeadlineBadge complaint={c} />}
            <p className="text-sm text-muted">{statusMeaning[c.status]}</p>
          </div>
          {open && (
            <div className="flex flex-wrap gap-2">
              {c.assignedTo?.id !== user?.id && (
                <Button variant="secondary" loading={take.isPending} onClick={() => take.mutate()}>
                  <Hand className="size-4" aria-hidden />
                  {takenByOther ? 'Tomar la hoja (reasignar)' : 'Tomar la hoja'}
                </Button>
              )}
              <Link to="responder" className={linkPrimary}>
                <PenLine className="size-4" aria-hidden />
                Responder
              </Link>
            </div>
          )}
        </div>
      </section>
      <ErrorNotice error={take.error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ClaimCard complaint={c} />
          {/* Mientras está abierta, "Responder" va en la franja de estado; aquí, la respuesta enviada. */}
          {!open && <ResponseRecord complaint={c} />}
        </div>

        <aside className="flex flex-col gap-4">
          <ConsumerCard complaint={c} />
          <Card>
            <SectionTitle>Gestión interna</SectionTitle>
            <Dl
              compact
              rows={[
                ['Responsable', c.assignedTo?.name ?? <span key="none" className="text-muted">Sin asignar</span>],
                [
                  'Notas',
                  c.internalNotes || <span key="none" className="text-muted">Sin notas</span>,
                ],
              ]}
            />
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setManaging(true)}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Editar responsable o notas
            </Button>
            <p className="mt-3 text-xs text-muted">Solo lo ve el equipo, nunca el consumidor.</p>
          </Card>
          <Card>
            <SectionTitle>Constancia</SectionTitle>
            <p className={cx('flex items-start gap-2 text-sm', c.receiptSentAt ? 'text-muted' : 'text-red-700')}>
              {c.receiptSentAt ? (
                <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              {c.receiptSentAt
                ? `Enviada a ${c.email} el ${formatDateTime(c.receiptSentAt)}`
                : 'No se pudo enviar la constancia por correo.'}
            </p>
          </Card>
        </aside>
      </div>

      <Modal open={managing} onClose={() => setManaging(false)} title="Gestionar hoja" description={`Hoja N° ${c.code} · ${c.fullName}`}>
        <ManageForm
          complaint={c}
          onDone={() => setManaging(false)}
          onSaved={(data) => {
            refresh(data)
            setManaging(false)
          }}
        />
      </Modal>
    </>
  )
}

/**
 * Avance de la hoja: Registrada → En proceso → Respondida. Cada paso dice qué pasó y cuándo; el
 * último muestra el vencimiento mientras está abierta, y quién respondió al cerrarla.
 */
function StatusTrack({ complaint: c }: { complaint: ComplaintDetail }) {
  const order: ComplaintStatus[] = ['PENDIENTE', 'EN_PROCESO', 'RESPONDIDO']
  const labels: Record<ComplaintStatus, string> = { PENDIENTE: 'Registrada', EN_PROCESO: 'En proceso', RESPONDIDO: 'Respondida' }
  const current = order.indexOf(c.status)
  const details: Record<ComplaintStatus, ReactNode> = {
    PENDIENTE: formatDateTime(c.createdAt),
    EN_PROCESO: c.assignedTo ? `Responsable: ${c.assignedTo.name}` : current >= 1 ? 'Sin responsable' : 'Nadie la tomó aún',
    RESPONDIDO:
      c.status !== 'RESPONDIDO'
        ? `Vence el ${formatDate(c.dueDate)}`
        : `${c.respondedAt ? formatDateTime(c.respondedAt) : 'Respondida'}${c.respondedBy ? ` por ${c.respondedBy.name}` : ''}`,
  }

  return (
    <ol className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:gap-0">
      {order.map((step, index) => {
        const done = index < current || (index === current && step === 'RESPONDIDO')
        const active = index === current
        return (
          <li key={step} className="relative flex gap-3 sm:pr-4">
            {index < order.length - 1 && (
              <span
                aria-hidden
                className={cx(
                  'absolute top-3.5 right-0 left-10 hidden h-0.5 rounded sm:block',
                  index < current ? 'bg-navy' : 'bg-line',
                )}
              />
            )}
            <span
              aria-hidden
              className={cx(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 ring-white',
                done ? 'bg-emerald-600 text-white' : active ? 'bg-navy text-white' : 'bg-surface-alt text-muted',
              )}
            >
              {done ? <Check className="size-4" /> : index + 1}
            </span>
            <div className="relative z-10 min-w-0 bg-white pr-3 sm:mt-0.5">
              <p className={cx('text-sm font-semibold', index <= current ? 'text-ink' : 'text-muted')}>
                {labels[step]}
                {active && <span className="sr-only"> (estado actual)</span>}
              </p>
              <p className="text-xs text-muted">{details[step]}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Lo que reclama el consumidor, primero y legible: qué pasó y qué pide, luego el bien. */
function ClaimCard({ complaint: c }: { complaint: ComplaintDetail }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={c.kind === 'QUEJA' ? 'warning' : 'brand'}>{c.kind === 'QUEJA' ? 'Queja' : 'Reclamo'}</Badge>
        <Badge tone="neutral">{c.itemType === 'PRODUCTO' ? 'Producto' : 'Servicio'}</Badge>
        {c.amount && <Badge tone="neutral">Monto reclamado: S/ {Number(c.amount).toFixed(2)}</Badge>}
      </div>

      <SectionTitle>Qué pasó</SectionTitle>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.detail}</p>

      <h3 className="mt-6 mb-2 text-sm font-bold text-navy">Qué pide el consumidor</h3>
      <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-magenta bg-surface px-4 py-3 text-sm leading-relaxed">
        {c.request}
      </blockquote>

      <div className="mt-6 border-t border-line pt-4">
        <Dl rows={[['Bien contratado', c.itemDescription]]} />
      </div>
    </Card>
  )
}

/** Datos del consumidor, compactos: a mano para contactarlo sin bajar. */
function ConsumerCard({ complaint: c }: { complaint: ComplaintDetail }) {
  return (
    <Card>
      <SectionTitle>Consumidor</SectionTitle>
      <Dl
        compact
        rows={[
          ['Nombre', c.fullName],
          ['Documento', `${documentLabel[c.documentType]} ${c.documentNumber}`],
          ['Teléfono', <a key="tel" href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-navy underline">{c.phone}</a>],
          ['Correo', <a key="email" href={`mailto:${c.email}`} className="text-navy underline">{c.email}</a>],
          ['Domicilio', c.address],
          ['Menor de edad', c.isMinor ? 'Sí' : null],
          ['Apoderado', c.guardianName && `${c.guardianName} (${c.guardianDocument})`],
        ]}
      />
    </Card>
  )
}

/** Responder: el redactor a la izquierda y, a la derecha, lo que pidió el consumidor. */
function RespondView({ complaint: c }: { complaint: ComplaintDetail }) {
  const path = useSpacePath()
  const navigate = useNavigate()
  const refresh = useRefreshComplaint()
  return (
    <>
      <ComplaintHeading complaint={c} title={`Responder hoja N° ${c.code}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <ResponseComposer
            complaint={c}
            onCancel={() => navigate(path(`/reclamos/${c.id}`))}
            onResponded={(data) => {
              refresh(data)
              navigate(path(`/reclamos/${c.id}`))
            }}
          />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionTitle>Lo que pide el consumidor</SectionTitle>
            <Dl
              compact
              rows={[
                ['Plazo', <DeadlineBadge key="deadline" complaint={c} />],
                ['Bien', c.itemDescription],
                ['Detalle', c.detail],
                ['Pedido', c.request],
              ]}
            />
            <Link to={path(`/reclamos/${c.id}`)} className="mt-4 inline-block text-sm font-semibold text-navy hover:text-magenta">
              Ver la hoja completa
            </Link>
          </Card>
        </aside>
      </div>
    </>
  )
}

/** Responsable y notas internas, en el modal "Gestionar": el consumidor nunca las ve. */
function ManageForm({
  complaint: c,
  onSaved,
  onDone,
}: {
  complaint: ComplaintDetail
  onSaved: (data: ComplaintDetail) => void
  onDone: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()
  const assignable = useAssignable().data ?? []
  const [assignedToId, setAssignedToId] = useState(c.assignedTo?.id ?? '')
  const [notes, setNotes] = useState(c.internalNotes ?? '')
  const dirty = assignedToId !== (c.assignedTo?.id ?? '') || notes !== (c.internalNotes ?? '')

  const save = useMutation({
    mutationFn: () =>
      api<ComplaintDetail>(`/admin/complaints/${c.id}`, {
        method: 'PATCH',
        body: { assignedToId: assignedToId || null, internalNotes: notes },
      }),
    onSuccess: (data) => {
      onSaved(data)
      toast({ message: 'Gestión de la hoja guardada.' })
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <Field label="Responsable">
          {(id) => (
            <div className="flex gap-2">
              <Select id={id} className="flex-1" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                <option value="">Sin asignar</option>
                {c.assignedTo && !assignable.some((u) => u.id === c.assignedTo?.id) && (
                  <option value={c.assignedTo.id}>{c.assignedTo.name}</option>
                )}
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              {user && assignedToId !== user.id && (
                <Button variant="secondary" onClick={() => setAssignedToId(user.id)}>
                  Asignarme
                </Button>
              )}
            </div>
          )}
        </Field>
        <Field label="Notas internas" hint="Solo las ve el equipo, nunca el consumidor.">
          {(id) => (
            <Textarea
              id={id}
              rows={5}
              className="min-h-28"
              placeholder="Ej.: Se llamó al cliente el 6/10; pide visita por la tarde."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </Field>
        <ErrorNotice error={save.error} />
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line bg-surface/60 px-6 py-3.5">
        <p className="text-xs text-muted" aria-live="polite">
          {dirty ? 'Cambios sin guardar' : 'Sin cambios'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!dirty}>
            Guardar
          </Button>
        </div>
      </footer>
    </form>
  )
}

const draftKey = (id: string) => `digo:borrador-reclamo:${id}`

function readDraft(id: string) {
  try {
    return localStorage.getItem(draftKey(id)) ?? ''
  } catch {
    return ''
  }
}

/**
 * Responder es el único acto legal e irreversible del panel, así que va en dos pasos:
 * 1) redactar (con borrador guardado en el navegador y plantillas) y
 * 2) revisar el correo tal como lo recibirá el consumidor, confirmar y enviar.
 */
function ResponseComposer({
  complaint: c,
  onResponded,
  onCancel,
}: {
  complaint: ComplaintDetail
  onResponded: (data: ComplaintDetail) => void
  onCancel: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState(() => readDraft(c.id))
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [step, setStep] = useState<'write' | 'review'>('write')
  const [reviewed, setReviewed] = useState(false)
  const [template, setTemplate] = useState('')
  const reviewRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const trimmed = text.trim()
  const placeholders = pendingPlaceholders(text)

  // Borrador: se guarda al dejar de escribir; sobrevive a recargar o salir a otra pantalla.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (trimmed) localStorage.setItem(draftKey(c.id), text)
        else localStorage.removeItem(draftKey(c.id))
        if (trimmed) setSavedAt(Date.now())
      } catch {
        /* sin almacenamiento local: el borrador solo vive en esta pantalla */
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [text, trimmed, c.id])

  // El foco acompaña el paso: al revisar va al título; al volver a editar, al texto.
  const previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    if (step === 'review') reviewRef.current?.focus()
    else textRef.current?.focus()
  }, [step])

  const respond = useMutation({
    mutationFn: () =>
      api<ComplaintDetail & { responseSent: boolean }>(`/admin/complaints/${c.id}/response`, {
        method: 'POST',
        body: { response: trimmed },
      }),
    onSuccess: (data) => {
      try {
        localStorage.removeItem(draftKey(c.id))
      } catch {
        /* nada que limpiar */
      }
      onResponded(data)
      toast(
        data.responseSent
          ? { message: `Respuesta enviada a ${c.email}.` }
          : { message: 'Respuesta registrada, pero el correo no salió. Reenvíalo desde la hoja.', tone: 'error' },
      )
    },
  })

  function applyTemplate(id: string) {
    const found = responseTemplates.find((item) => item.id === id)
    setTemplate('')
    if (!found) return
    if (trimmed && !window.confirm('¿Reemplazar el texto actual por la plantilla?')) return
    setText(found.build(c))
    textRef.current?.focus()
  }

  function goToReview(event?: FormEvent) {
    event?.preventDefault()
    if (trimmed.length < 10) return
    setReviewed(false)
    setStep('review')
  }

  if (step === 'review') {
    return (
      <section id="responder" aria-labelledby="review-title" className="rounded-xl bg-white shadow-sm ring-2 ring-navy">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <FileSignature className="size-5 text-magenta" aria-hidden />
          <h2 id="review-title" ref={reviewRef} tabIndex={-1} className="font-bold text-navy outline-none">
            Revisa antes de enviar
          </h2>
        </header>

        {/* Vista previa del correo tal como lo recibe el consumidor. */}
        <div className="px-5 py-4">
          <div className="overflow-hidden rounded-lg ring-1 ring-line">
            <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 bg-surface px-4 py-3 text-sm">
              <dt className="text-muted">Para</dt>
              <dd className="break-all font-semibold">{c.email}</dd>
              <dt className="text-muted">Asunto</dt>
              <dd>
                Respuesta a tu {kindWord(c)} N° {c.code} · {c.providerName ?? 'Digo Telecom'}
              </dd>
            </dl>
            <div className="space-y-3 px-4 py-4 text-sm leading-relaxed">
              <p>Hola {c.fullName}:</p>
              <p>
                Esta es nuestra respuesta a tu {kindWord(c)} registrado el {formatDateTime(c.createdAt)}:
              </p>
              <p className="whitespace-pre-wrap rounded-md bg-surface px-4 py-3">{trimmed}</p>
              <p className="text-muted">Si no estás conforme, puedes acudir al INDECOPI u OSIPTEL según corresponda.</p>
            </div>
          </div>

          {placeholders.length > 0 && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Quedan partes de la plantilla sin completar: {placeholders.join(', ')}. Vuelve a editar antes de enviar.
            </p>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-navy"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            <span>
              Revisé el texto y sé que, una vez enviado, <strong>no podré modificarlo</strong>.
            </span>
          </label>
          <ErrorNotice error={respond.error} />
        </div>

        {/* Volver a la izquierda, enviar a la derecha: el envío nunca queda bajo el botón anterior. */}
        <footer className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => setStep('write')} disabled={respond.isPending}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver a editar
          </Button>
          <Button
            loading={respond.isPending}
            disabled={!reviewed || placeholders.length > 0}
            onClick={() => respond.mutate()}
          >
            <Mail className="size-4" aria-hidden />
            Enviar respuesta definitiva
          </Button>
        </footer>
      </section>
    )
  }

  return (
    <section id="responder" aria-labelledby="write-title" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-line">
      <h2 id="write-title" className="mb-3 font-bold text-navy">
        Redacta la respuesta
      </h2>
      <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        La respuesta se envía por correo a {c.email} y queda como respuesta oficial de la hoja: no se podrá
        modificar.
      </p>
      <form onSubmit={goToReview} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Plantilla
            <select
              value={template}
              onChange={(event) => applyTemplate(event.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-navy focus:outline-none"
            >
              <option value="">Elegir…</option>
              {responseTemplates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-muted" aria-live="polite">
            {savedAt ? 'Borrador guardado en este navegador' : ''}
          </span>
        </div>
        <Field label="Respuesta al consumidor" hint="Ctrl + Enter para revisar.">
          {(id) => (
            <Textarea
              id={id}
              ref={textRef}
              required
              minLength={10}
              rows={9}
              placeholder={`Ej.: Estimado(a) ${c.fullName.split(' ')[0]}: revisamos tu ${kindWord(c)} y te informamos que…`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) goToReview()
              }}
              aria-keyshortcuts="Control+Enter"
            />
          )}
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="secondary" disabled={trimmed.length < 10}>
            Revisar respuesta
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </form>
    </section>
  )
}

/** Hoja ya respondida: la respuesta, quién y cuándo, reenviar, y pasar a la siguiente pendiente. */
function ResponseRecord({ complaint: c }: { complaint: ComplaintDetail }) {
  const path = useSpacePath()
  const toast = useToast()
  const navigate = useNavigate()
  const next = useQuery({
    queryKey: ['complaints', 'next', c.id],
    queryFn: () => api<{ id: string; code: string } | null>('/admin/complaints/next', { query: { after: c.id, site: c.site } }),
  })
  const resend = useMutation({
    mutationFn: () => api<{ responseSent: boolean }>(`/admin/complaints/${c.id}/response/resend`, { method: 'POST' }),
    onSuccess: (data) =>
      toast(
        data.responseSent
          ? { message: `Respuesta reenviada a ${c.email}.` }
          : { message: 'No se pudo enviar el correo. Intenta más tarde.', tone: 'error' },
      ),
  })

  return (
    <section id="responder" aria-labelledby="record-title" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-emerald-200">
      <h2 id="record-title" className="mb-3 flex items-center gap-2 font-bold text-navy">
        <CircleCheck className="size-5 text-emerald-600" aria-hidden />
        Respuesta enviada
      </h2>
      <p className="whitespace-pre-wrap text-sm">{c.response}</p>
      {/* Quién y cuándo respondió ya está en el avance; aquí, si el correo llegó a salir. */}
      <p className={cx('mt-4 text-xs', c.responseSentAt ? 'text-muted' : 'font-semibold text-red-700')}>
        {c.responseSentAt
          ? `Correo enviado a ${c.email} el ${formatDateTime(c.responseSentAt)}`
          : 'El correo no se pudo enviar. Reenvíalo.'}
      </p>
      <ErrorNotice error={resend.error} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" loading={resend.isPending} onClick={() => resend.mutate()}>
          Reenviar por correo
        </Button>
        {next.data ? (
          <button
            type="button"
            onClick={() => navigate(path(`/reclamos/${next.data?.id}`))}
            className={cx(
              'inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700',
            )}
          >
            Siguiente pendiente: {next.data.code}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          next.isSuccess && (
            <Link to={path('/reclamos')} className="text-sm font-semibold text-navy hover:text-magenta">
              No quedan hojas pendientes · Volver al listado
            </Link>
          )
        )}
      </div>
    </section>
  )
}
