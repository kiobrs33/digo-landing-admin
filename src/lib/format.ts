const dateTime = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Lima',
})
const dateOnly = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

/** Para fechas sin hora (YYYY-MM-DD), como el vencimiento de un reclamo. */
export const formatDate = (isoDate: string) => dateOnly.format(new Date(`${isoDate}T00:00:00Z`))

export function deadlineText(daysLeft: number): string {
  if (daysLeft < 0) return `Vencido hace ${-daysLeft} día${daysLeft === -1 ? '' : 's'} hábil${daysLeft === -1 ? '' : 'es'}`
  if (daysLeft === 0) return 'Vence hoy'
  return `${daysLeft} día${daysLeft === 1 ? '' : 's'} hábil${daysLeft === 1 ? '' : 'es'}`
}

const shortDate = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })

/** "4 oct." para fechas con hora (p. ej. cuándo se respondió). */
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso))

const relative = new Intl.RelativeTimeFormat('es-PE', { numeric: 'auto' })

/** "hace 5 minutos", "ayer", "hace 3 días"; pasada una semana, la fecha corta. */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000)
  if (minutes > -1) return 'ahora'
  if (minutes > -60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours > -24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (days > -7) return relative.format(days, 'day')
  return formatShortDate(iso)
}

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

/** "S/ 1,234.50" */
export const formatSoles = (value: number) => soles.format(value)
