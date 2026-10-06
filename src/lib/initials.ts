/** Iniciales para el avatar: "Yudi Condori" → "YC". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
