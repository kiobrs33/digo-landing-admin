import { createContext, useContext } from 'react'

/** Lo que un `Field` comparte con su control: ids de la ayuda/error y si hay error. */
export const FieldContext = createContext<{ describedBy?: string; invalid: boolean } | null>(null)

export const useFieldContext = () => useContext(FieldContext)
