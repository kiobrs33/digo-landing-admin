import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CircleAlert, Download, FileSpreadsheet, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { apiDownload } from '@/api/client'
import {
  conciliarPagos,
  descargaPath,
  type EstadoPago,
  type FilaConciliacion,
  type ResultadoConciliacion,
} from '@/api/cobranza'
import { FilterField, FilterPanel, Pager, SortHeader, Th, TableCard } from '@/components/DataTable'
import { Badge, Button, EmptyState, ErrorNotice, PageHeader, Select } from '@/components/ui'
import { formatDate, formatSoles } from '@/lib/format'
import { filterChips, paginate, theadClass } from '@/lib/table'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'
import { Asistente, BotonAtras } from './Asistente'
import { FileDrop, OpcionDescarga, Stats } from './parts'

const estados: Record<EstadoPago, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  LISTO: { label: 'Listo', tone: 'success' },
  YA_REGISTRADO: { label: 'Ya registrado', tone: 'neutral' },
  SIN_PENDIENTES: { label: 'Sin pendientes', tone: 'neutral' },
  REVISAR: { label: 'Revisar', tone: 'warning' },
  NO_ENCONTRADO: { label: 'No encontrado', tone: 'warning' },
  ERROR: { label: 'Error', tone: 'danger' },
}
const ordenEstados = Object.keys(estados) as EstadoPago[]

const rango = (desde: string, hasta: string) =>
  !desde ? '—' : desde === hasta ? formatDate(desde) : `${formatDate(desde)} – ${formatDate(hasta)}`

export function PagosBcpPage() {
  usePageTitle('Pagos BCP')
  const toast = useToast()
  const [paso, setPasoActual] = useState(0)
  const [visto, setVisto] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const [descargando, setDescargando] = useState<'mikrowisp' | 'conciliacion' | null>(null)

  const setPaso = (siguiente: number) => {
    setPasoActual(siguiente)
    setVisto((anterior) => Math.max(anterior, siguiente))
  }

  const conciliar = useMutation({
    mutationFn: () => conciliarPagos(files),
    onSuccess: () => setPaso(1),
  })
  const resultado = conciliar.data

  const cambiarArchivos = (next: File[]) => {
    setFiles(next)
    setVisto(0)
    conciliar.reset()
  }
  const reiniciar = () => {
    cambiarArchivos([])
    setPasoActual(0)
  }

  const descargar = async (tipo: 'mikrowisp' | 'conciliacion') => {
    const id = resultado?.descargas[tipo]
    if (!id) return
    setDescargando(tipo)
    try {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
      await apiDownload(
        descargaPath(id),
        undefined,
        tipo === 'mikrowisp' ? `pagos-masivos-mikrowisp_${hoy}.xlsx` : `conciliacion-bcp_${hoy}.xlsx`,
      )
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'No se pudo descargar' })
    } finally {
      setDescargando(null)
    }
  }

  const contar = (lista: EstadoPago[]) => lista.reduce((suma, estado) => suma + (resultado?.conteo[estado] ?? 0), 0)
  const yaRegistrados = contar(['YA_REGISTRADO', 'SIN_PENDIENTES'])
  const revisar = contar(['REVISAR', 'NO_ENCONTRADO', 'ERROR'])
  const alcanzado = Math.min(visto, resultado ? 2 : 0)

  const pasos = [
    {
      titulo: 'Reportes del BCP',
      resumen: resultado
        ? `${resultado.archivos.length} archivo${resultado.archivos.length === 1 ? '' : 's'} · ${resultado.total} pagos`
        : undefined,
    },
    { titulo: 'Revisar', resumen: resultado ? `${resultado.conteo.LISTO} listos · ${yaRegistrados} ya registrados` : undefined },
    { titulo: 'Registrar en Mikrowisp' },
  ]

  const contenido = [
    // 1. Reportes del BCP
    <>
      <p className="mb-5 text-sm text-muted">
        Descarga de Telecrédito los reportes de cobros de los días que quieras registrar y súbelos juntos. Sirven{' '}
        <strong className="text-ink">CREP o CDPG</strong>: los pagos repetidos entre archivos se cuentan una sola vez.
      </p>
      <FileDrop
        accept=".txt"
        multiple
        files={files}
        onChange={cambiarArchivos}
        title="Reportes de cobros (.txt)"
        hint="Puedes subir varios días a la vez."
      />
      {conciliar.isPending && (
        <p className="mt-4 flex items-center gap-3 rounded-lg bg-surface px-4 py-3 text-sm text-muted" role="status">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-navy border-r-transparent" />
          Consultando cada cliente y sus facturas en Mikrowisp; con 100 pagos tarda alrededor de medio minuto.
        </p>
      )}
      {conciliar.error && (
        <div className="mt-4">
          <ErrorNotice error={conciliar.error} />
        </div>
      )}
    </>,

    // 2. Revisar
    resultado ? (
      <>
        <p className="mb-5 text-sm text-muted">
          Cada pago del BCP comparado con las facturas pendientes del cliente en Mikrowisp.
        </p>
        <Stats
          items={[
            { label: 'Pagos', value: resultado.total },
            { label: 'Monto cobrado', value: formatSoles(resultado.montoTotal) },
            { label: 'Listos para registrar', value: resultado.conteo.LISTO },
            { label: 'Ya registrados', value: yaRegistrados },
            { label: 'Para revisar', value: revisar, tone: revisar ? 'warning' : undefined },
          ]}
        />
        <Archivos resultado={resultado} />
        {resultado.avisos.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {resultado.avisos.map((aviso) => (
              <li key={aviso} className="flex gap-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {aviso}
              </li>
            ))}
          </ul>
        )}
        <TablaPagos resultado={resultado} />
      </>
    ) : null,

    // 3. Registrar en Mikrowisp
    resultado ? (
      <>
        <p className="mb-5 text-sm text-muted">
          {resultado.facturasAPagar ? (
            <>
              <strong className="text-ink">{resultado.conteo.LISTO}</strong> pagos listos: {resultado.facturasAPagar}{' '}
              factura{resultado.facturasAPagar === 1 ? '' : 's'} por {formatSoles(resultado.montoAPagar)}. Los ya
              registrados y los que hay que revisar no van en el Excel.
            </>
          ) : (
            'No hay pagos nuevos para registrar: todos ya están en Mikrowisp o necesitan revisión.'
          )}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <OpcionDescarga
            titulo="Pagos masivos de Mikrowisp"
            etiqueta={resultado.descargas.mikrowisp ? 'Siguiente paso' : undefined}
            boton={
              <Button
                className="w-full"
                disabled={!resultado.descargas.mikrowisp}
                onClick={() => descargar('mikrowisp')}
                loading={descargando === 'mikrowisp'}
              >
                <FileSpreadsheet className="size-4" aria-hidden />
                Descargar Excel para Mikrowisp
              </Button>
            }
            nota="Cada fila lleva su factura y el N° de operación del BCP: si vuelves a subir estos reportes, se detectan como ya registrados."
          >
            <li>
              En Mikrowisp, entra a <strong>Pagos masivos</strong>.
            </li>
            <li>
              En <strong>Seleccionar plantilla y Subir</strong>, sube este Excel.
            </li>
            <li>
              En <strong>Buscar por</strong>, elige <strong>CEDULA, DNI, RUC…</strong>
            </li>
            <li>
              Pulsa <strong>Iniciar</strong> y revisa que se registren {resultado.facturasAPagar} facturas.
            </li>
          </OpcionDescarga>
          <OpcionDescarga
            titulo="Conciliación"
            boton={
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => descargar('conciliacion')}
                loading={descargando === 'conciliacion'}
              >
                <Download className="size-4" aria-hidden />
                Descargar Excel de conciliación
              </Button>
            }
            nota="Para tu control o para revisar a mano los pagos que no van en el Excel de Mikrowisp."
          >
            <li>Todos los pagos, con su cliente, facturas y resultado.</li>
            <li>Hora, N° de operación y canal (Yape, banca móvil…) de cada pago.</li>
            <li>El detalle de por qué un pago quedó para revisar.</li>
          </OpcionDescarga>
        </div>
        <p className="mt-3 text-xs text-muted">Los archivos quedan disponibles 30 minutos.</p>
      </>
    ) : null,
  ]

  const pie = [
    <>
      <span />
      <Button disabled={!files.length} loading={conciliar.isPending} onClick={() => conciliar.mutate()}>
        Verificar con Mikrowisp
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(0)} />
      <Button onClick={() => setPaso(2)}>
        Continuar
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(1)} />
      <Button variant="secondary" onClick={reiniciar}>
        <RotateCcw className="size-4" aria-hidden />
        Verificar otros reportes
      </Button>
    </>,
  ]

  return (
    <>
      <PageHeader
        title="Pagos BCP"
        description="Verifica los pagos de Telecrédito contra las facturas de Mikrowisp y genera el Excel de pagos masivos."
      />
      <Asistente pasos={pasos} actual={paso} alcanzado={alcanzado} onIr={setPaso} pie={pie[paso]}>
        {contenido[paso]}
      </Asistente>
    </>
  )
}

function Archivos({ resultado }: { resultado: ResultadoConciliacion }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-semibold text-navy">
        {resultado.archivos.length} archivo{resultado.archivos.length === 1 ? '' : 's'}
        {resultado.duplicados > 0 && ` · ${resultado.duplicados} pagos repetidos entre archivos (contados una vez)`}
      </summary>
      <ul className="mt-2 space-y-1 text-muted">
        {resultado.archivos.map((archivo) => (
          <li key={archivo.nombre}>
            <Badge tone={archivo.tipo === 'CREP' ? 'brand' : 'neutral'}>{archivo.tipo}</Badge>{' '}
            {rango(archivo.desde, archivo.hasta)} · {archivo.pagos} pagos · {formatSoles(archivo.total)} ·{' '}
            <span className="break-all">{archivo.nombre}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}


const ordenes: Record<string, (a: FilaConciliacion, b: FilaConciliacion) => number> = {
  'fecha:asc': (a, b) => a.fechaPago.localeCompare(b.fechaPago) || a.horaPago.localeCompare(b.horaPago),
  'fecha:desc': (a, b) => b.fechaPago.localeCompare(a.fechaPago) || b.horaPago.localeCompare(a.horaPago),
  'cliente:asc': (a, b) => (a.cliente?.nombre ?? '~').localeCompare(b.cliente?.nombre ?? '~'),
  'cliente:desc': (a, b) => (b.cliente?.nombre ?? '').localeCompare(a.cliente?.nombre ?? ''),
  'monto:desc': (a, b) => b.montoPagado - a.montoPagado,
  'monto:asc': (a, b) => a.montoPagado - b.montoPagado,
  'estado:asc': (a, b) => ordenEstados.indexOf(b.estado) - ordenEstados.indexOf(a.estado),
}

type FiltrosPagos = { estado: string; canal: string }
const SIN_FILTROS: FiltrosPagos = { estado: '', canal: '' }

/** Pagos verificados con el buscador, los filtros, el orden y la paginación de las demás tablas. */
function TablaPagos({ resultado }: { resultado: ResultadoConciliacion }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosPagos>(SIN_FILTROS)
  const [orden, setOrden] = useState('fecha:asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const cambiar = (cambio: Partial<FiltrosPagos>) => {
    setFiltros((actual) => ({ ...actual, ...cambio }))
    setPage(1)
  }
  const canales = [...new Set(resultado.filas.map((fila) => fila.canal))].filter(Boolean).sort()
  const texto = busqueda.toUpperCase()
  const filas = resultado.filas
    .filter(
      (fila) =>
        (!filtros.estado || fila.estado === filtros.estado) &&
        (!filtros.canal || fila.canal === filtros.canal) &&
        (!texto ||
          (fila.cliente?.nombre ?? '').toUpperCase().includes(texto) ||
          fila.documento.includes(texto) ||
          fila.operacion.includes(texto)),
    )
    .sort(ordenes[orden])
  const { rows, page: actual } = paginate(filas, page, pageSize)
  const onSort = (valor: string) => {
    setOrden(valor)
    setPage(1)
  }

  return (
    <div className="mt-8">
      <h3 className="mb-3 font-bold text-navy">Pagos</h3>
      <FilterPanel
        search={busqueda}
        onSearch={(valor) => {
          setBusqueda(valor)
          setPage(1)
        }}
        placeholder="Cliente, DNI o N° de operación"
        searchLabel="Buscar pagos"
        chips={filterChips(
          filtros,
          [
            { key: 'estado', label: 'Resultado', display: (valor) => estados[valor as EstadoPago]?.label ?? valor },
            { key: 'canal', label: 'Canal' },
          ],
          (key) => cambiar({ [key]: '' }),
        )}
        onClearFilters={() => cambiar(SIN_FILTROS)}
        onClear={() => {
          setBusqueda('')
          cambiar(SIN_FILTROS)
        }}
      >
        <FilterField id="filtro-resultado" label="Resultado en Mikrowisp">
          <Select className="h-10" id="filtro-resultado" value={filtros.estado} onChange={(event) => cambiar({ estado: event.target.value })}>
            <option value="">Todos</option>
            {ordenEstados
              .filter((estado) => resultado.conteo[estado])
              .map((estado) => (
                <option key={estado} value={estado}>
                  {estados[estado].label} ({resultado.conteo[estado]})
                </option>
              ))}
          </Select>
        </FilterField>
        <FilterField id="filtro-canal" label="Canal">
          <Select className="h-10" id="filtro-canal" value={filtros.canal} onChange={(event) => cambiar({ canal: event.target.value })}>
            <option value="">Todos</option>
            {canales.map((canal) => (
              <option key={canal} value={canal}>
                {canal}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterPanel>

      <TableCard>
        {filas.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Ningún pago coincide" icon={<Search />}>
              Prueba con otro cliente o número, o quita algún filtro.
            </EmptyState>
          </div>
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className={theadClass}>
                <tr>
                  <SortHeader label="Fecha" options={['fecha:asc', 'fecha:desc']} sort={orden} onSort={onSort} className="pl-4" />
                  <SortHeader label="Cliente" options={['cliente:asc', 'cliente:desc']} sort={orden} onSort={onSort} />
                  <Th>Canal</Th>
                  <SortHeader label="Resultado" options={['estado:asc']} hint="para revisar primero" sort={orden} onSort={onSort} />
                  <Th>Detalle</Th>
                  <SortHeader
                    label="Pagado"
                    options={['monto:desc', 'monto:asc']}
                    sort={orden}
                    onSort={onSort}
                    className="pr-4 text-right [&>button]:ml-auto [&>button]:flex"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((fila) => (
                  <tr key={`${fila.fechaPago}-${fila.operacion}`} className="align-top transition-colors hover:bg-surface/60">
                    <td className="py-3 pr-3 pl-4 whitespace-nowrap tabular-nums">
                      {fila.fechaPago ? formatDate(fila.fechaPago) : '—'}
                      <span className="block text-xs text-muted">{fila.horaPago}</span>
                    </td>
                    <td className="max-w-64 px-3 py-3">
                      <p className="truncate font-semibold text-ink" title={fila.cliente?.nombre}>
                        {fila.cliente?.nombre ?? '—'}
                      </p>
                      <p className="truncate text-xs text-muted tabular-nums">
                        {fila.documento}
                        {fila.cliente?.zona && ` · ${fila.cliente.zona}`}
                      </p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{fila.canal}</td>
                    <td className="px-3 py-3">
                      <Badge tone={estados[fila.estado].tone}>{estados[fila.estado].label}</Badge>
                    </td>
                    <td className="max-w-md px-3 py-3 text-xs text-muted">{fila.detalle}</td>
                    <td className="py-3 pr-4 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatSoles(fila.montoPagado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Móvil: tarjetas con lo esencial. */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((fila) => (
                <li key={`${fila.fechaPago}-${fila.operacion}`} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold text-ink">{fila.cliente?.nombre ?? fila.documento}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{formatSoles(fila.montoPagado)}</p>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <Badge tone={estados[fila.estado].tone}>{estados[fila.estado].label}</Badge>
                    <span className="tabular-nums">
                      {fila.fechaPago ? formatDate(fila.fechaPago) : '—'} {fila.horaPago}
                    </span>
                    <span>· {fila.canal}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{fila.detalle}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pager
          page={actual}
          pageSize={pageSize}
          total={filas.length}
          noun={['pago', 'pagos']}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </TableCard>
    </div>
  )
}
