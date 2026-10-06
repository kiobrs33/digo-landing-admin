import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { Role, Site, User } from '@/api/types'
import { useAuth } from '@/auth/context'
import { Pencil, UserPlus, Users } from 'lucide-react'
import { FilterField, FilterPanel, Pager, SortHeader, TableCard, Th } from '@/components/DataTable'
import { Avatar } from '@/layout/TopBar'
import { SpaceIcon } from '@/layout/SpaceSwitcher'
import { spaceList, spaceOfSite } from '@/lib/space'
import { cx } from '@/lib/cx'
import { formatShortDate } from '@/lib/format'
import { filterChips, paginate, theadClass } from '@/lib/table'
import { useSearchFilters } from '@/lib/useSearchFilters'
import { Badge, Button, Card, DetailSkeleton, EmptyState, ErrorNotice, Field, Input, ListSkeleton, PageHeader, Select } from '@/components/ui'
import { useCrumbLabel } from '@/lib/crumbs'
import { roleLabel } from '@/lib/labels'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'

type FormState = { name: string; email: string; role: Role; password: string; sites: Site[] }
const emptyForm: FormState = { name: '', email: '', role: 'AGENTE', password: '', sites: ['HOGAR', 'EMPRESAS'] }

const filterKeys = ['search', 'role', 'state', 'space', 'sort', 'pageSize'] as const
const DEFAULT_SORT = 'name:asc'

/** Orden de la tabla de usuarios (en el navegador: la lista llega completa). */
const compareUsers: Record<string, (a: User, b: User) => number> = {
  'name:asc': (a, b) => a.name.localeCompare(b.name, 'es'),
  'name:desc': (a, b) => b.name.localeCompare(a.name, 'es'),
  'createdAt:desc': (a, b) => b.createdAt.localeCompare(a.createdAt),
  'createdAt:asc': (a, b) => a.createdAt.localeCompare(b.createdAt),
}

export function UsersPage() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const users = useUsers()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const toast = useToast()
  const { filters, page, setFilter, setFilters } = useSearchFilters(filterKeys)
  const pageSize = Number(filters.pageSize) || 20
  const sort = filters.sort in compareUsers ? filters.sort : DEFAULT_SORT
  usePageTitle('Usuarios')

  const setActive = useMutation({
    mutationFn: ({ user, active }: { user: User; active: boolean }) =>
      api<User>(`/admin/users/${user.id}`, { method: 'PATCH', body: { active } }),
    onSuccess: (_data, { user, active }) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setConfirmingId(null)
      toast(
        active
          ? { message: `${user.name} puede volver a ingresar.` }
          : {
              message: `${user.name} ya no puede ingresar al panel.`,
              action: { label: 'Deshacer', onClick: () => setActive.mutate({ user, active: true }) },
            },
      )
    },
  })

  const term = filters.search.toLowerCase()
  const matching = (users.data ?? [])
    .filter((user) => !term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term))
    .filter((user) => !filters.role || user.role === filters.role)
    .filter((user) => !filters.state || (filters.state === 'active') === user.active)
    .filter((user) => !filters.space || user.sites.includes(filters.space as Site))
    .sort(compareUsers[sort])
  const { page: current, rows } = paginate(matching, page, pageSize)
  const clearFilters = () => setFilters({ search: '', role: '', state: '', space: '' })
  const onSort = (value: string) => setFilter('sort', value === DEFAULT_SORT ? '' : value)

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Administrador: gestiona todo. Agente: atiende reclamos y consultas."
        actions={
          <Link
            to="nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-magenta px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-magenta-deep"
          >
            <UserPlus className="size-4" aria-hidden />
            Nuevo usuario
          </Link>
        }
      />

      <FilterPanel
        search={filters.search}
        onSearch={(value) => setFilter('search', value)}
        placeholder="Nombre o correo"
        searchLabel="Buscar usuarios"
        chips={filterChips(
          filters,
          [
            { key: 'role', label: 'Rol', display: (value) => roleLabel[value as Role] ?? value },
            { key: 'space', label: 'Espacio', display: (value) => spaceOfSite(value as Site).name },
            { key: 'state', label: 'Estado', display: (value) => (value === 'active' ? 'Activos' : 'Desactivados') },
          ],
          (key) => setFilter(key, ''),
        )}
        onClearFilters={() => setFilters({ role: '', state: '', space: '' })}
        onClear={clearFilters}
      >
        <FilterField id="filtro-espacio" label="Espacio">
          <Select className="h-10" id="filtro-espacio" value={filters.space} onChange={(event) => setFilter('space', event.target.value)}>
            <option value="">Todos</option>
            {spaceList.map((option) => (
              <option key={option.site} value={option.site}>
                {option.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="filtro-rol" label="Rol">
          <Select className="h-10" id="filtro-rol" value={filters.role} onChange={(event) => setFilter('role', event.target.value)}>
            <option value="">Todos</option>
            <option value="ADMIN">{roleLabel.ADMIN}</option>
            <option value="AGENTE">{roleLabel.AGENTE}</option>
          </Select>
        </FilterField>
        <FilterField id="filtro-estado" label="Estado">
          <Select className="h-10" id="filtro-estado" value={filters.state} onChange={(event) => setFilter('state', event.target.value)}>
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Desactivados</option>
          </Select>
        </FilterField>
      </FilterPanel>

      <ErrorNotice error={users.error ?? setActive.error} />
      {users.isPending ? (
        <ListSkeleton rows={3} />
      ) : !matching.length ? (
        <EmptyState title="Ningún usuario coincide" icon={<Users />}>
          <button type="button" className="font-semibold text-navy underline" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </EmptyState>
      ) : (
        <TableCard>
          <table className="hidden w-full text-left text-sm md:table">
            <thead className={theadClass}>
              <tr>
                <SortHeader label="Usuario" options={['name:asc', 'name:desc']} sort={sort} onSort={onSort} className="pl-4" />
                <Th>Rol</Th>
                <Th>Espacios</Th>
                <Th>Estado</Th>
                <SortHeader label="Alta" options={['createdAt:desc', 'createdAt:asc']} sort={sort} onSort={onSort} />
                <Th className="pr-4 text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((user) => (
                <tr key={user.id} className="align-middle transition-colors hover:bg-surface/60">
                  <td className="py-3 pr-3 pl-4">
                    <div className={cx('flex items-center gap-3', !user.active && 'opacity-60')}>
                      <Avatar name={user.name} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {user.name}
                          {user.id === me?.id && <span className="font-normal text-muted"> (tú)</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={user.role === 'ADMIN' ? 'brand' : 'neutral'}>{roleLabel[user.role]}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <UserSpaces sites={user.sites} />
                  </td>
                  <td className="px-3 py-3">
                    <UserState active={user.active} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted">{formatShortDate(user.createdAt)}</td>
                  <td className="py-3 pr-4 pl-3">
                    <UserActions
                      user={user}
                      isMe={user.id === me?.id}
                      confirming={confirmingId === user.id}
                      busy={setActive.isPending && setActive.variables?.user.id === user.id}
                      onConfirm={setConfirmingId}
                      onSetActive={(active) => setActive.mutate({ user, active })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Móvil: tarjetas. */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((user) => (
              <li key={user.id} className="px-4 py-3.5">
                <div className={cx('flex items-center gap-3', !user.active && 'opacity-60')}>
                  <Avatar name={user.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {user.name}
                      {user.id === me?.id && <span className="font-normal text-muted"> (tú)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <Badge tone={user.role === 'ADMIN' ? 'brand' : 'neutral'}>{roleLabel[user.role]}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <UserState active={user.active} />
                  <UserActions
                    user={user}
                    isMe={user.id === me?.id}
                    confirming={confirmingId === user.id}
                    busy={setActive.isPending && setActive.variables?.user.id === user.id}
                    onConfirm={setConfirmingId}
                    onSetActive={(active) => setActive.mutate({ user, active })}
                  />
                </div>
              </li>
            ))}
          </ul>

          <Pager
            page={current}
            pageSize={pageSize}
            total={matching.length}
            noun={['usuario', 'usuarios']}
            onPage={(next) => setFilter('page', String(next))}
            onPageSize={(size) => setFilter('pageSize', size === 20 ? '' : String(size))}
          />
        </TableCard>
      )}
    </>
  )
}

function UserState({ active }: { active: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm', active ? 'text-emerald-800' : 'text-muted')}>
      <span aria-hidden className={cx('size-2 rounded-full', active ? 'bg-emerald-500' : 'bg-navy/25')} />
      {active ? 'Activo' : 'Desactivado'}
    </span>
  )
}

/** Editar y activar/desactivar. Desactivar corta el acceso de inmediato: se confirma en la fila. */
function UserActions({
  user,
  isMe,
  confirming,
  busy,
  onConfirm,
  onSetActive,
}: {
  user: User
  isMe: boolean
  confirming: boolean
  busy: boolean
  onConfirm: (id: string | null) => void
  onSetActive: (active: boolean) => void
}) {
  if (confirming) {
    return (
      <span className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label={`Confirmar desactivar a ${user.name}`}>
        <span className="text-sm text-muted">¿Desactivar? No podrá ingresar.</span>
        <Button variant="ghost" onClick={() => onConfirm(null)}>
          Cancelar
        </Button>
        <Button variant="danger" autoFocus loading={busy} onClick={() => onSetActive(false)}>
          Sí, desactivar
        </Button>
      </span>
    )
  }
  return (
    <span className="flex justify-end gap-1">
      <Link
        to={user.id}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy transition-colors hover:bg-surface-alt"
      >
        <Pencil className="size-4" aria-hidden />
        Editar
      </Link>
      {!isMe &&
        (user.active ? (
          <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => onConfirm(user.id)}>
            Desactivar
          </Button>
        ) : (
          <Button variant="secondary" loading={busy} onClick={() => onSetActive(true)}>
            Activar
          </Button>
        ))}
    </span>
  )
}

const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/admin/users') })

/** Crear (`/usuarios/nuevo`) o editar (`/usuarios/:userId`) un usuario, en su propia vista. */
export function UserEditPage() {
  const { userId } = useParams()
  const { pathname } = useLocation()
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const users = useUsers()
  const user = userId ? (users.data?.find((entry) => entry.id === userId) ?? null) : null
  const title = user ? (user.id === me?.id ? 'Editar mis datos' : `Editar a ${user.name}`) : 'Nuevo usuario'
  useCrumbLabel(pathname, user?.name)
  usePageTitle(title)

  if (userId && users.isPending) return <DetailSkeleton />
  if (userId && users.error) return <ErrorNotice error={users.error} />
  if (userId && !user) {
    return (
      <EmptyState title="No encontramos este usuario">
        <Link to="/usuarios" className="font-semibold text-navy underline">
          Volver a Usuarios
        </Link>
      </EmptyState>
    )
  }

  return (
    <>
      <PageHeader
        title={title}
        description={user ? user.email : 'Recibirá acceso al panel con el correo y la contraseña que definas.'}
      />
      <UserForm user={user} onDone={() => navigate('/usuarios')} />
    </>
  )
}

function UserForm({ user, onDone }: { user: User | null; onDone: () => void }) {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(
    user ? { name: user.name, email: user.email, role: user.role, password: '', sites: user.sites } : emptyForm,
  )
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, password: form.password || undefined }
      return user
        ? api<User>(`/admin/users/${user.id}`, { method: 'PATCH', body })
        : api<User>('/admin/users', { method: 'POST', body })
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ message: user ? `Cambios de ${saved.name} guardados.` : `Usuario ${saved.name} creado.` })
      onDone()
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          {(id) => <Input id={id} required minLength={2} placeholder="Ej.: Yudi Ccama" value={form.name} onChange={(e) => set('name', e.target.value)} />}
        </Field>
        <Field label="Correo">
          {(id) => <Input id={id} type="email" required placeholder="nombre@digo.net.pe" value={form.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="Rol">
          {(id) => (
            <Select
              id={id}
              value={form.role}
              disabled={user?.id === me?.id}
              onChange={(e) => set('role', e.target.value as Role)}
            >
              <option value="AGENTE">{roleLabel.AGENTE}</option>
              <option value="ADMIN">{roleLabel.ADMIN}</option>
            </Select>
          )}
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">Espacios a los que entra</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {spaceList.map((option) => {
              const checked = form.sites.includes(option.site)
              return (
                <label
                  key={option.site}
                  data-space={option.slug}
                  className={cx(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ring-1 transition-colors',
                    checked ? 'bg-magenta/5 ring-2 ring-magenta' : 'ring-line hover:bg-surface',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      set('sites', checked ? form.sites.filter((site) => site !== option.site) : [...form.sites, option.site])
                    }
                    className="size-4 accent-magenta"
                  />
                  <SpaceIcon slug={option.slug} className="size-8" />
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-ink">{option.name}</span>
                    <span className="block text-xs text-muted">{option.audience}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className={cx('mt-1.5 text-xs', form.sites.length ? 'text-muted' : 'text-red-700')}>
            {form.sites.length
              ? 'Solo verá las consultas, reclamos y contenido de estos espacios.'
              : 'Elige al menos un espacio.'}
          </p>
        </fieldset>
        <Field
          label={user ? 'Nueva contraseña' : 'Contraseña'}
          hint={user ? 'Déjala vacía para no cambiarla. Mínimo 10 caracteres.' : 'Mínimo 10 caracteres.'}
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              placeholder={user ? 'Déjala vacía para mantener la actual' : 'Mínimo 10 caracteres'}
              required={!user}
              minLength={10}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <ErrorNotice error={save.error} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {user ? 'Guardar' : 'Crear usuario'}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** Espacios del usuario como chips de color (el de cada espacio). */
function UserSpaces({ sites }: { sites: Site[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {spaceList
        .filter((space) => sites.includes(space.site))
        .map((space) => (
          <span
            key={space.site}
            data-space={space.slug}
            className="inline-flex items-center rounded-full bg-magenta/10 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-magenta-deep"
          >
            {space.name.replace('Digo ', '')}
          </span>
        ))}
    </span>
  )
}
