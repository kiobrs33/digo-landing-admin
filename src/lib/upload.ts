import { ApiError, api, apiUpload } from '@/api/client'
import type { MediaAsset, Site, UploadConfig } from '@/api/types'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
export const ACCEPT_ATTR = ACCEPTED.join(',')

/**
 * Sube una imagen. Con Cloudinary: el backend firma, el navegador sube directo a Cloudinary y
 * luego se registra en el backend. Sin Cloudinary (desarrollo): se sube al backend.
 */
export async function uploadImage(file: File, site: Site, config: UploadConfig, alt: string): Promise<MediaAsset> {
  if (!ACCEPTED.includes(file.type)) {
    throw new ApiError(400, ['Formato no admitido: usa JPG, PNG o WebP.'])
  }
  if (file.size > config.maxBytes) {
    throw new ApiError(400, [`La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 5 MB.`])
  }

  if (config.mode === 'local') {
    const form = new FormData()
    form.append('file', file)
    form.append('alt', alt)
    return apiUpload<MediaAsset>(`/admin/media/local/${site.toLowerCase()}`, form)
  }

  const signed = await api<{ signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }>(
    '/admin/media/sign',
    { method: 'POST', body: { site } },
  )
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', signed.apiKey)
  form.append('timestamp', String(signed.timestamp))
  form.append('folder', signed.folder)
  form.append('signature', signed.signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  }).catch(() => null)
  const result = (await response?.json().catch(() => null)) as
    | { public_id: string; version: number; signature: string; secure_url: string; width: number; height: number; format: string; error?: { message: string } }
    | null
  if (!response?.ok || !result) {
    throw new ApiError(502, [result?.error?.message ?? 'Cloudinary no aceptó la imagen. Intenta de nuevo.'])
  }
  return api<MediaAsset>('/admin/media', {
    method: 'POST',
    body: {
      publicId: result.public_id,
      version: String(result.version),
      signature: result.signature,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      alt,
    },
  })
}

/** Guarda el texto alternativo si cambió (se llama al enviar el formulario). */
export async function saveAltIfChanged(asset: MediaAsset | null, alt: string) {
  if (asset && asset.alt !== alt.trim()) {
    await api(`/admin/media/${asset.id}`, { method: 'PATCH', body: { alt: alt.trim() } })
  }
}
