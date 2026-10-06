/**
 * Números oficiales de Perú: se escriben una sola vez, como sea ("017012341", "(01) 701-2341",
 * "+51 925 521 741"), y de ahí salen el formato técnico (+51…, para llamar y WhatsApp) y el que
 * se muestra en la web.
 */
export type ParsedPhone = {
  /** +51 y el número, para enlaces tel: */
  e164: string
  /** Como se lee en la web. */
  display: string
}

const digitsOf = (value: string) => value.replace(/\D/g, '')

/**
 * Teléfono fijo: Lima es 01 + 7 dígitos → (01) 701-2341; provincias, código de 3 cifras + 6
 * dígitos → (054) 123-456 (Arequipa es 054).
 */
export function parseLandline(input: string): ParsedPhone | null {
  let digits = digitsOf(input)
  if (digits.startsWith('51') && digits.length >= 10) digits = digits.slice(2)
  if (!digits.startsWith('0')) digits = `0${digits}`
  if (/^01\d{7}$/.test(digits)) {
    return { e164: `+51${digits.slice(1)}`, display: `(01) ${digits.slice(2, 5)}-${digits.slice(5)}` }
  }
  if (/^0[4-8]\d\d{6}$/.test(digits)) {
    return { e164: `+51${digits.slice(1)}`, display: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` }
  }
  return null
}

/** Celular: 9 dígitos que empiezan por 9 → 925 521 741. */
export function parseMobile(input: string): ParsedPhone | null {
  let digits = digitsOf(input)
  if (digits.length === 11 && digits.startsWith('51')) digits = digits.slice(2)
  if (!/^9\d{8}$/.test(digits)) return null
  return { e164: `+51${digits}`, display: `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` }
}

/** Número de WhatsApp para wa.me: el +51… sin el "+". */
export const whatsappOf = (phone: ParsedPhone) => phone.e164.slice(1)
