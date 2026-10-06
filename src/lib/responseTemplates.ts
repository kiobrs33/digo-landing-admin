import type { Complaint } from '@/api/types'

/**
 * Plantillas de respuesta: un punto de partida que el agente completa. Los corchetes marcan lo
 * que hay que escribir; la revisión final avisa si queda alguno sin reemplazar.
 */
export type ResponseTemplate = { id: string; label: string; build: (complaint: Complaint) => string }

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName

export const responseTemplates: ResponseTemplate[] = [
  {
    id: 'solucionado',
    label: 'Problema solucionado',
    build: (c) =>
      `Estimado(a) ${firstName(c.fullName)}:\n\nRevisamos tu ${c.kind === 'QUEJA' ? 'queja' : 'reclamo'} y te informamos que [describe la solución aplicada y la fecha].\n\n[Si corresponde: detalla la compensación o el ajuste en tu recibo.]\n\nQuedamos atentos a cualquier consulta.`,
  },
  {
    id: 'visita',
    label: 'Visita técnica programada',
    build: (c) =>
      `Estimado(a) ${firstName(c.fullName)}:\n\nPara atender tu ${c.kind === 'QUEJA' ? 'queja' : 'reclamo'}, programamos una visita técnica el [fecha] entre [hora] y [hora] en [dirección].\n\nEl técnico se identificará con su credencial de Digo Telecom. Si necesitas reprogramar, responde este correo.`,
  },
  {
    id: 'improcedente',
    label: 'No procede (con explicación)',
    build: (c) =>
      `Estimado(a) ${firstName(c.fullName)}:\n\nRevisamos tu ${c.kind === 'QUEJA' ? 'queja' : 'reclamo'} con detalle. [Explica con hechos por qué no corresponde lo solicitado.]\n\nSi no estás conforme con esta respuesta, puedes acudir al INDECOPI u OSIPTEL según corresponda.`,
  },
]

/** Fragmentos "[...]" de una plantilla que siguen sin completar. */
export const pendingPlaceholders = (text: string) => text.match(/\[[^\]]{3,}\]/g) ?? []
