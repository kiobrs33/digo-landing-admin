import { latLngBounds } from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import type { LatLng } from '@/api/types'
import 'leaflet/dist/leaflet.css'

export type MapZone = { id: string; name: string; color: string; rings: LatLng[][]; muted?: boolean }

/** Encuadra el mapa cada vez que cambian los puntos a mostrar. */
function Fit({ points }: { points: LatLng[] }) {
  const map = useMap()
  const key = points.length ? `${points.length}:${points[0].join()}:${points.at(-1)!.join()}` : ''
  useEffect(() => {
    if (!points.length) return
    // El mapa se monta dentro de un Suspense: se mide de nuevo antes de encuadrar.
    map.invalidateSize()
    map.fitBounds(latLngBounds(points), { padding: [24, 24] })
    // `key` resume los puntos: evita reencuadrar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

/**
 * Mapa de zonas de cobertura (teselas OSM, igual que la landing). Las zonas `muted` se dibujan en
 * gris como referencia; `fitTo` decide qué zonas encuadrar (por defecto, todas).
 */
export function ZonesMap({
  zones,
  fitTo,
  highlightId,
  onSelect,
  className = 'h-80',
}: {
  zones: MapZone[]
  fitTo?: string[]
  highlightId?: string | null
  onSelect?: (id: string) => void
  className?: string
}) {
  const framed = fitTo ? zones.filter((zone) => fitTo.includes(zone.id)) : zones
  const points = framed.flatMap((zone) => zone.rings.flat())

  return (
    <MapContainer
      center={[-16.4, -71.53]}
      zoom={11}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      zoomControl={false}
      className={`z-0 w-full rounded-xl ring-1 ring-line ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" zoomInTitle="Acercar" zoomOutTitle="Alejar" />
      <Fit points={points} />
      {zones.map((zone) => {
        const active = highlightId === zone.id
        const color = zone.muted ? '#8a93b8' : zone.color
        return (
          <Polygon
            key={`${zone.id}:${color}:${zone.rings.length}:${zone.rings[0]?.length}`}
            positions={zone.rings}
            eventHandlers={onSelect ? { click: () => onSelect(zone.id) } : undefined}
            pathOptions={{
              color,
              weight: active ? 3.5 : zone.muted ? 1.5 : 2.5,
              dashArray: zone.muted ? '4 4' : undefined,
              fillColor: color,
              fillOpacity: active ? 0.35 : zone.muted ? 0.06 : 0.2,
            }}
          >
            <Tooltip sticky>{zone.name}</Tooltip>
          </Polygon>
        )
      })}
    </MapContainer>
  )
}
