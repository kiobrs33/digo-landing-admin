import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ComponentType, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { AuthProvider, RequireAuth } from '@/auth/auth'
import { Toaster } from '@/components/Toaster'
import { AdminLayout } from '@/layout/AdminLayout'
import { LegacyRedirect, SpaceHomeRedirect, SpaceRoute } from '@/layout/SpaceRoute'
import { isSpaceSlug, spaces } from '@/lib/space'
import type { CrumbHandle } from '@/lib/crumbs'
import { ComplaintDetailPage, ComplaintManagePage, ComplaintRespondPage } from '@/pages/complaints/ComplaintDetailPage'
import { ComplaintsPage } from '@/pages/complaints/ComplaintsPage'
import { CobranzaRoute } from '@/pages/cobranza/CobranzaRoute'
import { DeudasPage } from '@/pages/cobranza/DeudasPage'
import { MensajesPage } from '@/pages/cobranza/MensajesPage'
import { PagosBcpPage } from '@/pages/cobranza/PagosBcpPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { InquiriesPage } from '@/pages/inquiries/InquiriesPage'
import { InquiryDetailPage } from '@/pages/inquiries/InquiryDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { AboutPhotosPage, PhotoEditPage } from '@/pages/content/AboutPhotosPage'
import { CarouselPage, SlideEditPage } from '@/pages/content/CarouselPage'
import { CompanyPage } from '@/pages/content/CompanyPage'
import { ContentLayout } from '@/pages/content/ContentLayout'
import { PlanEditPage, PlansPage } from '@/pages/content/PlansPage'
import { contentSections } from '@/pages/content/site'
import { SocialEditPage, SocialPage } from '@/pages/content/SocialPage'
import { ZoneEditPage, ZonesPage } from '@/pages/content/ZonesPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { NotFoundPage, RouteErrorPage } from '@/pages/SimplePages'
import { UserEditPage, UsersPage } from '@/pages/UsersPage'
import '@/styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // No reintenta errores del cliente (401, 404…), solo fallas de red o del servidor.
      retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
})

/** Miga de la ruta (la muestra la barra superior). */
const crumb = (value: CrumbHandle['crumb']): CrumbHandle => ({ crumb: value })

/**
 * Sección de contenido con lista y formularios en vistas aparte: `planes`, `planes/nuevo` y
 * `planes/:itemId` (el nombre del elemento lo pone la vista de edición).
 */
function collectionRoute(path: keyof typeof contentSections, List: ComponentType, Edit: ComponentType, newLabel: string) {
  return {
    path,
    handle: crumb(contentSections[path]),
    children: [
      { index: true, element: <List /> },
      { path: 'nuevo', element: <Edit />, handle: crumb(newLabel) },
      { path: ':itemId', element: <Edit />, handle: crumb('Editar') },
    ],
  }
}

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <SpaceHomeRedirect /> },
          {
            // Espacio de trabajo: /hogar/… o /empresas/… (cada uno con su contenido y su equipo).
            path: ':space',
            element: <SpaceRoute />,
            handle: crumb(({ space }) => (isSpaceSlug(space) ? spaces[space].name : 'Espacio')),
            children: [
              { index: true, element: <DashboardPage /> },
              {
                path: 'reclamos',
                handle: crumb('Libro de Reclamaciones'),
                children: [
                  { index: true, element: <ComplaintsPage /> },
                  {
                    path: ':id',
                    handle: crumb('Hoja'),
                    children: [
                      { index: true, element: <ComplaintDetailPage /> },
                      { path: 'responder', element: <ComplaintRespondPage />, handle: crumb('Responder') },
                      { path: 'gestion', element: <ComplaintManagePage />, handle: crumb('Gestión interna') },
                    ],
                  },
                ],
              },
              {
                path: 'consultas',
                handle: crumb('Consultas'),
                children: [
                  { index: true, element: <InquiriesPage /> },
                  { path: ':id', element: <InquiryDetailPage />, handle: crumb('Consulta') },
                ],
              },
              {
                path: 'contenido',
                element: (
                  <RequireAuth role="ADMIN">
                    <ContentLayout />
                  </RequireAuth>
                ),
                handle: crumb('Contenido de la web'),
                children: [
                  { index: true, element: <Navigate to="empresa" replace /> },
                  { path: 'empresa', element: <CompanyPage />, handle: crumb(contentSections.empresa) },
                  collectionRoute('planes', PlansPage, PlanEditPage, 'Nuevo plan'),
                  collectionRoute('carrusel', CarouselPage, SlideEditPage, 'Nueva pieza'),
                  collectionRoute('redes', SocialPage, SocialEditPage, 'Nueva red social'),
                  collectionRoute('nosotros', AboutPhotosPage, PhotoEditPage, 'Nueva foto'),
                  collectionRoute('zonas', ZonesPage, ZoneEditPage, 'Nueva zona'),
                  { path: '*', element: <Navigate to="../empresa" replace /> },
                ],
              },
              {
                // Herramientas temporales de cobranza (solo Digo Hogar y ADMIN).
                path: 'cobranza',
                element: <CobranzaRoute />,
                handle: crumb('Cobranza'),
                children: [
                  { index: true, element: <Navigate to="deudas-clientes" replace /> },
                  { path: 'deudas-clientes', element: <DeudasPage />, handle: crumb('Deudas por cliente') },
                  { path: 'pagos-bcp', element: <PagosBcpPage />, handle: crumb('Pagos BCP') },
                  { path: 'mensajes', element: <MensajesPage />, handle: crumb('Mensajes masivos') },
                ],
              },
              { path: '*', element: <NotFoundPage />, handle: crumb('Página no encontrada') },
            ],
          },
          {
            path: 'usuarios',
            element: (
              <RequireAuth role="ADMIN">
                <Outlet />
              </RequireAuth>
            ),
            handle: crumb('Usuarios'),
            children: [
              { index: true, element: <UsersPage /> },
              { path: 'nuevo', element: <UserEditPage />, handle: crumb('Nuevo usuario') },
              { path: ':userId', element: <UserEditPage />, handle: crumb('Editar usuario') },
            ],
          },
          { path: 'perfil', element: <ProfilePage />, handle: crumb('Mi perfil') },
          // Enlaces de antes de los espacios: llevan a la misma vista dentro de su espacio.
          { path: 'reclamos/*', element: <LegacyRedirect /> },
          { path: 'consultas/*', element: <LegacyRedirect /> },
          { path: 'contenido/*', element: <LegacyRedirect /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toaster>
        <RouterProvider router={router} />
      </Toaster>
    </QueryClientProvider>
  </StrictMode>,
)
