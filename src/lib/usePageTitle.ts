import { useEffect } from 'react'

/** Título de la pestaña: ayuda a distinguir varias pestañas del panel abiertas a la vez. */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · Panel Digo`
  }, [title])
}
