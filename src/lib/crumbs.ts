import { createContext, useContext, useEffect } from 'react'
import type { Params } from 'react-router-dom'

/**
 * Miga de una ruta (`handle.crumb` en el router): un texto fijo o uno armado con los parámetros.
 * Las rutas de un elemento concreto ("Hoja N° 000006-2026", "1000 Mbps") muestran un texto
 * genérico hasta que la página carga el dato y lo registra con `useCrumbLabel`.
 */
export type Crumb = string | ((params: Params) => string)
export type CrumbHandle = { crumb?: Crumb }

type CrumbLabels = {
  labels: ReadonlyMap<string, string>
  setLabel: (path: string, label: string | null) => void
}

export const CrumbContext = createContext<CrumbLabels>({ labels: new Map(), setLabel: () => undefined })

export const useCrumbLabels = () => useContext(CrumbContext).labels

/** Nombre de la miga de `path` mientras la página está montada. */
export function useCrumbLabel(path: string, label: string | undefined) {
  const { setLabel } = useContext(CrumbContext)
  useEffect(() => {
    if (!label) return
    setLabel(path, label)
    return () => setLabel(path, null)
  }, [path, label, setLabel])
}
