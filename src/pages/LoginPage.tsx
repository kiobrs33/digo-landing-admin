import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button, ErrorNotice, Field, Input } from '@/components/ui'

export function LoginPage() {
  usePageTitle('Ingresar')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (user) return <Navigate to={from} replace />

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-navy-900 px-4 bg-[radial-gradient(ellipse_at_top,var(--color-navy-700),transparent_60%)]">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <img src="/digo-logo-128.png" alt="Digo Telecom" className="mx-auto size-16" />
        <h1 className="mt-4 text-center text-xl font-extrabold text-navy">Panel administrativo</h1>
        <p className="mt-1 text-center text-sm text-muted">DIGO HOGAR · DIGO EMPRESAS</p>

        <div className="mt-6 flex flex-col gap-4">
          {login.error && <ErrorNotice error={login.error} />}
          <Field label="Correo">
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                placeholder="tu.nombre@digo.net.pe"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <Field label="Contraseña">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" loading={login.isPending} className="mt-2 w-full py-2.5">
            Ingresar
          </Button>
        </div>
      </form>
    </div>
  )
}
