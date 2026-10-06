import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleCheck, Hand, Inbox, MessageCircle, Phone, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Inquiry, InquiryStatus } from '@/api/types'
import { useAssignable } from '@/api/useAssignable'
import { useAuth } from '@/auth/context'
import { Dl, SectionTitle } from '@/components/DetailParts'
import { Modal } from '@/components/Modal'
import { Button, Card, DetailSkeleton, ErrorNotice, Field, PageHeader, Select, Textarea } from '@/components/ui'
import { useCrumbLabel } from '@/lib/crumbs'
import { cx } from '@/lib/cx'
import { formatDateTime } from '@/lib/format'
import { inquiryStatusLabel } from '@/lib/labels'
import { spaceOfSite, useSpacePath } from '@/lib/space'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'

const detailKey = (id: string) => ['inquiries', 'detail', id]

/** Qué significa cada estado: lo leen el avance de la consulta y el modal de gestión. */
const statusMeaning: Record<InquiryStatus, string> = {
  NUEVA: 'Nadie la ha tomado todavía.',
  EN_PROCESO: 'Alguien del equipo está en contacto con el cliente.',
  ATENDIDA: 'Ya se le respondió al cliente. Queda registrado quién y cuándo.',
}

export function InquiryDetailPage() {
  const path = useSpacePath()
  const { id = '' } = useParams()
  const inquiry = useQuery({ queryKey: detailKey(id), queryFn: () => api<Inquiry>(`/admin/inquiries/${id}`) })
  const q = inquiry.data
  useCrumbLabel(path(`/consultas/${id}`), q && (q.company ?? q.name))
  usePageTitle(q ? `Consulta de ${q.company ?? q.name}` : 'Consulta')

  if (inquiry.isPending) return <DetailSkeleton />
  if (inquiry.error) return <ErrorNotice error={inquiry.error} />
  // `key`: al cambiar de consulta, el modal y su formulario empiezan de cero.
  return <InquiryView key={inquiry.data.id} inquiry={inquiry.data} />
}

type InquiryChange = Partial<Pick<Inquiry, 'status' | 'notes'>> & { assignedToId?: string | null }

/** Guarda un cambio de la consulta y refresca el detalle y el listado. */
function useUpdateInquiry(inquiry: Inquiry) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: InquiryChange) => api<Inquiry>(`/admin/inquiries/${inquiry.id}`, { method: 'PATCH', body }),
    onSuccess: (data) => {
      queryClient.setQueryData(detailKey(inquiry.id), data)
      void queryClient.invalidateQueries({ queryKey: ['inquiries'], refetchType: 'none' })
    },
  })
}

function InquiryView({ inquiry: q }: { inquiry: Inquiry }) {
  const toast = useToast()
  const { user } = useAuth()
  const [managing, setManaging] = useState(false)
  const update = useUpdateInquiry(q)
  const whatsapp = q.phone.replace(/\D/g, '')

  // Acciones directas: el siguiente paso de la consulta en un clic.
  const take = () =>
    update.mutate(
      { status: 'EN_PROCESO', assignedToId: user?.id },
      { onSuccess: () => toast({ message: 'Tomaste la consulta: ahora está en proceso.' }) },
    )
  const markAttended = () =>
    update.mutate(
      { status: 'ATENDIDA' },
      {
        onSuccess: () =>
          toast({
            message: 'Consulta marcada como atendida.',
            action: { label: 'Deshacer', onClick: () => update.mutate({ status: q.status }) },
          }),
      },
    )
  const reopen = () =>
    update.mutate({ status: 'EN_PROCESO' }, { onSuccess: () => toast({ message: 'Consulta reabierta.' }) })

  return (
    <>
      <PageHeader
        title={q.company ?? q.name}
        description={`Consulta desde ${spaceOfSite(q.site).domain} · recibida el ${formatDateTime(q.createdAt)}`}
        actions={
          <>
            <a
              href={`https://wa.me/${whatsapp.length === 9 ? `51${whatsapp}` : whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#117a3a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d6630]"
            >
              <MessageCircle className="size-4" aria-hidden />
              Escribir por WhatsApp
            </a>
            <a
              href={`tel:${q.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy ring-1 ring-line transition-colors hover:bg-surface-alt"
            >
              <Phone className="size-4" aria-hidden />
              Llamar
            </a>
          </>
        }
      />

      {/* Dónde está la consulta y el siguiente paso, arriba y en todos los tamaños. */}
      <section aria-label="Estado de la consulta" className="mb-6 rounded-xl bg-white shadow-sm ring-1 ring-line">
        <StatusTrack inquiry={q} />
        <div className="flex flex-col gap-2 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{statusMeaning[q.status]}</p>
          <div className="flex flex-wrap gap-2">
            {q.status === 'NUEVA' && (
              <Button variant="secondary" loading={update.isPending && update.variables?.status === 'EN_PROCESO'} onClick={take}>
                <Hand className="size-4" aria-hidden />
                Tomar la consulta
              </Button>
            )}
            {q.status !== 'ATENDIDA' ? (
              <Button
                className="bg-navy hover:bg-navy-700"
                loading={update.isPending && update.variables?.status === 'ATENDIDA'}
                onClick={markAttended}
              >
                <CircleCheck className="size-4" aria-hidden />
                Marcar como atendida
              </Button>
            ) : (
              <Button variant="secondary" loading={update.isPending} onClick={reopen}>
                <RotateCcw className="size-4" aria-hidden />
                Reabrir
              </Button>
            )}
            <Button variant="ghost" onClick={() => setManaging(true)}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Gestionar
            </Button>
          </div>
        </div>
      </section>
      <ErrorNotice error={update.error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <SectionTitle>Mensaje</SectionTitle>
          <p className="whitespace-pre-wrap text-sm">{q.message}</p>
          <div className="mt-6">
            <Dl
              rows={[
                ['Nombre', q.name],
                ['Empresa', q.company],
                ['RUC', q.ruc],
                ['Teléfono', q.phone],
                ['Correo', q.email && <a key="email" href={`mailto:${q.email}`} className="text-navy underline">{q.email}</a>],
              ]}
            />
          </div>
        </Card>
        <aside>
          <Card>
            <SectionTitle>Notas internas</SectionTitle>
            {q.notes ? (
              <p className="whitespace-pre-wrap text-sm">{q.notes}</p>
            ) : (
              <p className="text-sm text-muted">Sin notas. Anota lo que hablaste con el cliente para que el equipo lo sepa.</p>
            )}
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setManaging(true)}>
              {q.notes ? 'Editar notas' : 'Agregar nota'}
            </Button>
            <p className="mt-3 text-xs text-muted">Solo las ve el equipo.</p>
          </Card>
        </aside>
      </div>

      <Modal
        open={managing}
        onClose={() => setManaging(false)}
        title="Gestionar consulta"
        description={q.company ?? q.name}
      >
        <ManageForm inquiry={q} onDone={() => setManaging(false)} />
      </Modal>
    </>
  )
}

/**
 * Avance de la consulta: Nueva → En proceso → Atendida. Cada paso dice qué pasó y cuándo; al
 * atenderla, queda a la vista quién la cerró y en qué fecha.
 */
function StatusTrack({ inquiry: q }: { inquiry: Inquiry }) {
  const order: InquiryStatus[] = ['NUEVA', 'EN_PROCESO', 'ATENDIDA']
  const current = order.indexOf(q.status)
  const details: Record<InquiryStatus, ReactNode> = {
    NUEVA: `Recibida el ${formatDateTime(q.createdAt)}`,
    EN_PROCESO: q.assignedTo ? `Responsable: ${q.assignedTo.name}` : current >= 1 ? 'Sin responsable' : 'Nadie la tomó aún',
    ATENDIDA:
      q.status !== 'ATENDIDA'
        ? 'Pendiente'
        : q.attendedAt
          ? `${formatDateTime(q.attendedAt)}${q.attendedBy ? ` por ${q.attendedBy.name}` : ''}`
          : 'Sin registro de fecha (anterior a este cambio)',
  }

  return (
    <ol className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:gap-0">
      {order.map((step, index) => {
        const done = index < current || (index === current && step === 'ATENDIDA')
        const active = index === current
        return (
          <li key={step} className="relative flex gap-3 sm:pr-4">
            {/* Tramo hacia el siguiente paso (solo en escritorio, donde van en fila). */}
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
                {inquiryStatusLabel[step]}
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

/** Opciones del selector de estado: icono y color de cada paso. */
const statusOptions: { value: InquiryStatus; icon: typeof Inbox; tone: string }[] = [
  { value: 'NUEVA', icon: Inbox, tone: 'peer-checked:bg-amber-50 peer-checked:text-amber-900 peer-checked:ring-amber-300' },
  { value: 'EN_PROCESO', icon: Hand, tone: 'peer-checked:bg-blue-50 peer-checked:text-blue-900 peer-checked:ring-blue-300' },
  { value: 'ATENDIDA', icon: CircleCheck, tone: 'peer-checked:bg-emerald-50 peer-checked:text-emerald-900 peer-checked:ring-emerald-300' },
]

function ManageForm({ inquiry, onDone }: { inquiry: Inquiry; onDone: () => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const save = useUpdateInquiry(inquiry)
  const [status, setStatus] = useState<InquiryStatus>(inquiry.status)
  const [notes, setNotes] = useState(inquiry.notes ?? '')
  const [assignedToId, setAssignedToId] = useState(inquiry.assignedTo?.id ?? '')
  const assignable = useAssignable().data ?? []

  const dirty =
    status !== inquiry.status || notes !== (inquiry.notes ?? '') || assignedToId !== (inquiry.assignedTo?.id ?? '')

  // Qué quedará registrado con el estado elegido: lo dice antes de guardar, no después.
  const statusNote =
    status === 'ATENDIDA'
      ? inquiry.status === 'ATENDIDA' && inquiry.attendedAt
        ? `Atendida el ${formatDateTime(inquiry.attendedAt)}${inquiry.attendedBy ? ` por ${inquiry.attendedBy.name}` : ''}.`
        : 'Al guardar se registra como atendida hoy, por ti.'
      : inquiry.status === 'ATENDIDA'
        ? 'Al guardar se reabre y se borra el registro de atención.'
        : statusMeaning[status]

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      { status, notes, assignedToId: assignedToId || null },
      {
        onSuccess: () => {
          toast({ message: 'Consulta actualizada.' })
          onDone()
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Estado</legend>
          <div className="grid grid-cols-3 gap-2">
            {statusOptions.map(({ value, icon: Icon, tone }) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className="peer sr-only"
                />
                <span
                  className={cx(
                    'flex h-full flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center text-sm font-semibold text-muted ring-1 ring-line transition-colors',
                    'hover:bg-surface peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-magenta',
                    tone,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {inquiryStatusLabel[value]}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted" aria-live="polite">
            {statusNote}
          </p>
        </fieldset>

        <Field label="Responsable">
          {(id) => (
            <div className="flex gap-2">
              <Select id={id} className="flex-1" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                <option value="">Sin asignar</option>
                {inquiry.assignedTo && !assignable.some((u) => u.id === inquiry.assignedTo?.id) && (
                  <option value={inquiry.assignedTo.id}>{inquiry.assignedTo.name}</option>
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

        <Field label="Notas internas" hint="Solo las ve el equipo.">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              className="min-h-24"
              placeholder="Ej.: Le envié los planes por WhatsApp; volver a llamar el lunes."
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
