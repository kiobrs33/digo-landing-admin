import { useAuth } from '@/auth/context'
import { allowedSpaces, lastSpace, spaces } from '@/lib/space'

/** Espacio al que entrar: el último usado si sigue permitido, si no el primero permitido. */
export function useHomeSpace() {
  const { user } = useAuth()
  const allowed = allowedSpaces(user?.sites)
  const last = lastSpace()
  return allowed.find((space) => space.slug === last) ?? allowed[0] ?? spaces.hogar
}
