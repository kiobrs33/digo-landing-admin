import { ChevronDown, ChevronRight, LogOut, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useMatches } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { cx } from '@/lib/cx'
import { type CrumbHandle, useCrumbLabels } from '@/lib/crumbs'
import { initials } from '@/lib/initials'
import { roleLabel } from '@/lib/labels'
import { PublishCenter } from './PublishCenter'

/** Barra superior del contenido: dónde estoy (migas) y quién soy (perfil). */
export function TopBar() {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-t-[3px] border-b border-t-magenta border-b-line bg-white px-4 sm:px-8 lg:sticky lg:top-0 lg:z-20">
      <Breadcrumbs />
      <div className="flex shrink-0 items-center gap-2">
        <PublishCenter />
        <ProfileMenu />
      </div>
    </header>
  )
}

/**
 * Migas armadas con las rutas que coinciden con la URL (`handle.crumb`). Todas llevan a su
 * vista salvo la última, que es la página actual. En móvil solo se ven las dos últimas.
 */
function Breadcrumbs() {
  const matches = useMatches()
  const labels = useCrumbLabels()
  const crumbs = matches.flatMap((match) => {
    const crumb = (match.handle as CrumbHandle | undefined)?.crumb
    if (!crumb) return []
    const fallback = typeof crumb === 'function' ? crumb(match.params) : crumb
    return [{ path: match.pathname, label: labels.get(match.pathname) ?? fallback }]
  })

  return (
    <nav aria-label="Ruta" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <li
              key={crumb.path}
              className={cx('flex min-w-0 items-center gap-1.5', index < crumbs.length - 2 && 'hidden sm:flex')}
            >
              {index > 0 && (
                <ChevronRight
                  className={cx('size-4 shrink-0 text-muted/70', index === crumbs.length - 2 && 'hidden sm:block')}
                  aria-hidden
                />
              )}
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-navy">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="truncate rounded text-muted underline-offset-4 transition-colors hover:text-navy hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Avatar con menú: ver el perfil o cerrar sesión. Se cierra con Escape, al salir o al navegar. */
function ProfileMenu() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector<HTMLElement>('[data-menu-item]')?.focus()
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onBlur={(event) => {
        // Al salir del menú con Tab, se cierra.
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Cuenta de ${user.name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-surface-alt aria-expanded:bg-surface-alt"
      >
        <Avatar name={user.name} />
        <span className="hidden max-w-40 truncate text-sm font-semibold text-ink sm:block">{user.name}</span>
        <ChevronDown className={cx('size-4 text-muted transition-transform duration-150', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl bg-white shadow-[0_12px_32px_-12px_rgb(4_28_123/0.35)] ring-1 ring-line"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Avatar name={user.name} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <p className="mt-0.5 text-xs font-semibold text-navy">{roleLabel[user.role]}</p>
            </div>
          </div>
          <ul className="p-1.5 text-sm">
            <li>
              <Link
                data-menu-item
                to="/perfil"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-ink transition-colors hover:bg-surface-alt"
              >
                <UserRound className="size-4 text-muted" aria-hidden />
                Ver mi perfil
              </Link>
            </li>
            <li>
              <button
                data-menu-item
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-red-700 transition-colors hover:bg-red-50"
              >
                <LogOut className="size-4" aria-hidden />
                Cerrar sesión
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-magenta font-bold text-white',
        size === 'lg' ? 'size-16 text-xl' : 'size-8 text-xs',
      )}
    >
      {initials(name)}
    </span>
  )
}
