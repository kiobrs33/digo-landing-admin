import { Building2, Check, ChevronsUpDown, House } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { cx } from '@/lib/cx'
import { allowedSpaces, type Space, type SpaceSlug, useSpace } from '@/lib/space'

/** Secciones que existen en los dos espacios: al cambiar se conserva la sección. */
const sharedSections = ['reclamos', 'consultas', 'contenido/empresa', 'contenido/redes']

export function SpaceIcon({ slug, className }: { slug: SpaceSlug; className?: string }) {
  const Icon = slug === 'empresas' ? Building2 : House
  return (
    <span aria-hidden className={cx('grid shrink-0 place-items-center rounded-lg bg-magenta text-white', className ?? 'size-9')}>
      <Icon className="size-[55%]" />
    </span>
  )
}

/**
 * Selector de espacio, arriba de la barra lateral: Digo Hogar o Digo Empresas. Cambia todo el
 * panel (menú, listas, color). Con un solo espacio permitido se muestra fijo.
 */
export function SpaceSwitcher() {
  const space = useSpace()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const allowed = allowedSpaces(user?.sites)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (target: Space) => {
    setOpen(false)
    if (target.slug === space.slug) return
    // Misma sección en el otro espacio si existe allí (sin el id de una hoja o consulta concreta).
    const rest = pathname.split('/').slice(2).join('/')
    const section = sharedSections.find((shared) => rest === shared || rest.startsWith(`${shared}/`))
    navigate(`/${target.slug}${section ? `/${section}` : ''}`)
  }

  const current = (
    <>
      <SpaceIcon slug={space.slug} />
      <span className="min-w-0 flex-1 text-left leading-tight">
        <span className="block truncate font-extrabold text-white">{space.name}</span>
        <span className="block truncate text-xs text-white/60">{space.domain}</span>
      </span>
    </>
  )

  if (allowed.length < 2) {
    return <div className="flex items-center gap-3 rounded-xl px-2 py-2">{current}</div>
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Espacio: ${space.name}. Cambiar de espacio`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 ring-1 ring-white/10 transition-colors hover:bg-white/8 aria-expanded:bg-white/8"
      >
        {current}
        <ChevronsUpDown className="size-4 shrink-0 text-white/50" aria-hidden />
      </button>

      {open && (
        <ul
          id={menuId}
          className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl bg-white p-1.5 text-ink shadow-[0_16px_40px_-16px_rgb(0_0_0/0.5)] ring-1 ring-line"
        >
          {allowed.map((option) => (
            <li key={option.slug} data-space={option.slug}>
              <button
                type="button"
                onClick={() => go(option)}
                aria-current={option.slug === space.slug ? 'true' : undefined}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-alt"
              >
                <SpaceIcon slug={option.slug} className="size-8" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-sm font-bold text-navy">{option.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {option.audience} · {option.domain}
                  </span>
                </span>
                {option.slug === space.slug && <Check className="size-4 shrink-0 text-magenta" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
