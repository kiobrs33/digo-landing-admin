const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`

export class ApiError extends Error {
  readonly status: number
  readonly messages: string[]

  constructor(status: number, messages: string[]) {
    super(messages[0] ?? 'Error inesperado')
    this.status = status
    this.messages = messages
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined | null>
}

function buildUrl(path: string, query: RequestOptions['query']) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  return `${BASE_URL}${path}${params.size ? `?${params}` : ''}`
}

/** Llama a la API con la cookie de sesión. Lanza `ApiError` si la respuesta no es 2xx. */
export async function api<T>(path: string, { method = 'GET', body, query }: RequestOptions = {}) {
  const url = buildUrl(path, query)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, ['No se pudo conectar con el servidor'])
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = (data as { message?: string | string[] } | null)?.message
    const messages = Array.isArray(message) ? message : message ? [message] : []
    // Las rutas de /auth manejan su propio 401 (p. ej. /auth/me sin sesión es normal).
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('digo:unauthorized'))
    }
    throw new ApiError(response.status, messages.length ? messages : [defaultMessage(response.status)])
  }
  return data as T
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (status === 403) return 'No tienes permiso para esta acción.'
  if (status === 404) return 'No encontrado.'
  if (status === 429) return 'Demasiados intentos. Espera un momento.'
  return 'Error del servidor. Intenta de nuevo.'
}

/** Sube archivos como multipart (imágenes en modo local, reportes de cobranza). */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  tooLarge = 'La imagen pesa demasiado (máximo 5 MB).',
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: 'POST', credentials: 'include', body: form })
  } catch {
    throw new ApiError(0, ['No se pudo conectar con el servidor'])
  }
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = (data as { message?: string | string[] } | null)?.message
    const messages = Array.isArray(message) ? message : message ? [message] : []
    if (response.status === 401) window.dispatchEvent(new Event('digo:unauthorized'))
    if (response.status === 413) throw new ApiError(413, [tooLarge])
    throw new ApiError(response.status, messages.length ? messages : [defaultMessage(response.status)])
  }
  return data as T
}

/** Descarga un archivo de la API (p. ej. un CSV) con la sesión actual y lo guarda con `filename`. */
export async function apiDownload(path: string, query: RequestOptions['query'], filename: string) {
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), { credentials: 'include' })
  } catch {
    throw new ApiError(0, ['No se pudo conectar con el servidor'])
  }
  if (!response.ok) throw new ApiError(response.status, [defaultMessage(response.status)])
  const url = URL.createObjectURL(await response.blob())
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  URL.revokeObjectURL(url)
}
