import { api, apiUpload } from '@/api/client'

/**
 * Herramientas temporales de cobranza de Digo Hogar (solo ADMIN): cargas de deudas para
 * Telecrédito, conciliación de pagos del BCP con Mikrowisp y mensajes masivos de WhatsApp.
 */

const TOO_LARGE = 'El archivo pesa demasiado (máximo 10 MB).'

// ─── Mikrowisp → Telecrédito ───

export type RegistroTelecredito = {
  codigo_depositante: string
  nombre_depositante: string
  informacion_retorno: string
  fecha_emision: string
  fecha_vencimiento: string
  monto_pagar: number
  mora_cargo_fijo: number
  monto_minimo: number
  tipo_registro: string
  nro_documento_pago: string
  nro_documento_identidad: string
}

export type CicloDeudas = { dia: number; clientes: number; conDeuda: number; monto: number }

export type TipoCarga = 'REEMPLAZO' | 'ACTUALIZACION'

export type CargaDeudas = {
  ciclo: number
  tipoCarga: TipoCarga
  total: number
  montoTotal: number
  sinDeuda: number
  suspendidos: number
  conVariosRecibos: number
  /** Registro del BCP más el estado y los recibos pendientes del cliente en Mikrowisp. */
  registros: (RegistroTelecredito & { estado: string; recibos: number })[]
  omitidos: { fila: number; nombre: string; motivo: string }[]
  descargas: { txt: string; excel: string }
}

export type AnalisisDeudas = {
  mes: string
  ciclos: CicloDeudas[]
  excluidosPorEstado: Record<string, number>
  /** null si solo se analizó el Excel (sin elegir ciclo). */
  carga: CargaDeudas | null
}

export type OpcionesDeudas = {
  ciclo?: number
  diasVencimiento: number
  incluirSinDeuda: boolean
  tipoCarga: TipoCarga
}

/** Analiza la "Lista de Usuarios" de Mikrowisp; con ciclo, genera el TXT y el Excel de la carga. */
export function procesarDeudas(file: File, opciones: OpcionesDeudas) {
  const form = new FormData()
  form.append('file', file)
  form.append('diasVencimiento', String(opciones.diasVencimiento))
  form.append('incluirSinDeuda', String(opciones.incluirSinDeuda))
  form.append('tipoCarga', opciones.tipoCarga)
  if (opciones.ciclo !== undefined) form.append('ciclo', String(opciones.ciclo))
  return apiUpload<AnalisisDeudas>('/admin/cobranza/deudas/usuarios', form, TOO_LARGE)
}

// ─── Telecrédito → conciliación ───

export type ClienteMikrowisp = {
  id: number
  nombre: string
  cedula: string
  estado: string
  zona: string
  movil: string
}

export type EstadoPago = 'LISTO' | 'YA_REGISTRADO' | 'SIN_PENDIENTES' | 'REVISAR' | 'NO_ENCONTRADO' | 'ERROR'

export type FilaConciliacion = {
  archivo: string
  tipoReporte: 'CREP' | 'CDPG'
  linea: number
  documento: string
  fechaPago: string
  horaPago: string
  montoPagado: number
  operacion: string
  operacionCanal: string
  canal: string
  documentoPago: string
  cliente: ClienteMikrowisp | null
  estado: EstadoPago
  facturas: { id: number; vencimiento: string; total: number }[]
  detalle: string
}

export type ArchivoReporte = {
  nombre: string
  tipo: 'CREP' | 'CDPG'
  desde: string
  hasta: string
  pagos: number
  total: number
}

export type ResultadoConciliacion = {
  archivos: ArchivoReporte[]
  total: number
  montoTotal: number
  duplicados: number
  extornos: number
  avisos: string[]
  conteo: Record<EstadoPago, number>
  facturasAPagar: number
  montoAPagar: number
  descargas: { conciliacion: string; mikrowisp: string | null }
  filas: FilaConciliacion[]
}

export function conciliarPagos(files: File[]) {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  return apiUpload<ResultadoConciliacion>('/admin/cobranza/pagos-bcp', form, TOO_LARGE)
}

export const descargaPath = (id: string) => `/admin/cobranza/descargas/${id}`

// ─── Mensajes masivos ───

export type Plantilla = {
  id: string
  nombre: string
  idioma: string
  categoria: string
  encabezado: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | null
  encabezadoConVariable: boolean
  textoEncabezado: string
  cuerpo: string
  pie: string
  variables: string[]
  ejemplos: string[]
  nombradas: boolean
}

/** Un cliente de la plantilla Excel con los valores de su mensaje. */
export type ClienteMensaje = {
  fila: number
  telefono: string
  nombre: string
  encabezado: string | null
  variables: string[]
  /** Por qué no se le puede enviar (celular inválido, dato vacío); null si está listo. */
  problema: string | null
}

export type Destinatarios = {
  archivoId: string
  nombre: string
  total: number
  listos: number
  conProblema: number
  clientes: ClienteMensaje[]
}

export type EstadoCampana = 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA'

export type Campana = {
  id: string
  plantilla: string
  idioma: string
  archivo: string
  estado: EstadoCampana
  creada: string
  terminada: string | null
  creadaPor: string
  total: number
  pendientes: number
  enviados: number
  errores: number
  omitidos: number
}

export const plantillas = (refrescar = false) =>
  api<Plantilla[]>('/admin/mensajes/plantillas', { query: { refrescar: refrescar ? 'true' : undefined } })

/** Sube la plantilla Excel de `plantilla` llena con los clientes. */
export function cargarDestinatarios(file: File, plantilla: Plantilla) {
  const form = new FormData()
  form.append('file', file)
  form.append('plantilla', plantilla.nombre)
  form.append('idioma', plantilla.idioma)
  return apiUpload<Destinatarios>('/admin/mensajes/destinatarios', form, TOO_LARGE)
}

export const enviarPrueba = (body: {
  plantilla: string
  idioma: string
  telefono: string
  variables: string[]
  encabezado?: string
}) => api<{ telefono: string; messageId: string }>('/admin/mensajes/prueba', { method: 'POST', body })

export const crearCampana = (body: { archivoId: string; plantilla: string; idioma: string }) => api<Campana>('/admin/mensajes/campanas', { method: 'POST', body })

export const campanas = () =>
  api<{ items: Campana[]; total: number }>('/admin/mensajes/campanas', { query: { pageSize: 50 } })

export const cancelarCampana = (id: string) =>
  api<Campana>(`/admin/mensajes/campanas/${id}/cancelar`, { method: 'POST' })

export const reintentarCampana = (id: string) =>
  api<Campana>(`/admin/mensajes/campanas/${id}/reintentar`, { method: 'POST' })
