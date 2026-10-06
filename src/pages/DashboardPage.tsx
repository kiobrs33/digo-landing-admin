import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpenText, CircleCheck, MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { Complaint, ComplaintSummary, Inquiry, InquirySummaryRow, Paginated } from '@/api/types'
import { useAuth } from '@/auth/context'
import { ErrorNotice } from '@/components/ui'
import { cx } from '@/lib/cx'
import { usePageTitle } from '@/lib/usePageTitle'
import { formatDateTime } from '@/lib/format'
import { useSpace, useSpacePath } from '@/lib/space'
import { DeadlineBadge } from '@/pages/complaints/ComplaintBadges'

export function DashboardPage() {
  const { user } = useAuth()
  const space = useSpace()
  const path = useSpacePath()
  usePageTitle(`Inicio · ${space.name}`)
  // Todo es del espacio actual: Hogar y Empresas atienden a clientes distintos.
  const site = space.site
  const complaintSummary = useQuery({
    queryKey: ['complaints', 'summary', site],
    queryFn: () => api<ComplaintSummary>('/admin/complaints/summary', { query: { site } }),
  })
  const openComplaints = useQuery({
    queryKey: ['complaints', 'list', { site, open: 'true', pageSize: 6 }],
    queryFn: () => api<Paginated<Complaint>>('/admin/complaints', { query: { site, open: 'true', pageSize: 6 } }),
  })
  const inquirySummary = useQuery({
    queryKey: ['inquiries', 'summary'],
    queryFn: () => api<InquirySummaryRow[]>('/admin/inquiries/summary'),
  })
  const newInquiries = useQuery({
    queryKey: ['inquiries', 'list', { site, status: 'NUEVA', pageSize: 6 }],
    queryFn: () => api<Paginated<Inquiry>>('/admin/inquiries', { query: { site, status: 'NUEVA', pageSize: 6 } }),
  })

  const countInquiries = (status: InquirySummaryRow['status']) =>
    inquirySummary.data?.find((row) => row.site === site && row.status === status)?.count ?? 0

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Hola, {user?.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-muted">
          Esto es lo que espera respuesta hoy en {space.name} ({space.audience.toLowerCase()}).
        </p>
      </header>

      <ErrorNotice error={complaintSummary.error ?? inquirySummary.error} />

      {/* Indicadores en una sola franja: el número importa, no la tarjeta. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line shadow-sm ring-1 ring-line lg:grid-cols-4">
        <Indicator
          label="Reclamos vencidos"
          value={complaintSummary.data?.overdue}
          alert="danger"
          to={path('/reclamos?plazo=vencido')}
        />
        <Indicator
          label="Vencen en 3 días hábiles"
          value={complaintSummary.data?.dueSoon}
          alert="warning"
          to={path('/reclamos?plazo=pronto')}
        />
        <Indicator
          label="Consultas nuevas"
          value={inquirySummary.data && countInquiries('NUEVA')}
          to={path('/consultas?status=NUEVA')}
        />
        <Indicator
          label="Consultas en proceso"
          value={inquirySummary.data && countInquiries('EN_PROCESO')}
          to={path('/consultas?status=EN_PROCESO')}
        />
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Queue
          title="Reclamos sin responder"
          icon={<BookOpenText className="size-4" />}
          total={complaintSummary.data?.pending}
          to={path('/reclamos')}
          loading={openComplaints.isPending}
          error={openComplaints.error}
          empty="No hay reclamos pendientes."
        >
          {openComplaints.data?.items.map((complaint) => (
            <QueueRow
              key={complaint.id}
              to={path(`/reclamos/${complaint.id}`)}
              title={
                <>
                  <span className="font-semibold text-navy">{complaint.code}</span>
                  <span className="text-ink"> · {complaint.fullName}</span>
                </>
              }
              meta={`${complaint.kind === 'QUEJA' ? 'Queja' : 'Reclamo'} · ${formatDateTime(complaint.createdAt)}`}
              aside={<DeadlineBadge complaint={complaint} />}
            />
          ))}
        </Queue>

        <Queue
          title="Consultas nuevas"
          icon={<MessageSquareText className="size-4" />}
          total={inquirySummary.data && countInquiries('NUEVA')}
          to={path('/consultas?status=NUEVA')}
          loading={newInquiries.isPending}
          error={newInquiries.error}
          empty="No hay consultas nuevas."
        >
          {newInquiries.data?.items.map((inquiry) => (
            <QueueRow
              key={inquiry.id}
              to={path(`/consultas/${inquiry.id}`)}
              title={<span className="font-semibold text-navy">{inquiry.company ?? inquiry.name}</span>}
              meta={`${inquiry.phone} · ${formatDateTime(inquiry.createdAt)}`}
              aside={null}
            />
          ))}
        </Queue>
      </div>
    </>
  )
}

function Indicator({
  label,
  value,
  alert,
  to,
}: {
  label: string
  value: number | undefined
  alert?: 'danger' | 'warning'
  to: string
}) {
  const active = Boolean(value) && alert
  return (
    <div className="bg-white">
      <Link to={to} className="block h-full px-5 py-4 transition-colors hover:bg-surface/70">
        <dt className="text-sm text-muted">{label}</dt>
        <dd
          className={cx(
            'mt-1 text-2xl font-extrabold',
            value === undefined && 'text-muted/40',
            value !== undefined && !active && 'text-navy',
            active && alert === 'danger' && 'text-red-700',
            active && alert === 'warning' && 'text-amber-700',
          )}
        >
          {value ?? '–'}
        </dd>
      </Link>
    </div>
  )
}

function Queue({
  title,
  icon,
  total,
  to,
  loading,
  error,
  empty,
  children,
}: {
  title: string
  icon: ReactNode
  total: number | undefined
  to: string
  loading: boolean
  error: unknown
  empty: string
  children: ReactNode
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="flex min-w-0 flex-col rounded-xl bg-white shadow-sm ring-1 ring-line">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-bold text-navy">
          <span className="text-magenta">{icon}</span>
          {title}
          {total !== undefined && <span className="text-sm font-semibold text-muted">({total})</span>}
        </h2>
        <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-navy hover:text-magenta">
          Ver todo <ArrowRight className="size-4" aria-hidden />
        </Link>
      </header>
      {error ? (
        <div className="p-5">
          <ErrorNotice error={error} />
        </div>
      ) : loading ? (
        <div className="space-y-4 p-5" aria-busy="true" aria-label="Cargando">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <div className="skeleton h-4 w-3/5" />
              <div className="skeleton h-3 w-2/5" />
            </div>
          ))}
        </div>
      ) : hasItems ? (
        <ul className="divide-y divide-line">{children}</ul>
      ) : (
        <p className="flex items-center gap-2 px-5 py-8 text-sm text-muted">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden />
          {empty}
        </p>
      )}
    </section>
  )
}

function QueueRow({ to, title, meta, aside }: { to: string; title: ReactNode; meta: string; aside: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface/70">
        <span className="min-w-0">
          <span className="line-clamp-2 block text-sm sm:line-clamp-1">{title}</span>
          <span className="block text-xs text-muted sm:truncate">{meta}</span>
        </span>
        <span className="shrink-0">{aside}</span>
      </Link>
    </li>
  )
}
