import type { TipoCarga } from '@/api/cobranza'

/**
 * Ciclos cuyo archivo (TXT o Excel para el macro) se descargó este mes, por día de pago. Es una ayuda de este navegador (no la
 * verdad de Telecrédito): sirve para proponer "Reemplazar" en la primera carga del mes y avisar
 * si se va a reemplazar después de haber cargado otro ciclo.
 */
export type CargaDelMes = { tipo: TipoCarga; fecha: string }
export type HistorialMes = Record<number, CargaDelMes>

/** 'YYYY-MM' de hoy en Lima. */
export const mesActual = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 7)

const clave = (mes: string) => `digo:cobranza:cargas:${mes}`

export function leerHistorial(mes = mesActual()): HistorialMes {
  try {
    const valor = JSON.parse(localStorage.getItem(clave(mes)) ?? '{}') as unknown
    return valor && typeof valor === 'object' ? (valor as HistorialMes) : {}
  } catch {
    return {}
  }
}

/** Registra que se descargó el archivo del ciclo (ahora). */
export function guardarCarga(dia: number, tipo: TipoCarga, mes = mesActual()): HistorialMes {
  const siguiente = { ...leerHistorial(mes), [dia]: { tipo, fecha: new Date().toISOString() } }
  try {
    localStorage.setItem(clave(mes), JSON.stringify(siguiente))
  } catch {
    /* sin almacenamiento: solo se pierde la ayuda */
  }
  return siguiente
}

/** Un reemplazo deja en Telecrédito solo ese ciclo: el historial del mes empieza de nuevo. */
export function reemplazarHistorial(dia: number, tipo: TipoCarga, mes = mesActual()): HistorialMes {
  const siguiente: HistorialMes = { [dia]: { tipo, fecha: new Date().toISOString() } }
  try {
    localStorage.setItem(clave(mes), JSON.stringify(siguiente))
  } catch {
    /* sin almacenamiento: solo se pierde la ayuda */
  }
  return siguiente
}

/** Emisión y vencimiento que tendrá el ciclo este mes (el día 31 cae el último día del mes). */
export function fechasDelCiclo(dia: number, diasVencimiento: number, mes = mesActual()) {
  const [year, month] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const emision = new Date(Date.UTC(year, month - 1, Math.min(dia, ultimo)))
  const vence = new Date(emision)
  vence.setUTCDate(vence.getUTCDate() + diasVencimiento)
  const formato = (fecha: Date) =>
    fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  return { emision: formato(emision), vence: formato(vence) }
}
