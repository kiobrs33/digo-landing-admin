import type { Complaint, ComplaintStatus } from '@/api/types'
import { Badge } from '@/components/ui'
import { deadlineText, formatShortDate } from '@/lib/format'
import { complaintStatusLabel } from '@/lib/labels'

const statusTone = { PENDIENTE: 'warning', EN_PROCESO: 'info', RESPONDIDO: 'success' } as const

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return <Badge tone={statusTone[status]}>{complaintStatusLabel[status]}</Badge>
}

/**
 * Semáforo del plazo: rojo vencido, ámbar ≤ 3 días hábiles, neutro el resto. Una hoja ya
 * respondida no tiene plazo: se muestra cuándo se respondió.
 */
export function DeadlineBadge({ complaint }: { complaint: Pick<Complaint, 'businessDaysLeft' | 'respondedAt'> }) {
  const days = complaint.businessDaysLeft
  if (days === null) {
    return (
      <span className="text-xs text-muted">
        {complaint.respondedAt ? `Respondida el ${formatShortDate(complaint.respondedAt)}` : 'Respondida'}
      </span>
    )
  }
  return <Badge tone={days < 0 ? 'danger' : days <= 3 ? 'warning' : 'neutral'}>{deadlineText(days)}</Badge>
}
