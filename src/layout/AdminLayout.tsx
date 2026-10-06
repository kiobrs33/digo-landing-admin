import {
  BookOpenText,
  Building2,
  Images,
  Landmark,
  LayoutDashboard,
  MapPinned,
  type LucideIcon,
  Menu,
  MessageCircle,
  MessageSquareText,
  Share2,
  SlidersHorizontal,
  UserRound,
  Users,
  Wifi,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { CrumbContext } from '@/lib/crumbs'
import { isSpaceSlug, SpaceContext, type SpaceSlug, spaces, useSpace } from '@/lib/space'
import { useHomeSpace } from '@/lib/useHomeSpace'
import { SpaceSwitcher } from './SpaceSwitcher'
import { cx } from '@/lib/cx'
import { TopBar } from './TopBar'

type NavItem = {
  /** Ruta dentro del espacio (`/reclamos`) o global (`/usuarios`, con `global`). */
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  global?: boolean
  /** Solo en estos espacios (p. ej. lo que usa únicamente la web de Hogar). */
  only?: SpaceSlug[]
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Atención',
    items: [
      { to: '', label: 'Inicio', icon: LayoutDashboard },
      { to: '/reclamos', label: 'Libro de Reclamaciones', icon: BookOpenText },
      { to: '/consultas', label: 'Consultas', icon: MessageSquareText },
    ],
  },
  {
    title: 'Contenido de la web',
    items: [
      { to: '/contenido/empresa', label: 'Datos de la empresa', icon: Building2, adminOnly: true },
      { to: '/contenido/planes', label: 'Planes', icon: Wifi, adminOnly: true, only: ['hogar'] },
      { to: '/contenido/carrusel', label: 'Carrusel', icon: SlidersHorizontal, adminOnly: true, only: ['hogar'] },
      { to: '/contenido/redes', label: 'Redes sociales', icon: Share2, adminOnly: true },
      { to: '/contenido/nosotros', label: 'Fotos de Nosotros', icon: Images, adminOnly: true, only: ['hogar'] },
      { to: '/contenido/zonas', label: 'Zonas de cobertura', icon: MapPinned, adminOnly: true, only: ['hogar'] },
    ],
  },
  {
    title: 'Cobranza',
    items: [
      { to: '/cobranza/deudas-clientes', label: 'Deudas por cliente', icon: UserRound, adminOnly: true, only: ['hogar'] },
      { to: '/cobranza/pagos-bcp', label: 'Pagos BCP', icon: Landmark, adminOnly: true, only: ['hogar'] },
      { to: '/cobranza/mensajes', label: 'Mensajes masivos', icon: MessageCircle, adminOnly: true, only: ['hogar'] },
    ],
  },
  {
    title: 'Sistema',
    items: [{ to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true, global: true }],
  },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  // Espacio actual: el de la URL; en vistas globales (Usuarios, Mi perfil), el último usado.
  const home = useHomeSpace()
  const segment = pathname.split('/')[1]
  const space = isSpaceSlug(segment) ? spaces[segment] : home
  const isDesktop = useIsDesktop()
  const mainRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstPath = useRef(pathname)

  // El menú móvil se cierra al navegar y con Escape.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Al abrir el menú móvil, el foco entra al primer enlace.
  useEffect(() => {
    if (open) document.querySelector<HTMLElement>('#sidebar nav a')?.focus()
  }, [open])

  // Al cambiar de página, el foco va al contenido (el lector de pantalla lee la nueva página).
  useEffect(() => {
    if (pathname === firstPath.current) return
    firstPath.current = ''
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  // En móvil: menú cerrado = fuera del orden de tabulación; abierto = el resto queda inerte.
  const drawerHidden = !isDesktop && !open
  const pageInert = !isDesktop && open

  // Nombres de las migas que registran las páginas (p. ej. el código de la hoja).
  const [crumbLabels, setCrumbLabels] = useState<ReadonlyMap<string, string>>(new Map())
  const setCrumbLabel = useCallback((path: string, label: string | null) => {
    setCrumbLabels((current) => {
      if ((current.get(path) ?? null) === label) return current
      const next = new Map(current)
      if (label === null) next.delete(path)
      else next.set(path, label)
      return next
    })
  }, [])
  const crumbs = useMemo(() => ({ labels: crumbLabels, setLabel: setCrumbLabel }), [crumbLabels, setCrumbLabel])

  return (
    <CrumbContext.Provider value={crumbs}>
      <SpaceContext.Provider value={space}>
      <div data-space={space.slug} className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
        <a
          href="#contenido"
          className="sr-only z-[60] rounded-lg bg-white px-4 py-2 font-semibold text-navy focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>

        {/* Barra superior en móvil: queda por encima del fondo para que su botón cierre el menú. */}
        <header className="sticky top-0 z-50 flex items-center justify-between bg-navy-900 px-4 py-3 text-white lg:hidden">
          <Brand />
          <button
            ref={toggleRef}
            type="button"
            className="grid size-10 place-items-center rounded-lg text-white/90 hover:bg-white/10"
            aria-expanded={open}
            aria-controls="sidebar"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>

        {/* Fondo del menú móvil */}
        {open && (
          <div className="fixed inset-0 z-30 bg-navy-900/50 lg:hidden" aria-hidden onClick={() => setOpen(false)} />
        )}

        <aside
          id="sidebar"
          inert={drawerHidden}
          className={cx(
            'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-navy-900 text-white transition-transform duration-200 ease-out',
            'lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:max-w-none lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {/* En móvil la barra superior queda encima: el selector va debajo de ella. */}
          <div className="h-16 shrink-0 lg:hidden" aria-hidden />
          <div className="px-3 pt-3 pb-1 lg:pt-4">
            <SpaceSwitcher />
          </div>
          <Navigation />
        </aside>

        <div inert={pageInert} className="flex min-w-0 flex-col">
          <TopBar />
          <main
            id="contenido"
            ref={mainRef}
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl px-4 py-6 outline-none sm:px-8 sm:py-8"
          >
            <Outlet />
          </main>
        </div>
      </div>
      </SpaceContext.Provider>
    </CrumbContext.Provider>
  )
}

const desktopQuery = '(min-width: 1024px)'
const subscribeDesktop = (callback: () => void) => {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

/** Si la pantalla es de escritorio (menú lateral fijo; mismo corte que `lg:` de Tailwind). */
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => true)
}

function Navigation() {
  const { user } = useAuth()
  const space = useSpace()
  return (
    <nav className="scroll-dark flex-1 overflow-y-auto px-3 pb-4" aria-label="Principal">
      {sections.map((section) => {
        const items = section.items.filter(
          (item) => (!item.adminOnly || user?.role === 'ADMIN') && (!item.only || item.only.includes(space.slug)),
        )
        if (!items.length) return null
        return (
          <div key={section.title} className="mt-5 first:mt-2">
            <p className="px-3 pb-1.5 text-xs font-semibold text-white/55">{section.title}</p>
            <ul className="space-y-0.5">
              {items.map(({ to, label, icon: Icon, global }) => (
                <li key={to}>
                  <NavLink
                    to={global ? to : `/${space.slug}${to}`}
                    end={to === ''}
                    className={({ isActive }) =>
                      cx(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                        isActive ? 'bg-white font-semibold text-navy' : 'text-white/85 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cx('size-4 shrink-0', isActive ? 'text-magenta' : 'text-white/60 group-hover:text-white')}
                          aria-hidden
                        />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

/** Barra superior en móvil: logo y el espacio en el que se está. */
function Brand() {
  const space = useSpace()
  return (
    <div className="flex items-center gap-3">
      <img src="/digo-logo-64.png" alt="" className="size-9 rounded-lg bg-white p-1" />
      <div className="leading-tight">
        <p className="font-extrabold">{space.name}</p>
        <p className="text-xs text-white/60">{space.domain}</p>
      </div>
    </div>
  )
}
