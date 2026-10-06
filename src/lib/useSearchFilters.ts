import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Filtros de un listado guardados en la URL: se pueden compartir y sobreviven a recargar. */
export function useSearchFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<K, string>
  const page = Number(params.get('page') ?? '1') || 1

  const setFilter = useCallback(
    (key: K | 'page', value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set(key, value)
          else next.delete(key)
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  /**
   * Cambia varios filtros en un solo paso (p. ej. "Limpiar filtros"). Llamar a `setFilter` varias
   * veces seguidas no sirve: cada llamada parte de la misma URL y la última pisa a las demás.
   */
  const setFilters = useCallback(
    (values: Partial<Record<K, string>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(values) as [K, string | undefined][]) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { filters, page, setFilter, setFilters }
}

/**
 * Texto de búsqueda que se escribe al instante y se aplica a la URL al dejar de teclear.
 * Si la URL cambia por fuera (p. ej. al volver a hacer clic en el menú), el campo se actualiza.
 */
export function useDebouncedSearch(urlValue: string, apply: (value: string) => void, delay = 350) {
  const [value, setValue] = useState(urlValue)
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue)
  // Última versión de `apply`, sin reiniciar la espera cada vez que el componente se renderiza.
  const applyRef = useRef(apply)
  useEffect(() => {
    applyRef.current = apply
  })
  // La URL cambió sin que la escribiéramos: adoptar su valor.
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue)
    setValue(urlValue)
  }

  useEffect(() => {
    if (value === urlValue) return
    const timer = setTimeout(() => applyRef.current(value), delay)
    return () => clearTimeout(timer)
  }, [value, urlValue, delay])

  return [value, setValue] as const
}
