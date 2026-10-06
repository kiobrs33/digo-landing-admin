import { LogOut, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { Dl } from '@/components/DetailParts'
import { Badge, Button, Card, PageHeader } from '@/components/ui'
import { Avatar } from '@/layout/TopBar'
import { roleLabel } from '@/lib/labels'
import { allowedSpaces } from '@/lib/space'
import { usePageTitle } from '@/lib/usePageTitle'

const roleScope = {
  ADMIN: 'Gestiona todo el panel: reclamos, consultas, contenido de las webs y usuarios.',
  AGENTE: 'Atiende el Libro de Reclamaciones y las consultas.',
} as const

/** Datos de la sesión actual. Los cambios los hace un administrador desde Usuarios. */
export function ProfilePage() {
  const { user, logout } = useAuth()
  usePageTitle('Mi perfil')
  if (!user) return null
  const isAdmin = user.role === 'ADMIN'

  return (
    <>
      <PageHeader title="Mi perfil" description="Los datos con los que ingresas al panel." />
      <Card className="max-w-2xl">
        <div className="flex items-center gap-4 border-b border-line pb-5">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-navy">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>

        <div className="py-5">
          <Dl
            rows={[
              ['Nombre', user.name],
              ['Correo', user.email],
              ['Rol', <Badge key="role" tone={isAdmin ? 'brand' : 'neutral'}>{roleLabel[user.role]}</Badge>],
              ['Espacios', allowedSpaces(user.sites).map((space) => `${space.name} (${space.domain})`).join(' · ')],
              ['Puede', roleScope[user.role]],
            ]}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          {isAdmin ? (
            <Link
              to={`/usuarios/${user.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy ring-1 ring-line transition-colors hover:bg-surface-alt"
            >
              <Pencil className="size-4" aria-hidden />
              Editar mis datos o contraseña
            </Link>
          ) : (
            <p className="text-sm text-muted">Para cambiar tu nombre, correo o contraseña, pídeselo a un administrador.</p>
          )}
          <Button variant="danger" onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </>
  )
}
