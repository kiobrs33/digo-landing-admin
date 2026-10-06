import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  ExternalLink,
  FileSpreadsheet,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
} from 'lucide-react'
import { Fragment, type ReactNode, useState } from 'react'
import { apiDownload } from '@/api/client'
import {
  type Campana,
  campanas as listarCampanas,
  cancelarCampana,
  cargarDestinatarios,
  type ClienteMensaje,
  crearCampana,
  type Destinatarios,
  enviarPrueba,
  type Plantilla,
  plantillas as listarPlantillas,
  reintentarCampana,
} from '@/api/cobranza'
import { FilterField, FilterPanel, Pager, Th, TableCard } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Badge, Button, EmptyState, ErrorNotice, Field, Input, PageHeader, Select, Spinner } from '@/components/ui'
import { cx } from '@/lib/cx'
import { timeAgo } from '@/lib/format'
import { filterChips, paginate, theadClass } from '@/lib/table'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'
import { Asistente, BotonAtras } from './Asistente'
import { FileDrop, Stats } from './parts'

const clave = (plantilla: Plantilla) => `${plantilla.nombre}|${plantilla.idioma}`

const etiquetaEncabezado: Record<NonNullable<Plantilla['encabezado']>, string> = {
  TEXT: 'Texto del encabezado',
  IMAGE: 'Imagen (enlace)',
  DOCUMENT: 'PDF (enlace)',
  VIDEO: 'Video (enlace)',
}

/** Valor de una variable en la tabla; vacío se marca en ámbar. */
function Dato({ valor, titulo }: { valor: string; titulo?: string }) {
  if (!valor) return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">Falta</span>
  return (
    <span className="block truncate text-ink" title={titulo || valor}>
      {valor}
    </span>
  )
}

/** Al cliente le falta un dato del mensaje (no solo el celular). */
/** Problema en pocas palabras para la tabla ("Variable {{3}}" vacía → Falta {{3}}). */
const problemaCorto = (problema: string) => {
  const variable = /\{\{(\w+)\}\}/.exec(problema)
  if (variable) return `Falta {{${variable[1]}}}`
  return problema.endsWith('vacío') ? 'Falta el enlace' : problema
}

const faltaDato = (cliente: ClienteMensaje) =>
  Boolean(cliente.problema) && cliente.problema !== 'Sin celular' && cliente.problema !== 'Celular inválido'

export function MensajesPage() {
  usePageTitle('Mensajes masivos')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [paso, setPasoActual] = useState(0)
  const [visto, setVisto] = useState(0)
  const setPaso = (siguiente: number) => {
    setPasoActual(siguiente)
    setVisto((anterior) => Math.max(anterior, siguiente))
  }

  const plantillasQuery = useQuery({ queryKey: ['mensajes', 'plantillas'], queryFn: () => listarPlantillas() })
  const [refrescando, setRefrescando] = useState(false)
  const [plantillaKey, setPlantillaKey] = useState('')
  const plantilla = plantillasQuery.data?.find((item) => clave(item) === plantillaKey)

  const [files, setFiles] = useState<File[]>([])
  const [destinatarios, setDestinatarios] = useState<Destinatarios | null>(null)
  /** Cliente cuyo mensaje se ve en la vista previa y se usa para la prueba. */
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [telefono, setTelefono] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  /** Id del envío recién creado: el paso 4 muestra su avance en vez del formulario. */
  const [enviada, setEnviada] = useState<string | null>(null)

  const cargar = useMutation({
    mutationFn: (file: File) => cargarDestinatarios(file, plantilla!),
    onSuccess: (data) => {
      setDestinatarios(data)
      setSeleccion(data.clientes.find((cliente) => !cliente.problema)?.fila ?? data.clientes[0]?.fila ?? null)
    },
  })

  /** El Excel es de una plantilla: al cambiar de plantilla hay que subir el suyo. */
  const limpiarClientes = () => {
    setFiles([])
    setDestinatarios(null)
    setSeleccion(null)
    cargar.reset()
  }

  const elegirPlantilla = (key: string) => {
    setPlantillaKey(key)
    limpiarClientes()
    setVisto(0)
  }

  const refrescar = async () => {
    setRefrescando(true)
    try {
      queryClient.setQueryData(['mensajes', 'plantillas'], await listarPlantillas(true))
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'No se pudieron leer las plantillas' })
    } finally {
      setRefrescando(false)
    }
  }

  const cliente = destinatarios?.clientes.find((item) => item.fila === seleccion)
  const prueba = useMutation({
    mutationFn: () =>
      enviarPrueba({
        plantilla: plantilla!.nombre,
        idioma: plantilla!.idioma,
        telefono,
        variables: cliente!.variables,
        encabezado: cliente!.encabezado ?? undefined,
      }),
    onSuccess: (data) => toast({ message: `Prueba enviada a +${data.telefono}` }),
  })

  const enviar = useMutation({
    mutationFn: () =>
      crearCampana({ archivoId: destinatarios!.archivoId, plantilla: plantilla!.nombre, idioma: plantilla!.idioma }),
    onSuccess: (campana) => {
      setConfirmar(false)
      setEnviada(campana.id)
      void queryClient.invalidateQueries({ queryKey: ['mensajes', 'campanas'] })
    },
  })

  // Avance del envío recién hecho (misma consulta que "Envíos recientes": se actualiza sola).
  const campanasQuery = useQuery({ queryKey: ['mensajes', 'campanas'], queryFn: listarCampanas })
  const campanaEnviada = campanasQuery.data?.items.find((item) => item.id === enviada)

  /** Después de enviar: empezar otro envío desde la plantilla o con otro Excel de la misma. */
  const nuevoEnvio = (mismaPlantilla: boolean) => {
    setEnviada(null)
    limpiarClientes()
    setTelefono('')
    if (mismaPlantilla) {
      setVisto(1)
      setPasoActual(1)
    } else {
      setPlantillaKey('')
      setVisto(0)
      setPasoActual(0)
    }
  }

  const descargarPlantilla = async () => {
    if (!plantilla) return
    try {
      await apiDownload(
        '/admin/mensajes/plantillas/excel',
        { nombre: plantilla.nombre, idioma: plantilla.idioma },
        `clientes_${plantilla.nombre}.xlsx`,
      )
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'No se pudo descargar' })
    }
  }

  // Hasta dónde se puede ir: lo visitado, mientras lo anterior siga listo.
  const listo = !plantilla ? 0 : !destinatarios ? 1 : 3
  const alcanzado = Math.min(visto, listo)
  const pasos = [
    { titulo: 'Plantilla', resumen: plantilla?.nombre },
    { titulo: 'Clientes', resumen: destinatarios ? `${destinatarios.total} en el Excel` : undefined },
    {
      titulo: 'Revisar',
      resumen: destinatarios ? `${destinatarios.listos} listos · ${destinatarios.conProblema} con problema` : undefined,
    },
    { titulo: 'Prueba y envío' },
  ]

  // Cliente que se ve en la tarjeta de vista previa (se recorren con ‹ ›).
  const indiceCliente = destinatarios?.clientes.findIndex((item) => item.fila === seleccion) ?? -1
  const moverCliente = (paso: number) => {
    const lista = destinatarios?.clientes ?? []
    const siguiente = lista[(indiceCliente + paso + lista.length) % lista.length]
    if (siguiente) setSeleccion(siguiente.fila)
  }

  const contenido = [
    // 1. Plantilla
    <>
      <p className="mb-5 text-sm text-muted">
        Elige el mensaje de WhatsApp que vas a enviar. Solo aparecen las plantillas aprobadas por Meta.
      </p>
      {plantillasQuery.isPending ? (
        <Spinner label="Cargando plantillas de WhatsApp…" />
      ) : plantillasQuery.error ? (
        <ErrorNotice error={plantillasQuery.error} />
      ) : (
        <div className="flex max-w-xl items-end gap-2">
            <div className="flex-1">
              <Field label="Plantilla">
                {(id) => (
                  <Select id={id} value={plantillaKey} onChange={(event) => elegirPlantilla(event.target.value)}>
                    <option value="">Elige una plantilla…</option>
                    {plantillasQuery.data?.map((item) => (
                      <option key={clave(item)} value={clave(item)}>
                        {item.nombre} ({item.idioma})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Button variant="secondary" onClick={refrescar} loading={refrescando} aria-label="Actualizar plantillas">
              {!refrescando && <RefreshCw className="size-4" aria-hidden />}
            </Button>
        </div>
      )}
      {plantilla && (
        <p className="mt-4 text-sm text-muted">
          Mira el mensaje en la vista previa. Pide{' '}
          <strong className="text-ink">
            {plantilla.variables.length} dato{plantilla.variables.length === 1 ? '' : 's'}
          </strong>{' '}
          por cliente{plantilla.encabezadoConVariable ? ' y un enlace para el encabezado' : ''}.
        </p>
      )}
    </>,

    // 2. Clientes
    <>
      <p className="mb-5 text-sm text-muted">
        Cada cliente va en una fila del Excel de esta plantilla, con su celular y <strong className="text-ink">sus
        propios datos</strong> para cada variable del mensaje (nombre, mes, monto, enlace…).
      </p>
      <ol className="space-y-6">
        <PasoExcel n={1} titulo="Descarga el Excel de esta plantilla">
          <p className="mb-3 text-sm text-muted">
            Trae las columnas que pide <strong className="text-ink">{plantilla?.nombre}</strong> y una hoja con el
            mensaje y un ejemplo de cada dato.
          </p>
          <Button variant="secondary" onClick={descargarPlantilla}>
            <FileSpreadsheet className="size-4" aria-hidden />
            Descargar plantilla Excel
          </Button>
        </PasoExcel>
        <PasoExcel n={2} titulo="Llénalo con tus clientes">
          <p className="text-sm text-muted">
            Una fila por cliente desde la fila 2. No cambies los encabezados de la fila 1.
          </p>
        </PasoExcel>
        <PasoExcel n={3} titulo="Súbelo aquí">
          <FileDrop
            accept=".xlsx"
            files={files}
            onChange={(next) => {
              limpiarClientes()
              setFiles(next)
              if (next[0]) cargar.mutate(next[0])
            }}
            title="Excel con tus clientes (.xlsx)"
            hint="El que llenaste en el punto 2."
          />
          {cargar.isPending && <Spinner label="Leyendo el Excel…" />}
          {cargar.error && (
            <div className="mt-4">
              <ErrorNotice error={cargar.error} />
            </div>
          )}
          {destinatarios && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>{destinatarios.total}</strong> clientes · <strong>{destinatarios.listos}</strong> listos para
                enviar
                {destinatarios.conProblema > 0 && (
                  <>
                    {' '}
                    · <strong>{destinatarios.conProblema}</strong> con problema (los verás en el paso siguiente)
                  </>
                )}
                .
              </span>
            </p>
          )}
        </PasoExcel>
      </ol>
    </>,

    // 3. Revisar
    destinatarios && plantilla ? (
      <>
        <p className="mb-5 text-sm text-muted">
          Elige un cliente para ver su mensaje en la vista previa. Los que tienen un problema no se envían: corrígelos en el Excel y
          vuelve a subirlo si quieres incluirlos.
        </p>
        <Stats
          items={[
            { label: 'Clientes', value: destinatarios.total },
            { label: 'Listos para enviar', value: destinatarios.listos },
            {
              label: 'Con problema',
              value: destinatarios.conProblema,
              tone: destinatarios.conProblema ? 'warning' : undefined,
            },
          ]}
        />
        <TablaClientes
          plantilla={plantilla}
          destinatarios={destinatarios}
          seleccion={seleccion}
          onSeleccion={setSeleccion}
        />
      </>
    ) : null,

    // 4. Prueba y envío
    enviada ? (
      <EnvioHecho key="enviado" campana={campanaEnviada} />
    ) : destinatarios && plantilla ? (
      <>
        <p className="mb-5 text-sm text-muted">Prueba primero en tu celular y luego envía a todos.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-xl bg-white p-4 ring-1 ring-line">
            <h3 className="mb-1 font-bold text-navy">1. Mensaje de prueba</h3>
            <p className="mb-3 text-sm text-muted">
              {cliente ? (
                <>
                  Con los datos de <strong className="text-ink">{cliente.nombre || `la fila ${cliente.fila}`}</strong>.
                  Cámbialo en <strong className="text-ink">Revisar</strong>.
                </>
              ) : (
                'Elige un cliente en Revisar.'
              )}
            </p>
            <Field label="Tu celular">
              {(id) => (
                <Input
                  id={id}
                  inputMode="tel"
                  placeholder="987 654 321"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                />
              )}
            </Field>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              // La prueba va a tu celular: sirve aunque el del cliente sea inválido, pero no si le falta un dato.
              disabled={!cliente || faltaDato(cliente) || telefono.replace(/\D/g, '').length < 9}
              loading={prueba.isPending}
              onClick={() => prueba.mutate()}
            >
              <Send className="size-4" aria-hidden />
              Enviar prueba
            </Button>
            {prueba.error && (
              <div className="mt-3">
                <ErrorNotice error={prueba.error} />
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-xl bg-magenta/[0.03] p-4 ring-1 ring-magenta/30">
            <h3 className="mb-1 font-bold text-navy">2. Envío masivo</h3>
            <p className="flex-1 text-sm text-muted">
              Se enviará <strong className="text-ink">{plantilla.nombre}</strong> a{' '}
              <strong className="text-ink">
                {destinatarios.listos} cliente{destinatarios.listos === 1 ? '' : 's'}
              </strong>
              , cada uno con sus datos.
              {destinatarios.conProblema > 0 &&
                ` ${destinatarios.conProblema} con problema no se envían y quedan en el reporte del envío.`}
            </p>
            <Button className="mt-4 w-full" disabled={destinatarios.listos === 0} onClick={() => setConfirmar(true)}>
              <MessageCircle className="size-4" aria-hidden />
              Enviar a {destinatarios.listos} cliente{destinatarios.listos === 1 ? '' : 's'}
            </Button>
          </section>
        </div>
      </>
    ) : null,
  ]

  const pie = [
    <>
      <span />
      <Button disabled={!plantilla} onClick={() => setPaso(1)}>
        Continuar
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(0)} />
      <Button disabled={!destinatarios} onClick={() => setPaso(2)}>
        Continuar
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(1)} />
      <Button disabled={!destinatarios?.listos} onClick={() => setPaso(3)}>
        Continuar
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    enviada ? (
      <>
        <Button variant="secondary" onClick={() => nuevoEnvio(true)}>
          <FileSpreadsheet className="size-4" aria-hidden />
          Otro Excel con esta plantilla
        </Button>
        <Button onClick={() => nuevoEnvio(false)}>
          <RotateCcw className="size-4" aria-hidden />
          Nuevo envío
        </Button>
      </>
    ) : (
      <>
        <BotonAtras onClick={() => setPaso(2)} />
        <span />
      </>
    ),
  ]

  return (
    <>
      <PageHeader title="Mensajes masivos" description="Envía una plantilla aprobada de WhatsApp a tus clientes, cada uno con sus datos." />

      <div className="space-y-8">
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Asistente pasos={pasos} actual={paso} alcanzado={alcanzado} onIr={enviada ? () => {} : setPaso} pie={pie[paso]}>
            {contenido[paso]}
          </Asistente>
          <aside className="xl:sticky xl:top-6">
            <TarjetaVistaPrevia
              plantilla={plantilla}
              cliente={cliente}
              posicion={indiceCliente + 1}
              total={destinatarios?.clientes.length ?? 0}
              onAnterior={() => moverCliente(-1)}
              onSiguiente={() => moverCliente(1)}
            />
          </aside>
        </div>
        <Campanas />
      </div>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="¿Enviar los mensajes?"
        description="El envío no se puede deshacer; sí puedes detenerlo a mitad de camino."
      >
        <div className="space-y-3 px-6 py-5 text-sm">
          <p>
            Se enviará la plantilla <strong>{plantilla?.nombre}</strong> a <strong>{destinatarios?.listos}</strong>{' '}
            cliente{destinatarios?.listos === 1 ? '' : 's'} de <strong>{destinatarios?.nombre}</strong>, cada uno con sus
            datos.
          </p>
          {enviar.error && <ErrorNotice error={enviar.error} />}
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="secondary" onClick={() => setConfirmar(false)}>
            Cancelar
          </Button>
          <Button loading={enviar.isPending} onClick={() => enviar.mutate()}>
            Sí, enviar
          </Button>
        </footer>
      </Modal>
    </>
  )
}

/** Paso 4 después de enviar: confirmación y avance en vivo del envío. */
function EnvioHecho({ campana }: { campana: Campana | undefined }) {
  const procesados = campana ? campana.total - campana.pendientes : 0
  const avance = campana?.total ? Math.round((procesados / campana.total) * 100) : 0
  const terminado = campana && campana.estado !== 'EN_CURSO'
  return (
    <div className="mx-auto max-w-xl py-4 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        {terminado ? <CircleCheck className="size-6" aria-hidden /> : <Send className="size-5" aria-hidden />}
      </span>
      <h3 className="mt-3 text-lg font-bold text-navy">{terminado ? 'Envío terminado' : 'Envío en curso'}</h3>
      <p className="mt-1 text-sm text-muted">
        {terminado
          ? 'Descarga el resultado en "Envíos recientes" para ver el detalle de cada cliente.'
          : 'Puedes cerrar esta página: el envío sigue en el servidor.'}
      </p>
      {campana && (
        <div className="mt-5 text-left">
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-alt"
            role="progressbar"
            aria-valuenow={avance}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance del envío"
          >
            <div className="h-full rounded-full bg-magenta transition-[width] duration-500" style={{ width: `${avance}%` }} />
          </div>
          <p className="mt-2 text-center text-sm text-ink">
            <strong>{campana.enviados}</strong> enviados · <strong>{campana.pendientes}</strong> pendientes ·{' '}
            <strong className={campana.errores ? 'text-red-700' : undefined}>{campana.errores}</strong> con error ·{' '}
            <strong>{campana.omitidos}</strong> omitidos
          </p>
        </div>
      )}
    </div>
  )
}

/** Sub-paso numerado dentro de "Clientes": descargar, llenar y subir el Excel. */
function PasoExcel({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy/8 text-sm font-bold text-navy">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="mb-1.5 font-semibold text-navy">{titulo}</h3>
        {children}
      </div>
    </li>
  )
}

type FiltrosClientes = { estado: string }

/** Clientes del Excel: buscador, filtro por estado y paginación como las demás tablas. */
function TablaClientes({
  plantilla,
  destinatarios,
  seleccion,
  onSeleccion,
}: {
  plantilla: Plantilla
  destinatarios: Destinatarios
  seleccion: number | null
  onSeleccion: (fila: number) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosClientes>({ estado: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const texto = busqueda.toUpperCase()
  const filas = destinatarios.clientes.filter(
    (fila) =>
      (!filtros.estado || (filtros.estado === 'listo' ? !fila.problema : Boolean(fila.problema))) &&
      (!texto ||
        fila.nombre.toUpperCase().includes(texto) ||
        fila.telefono.includes(texto) ||
        fila.variables.some((valor) => valor.toUpperCase().includes(texto))),
  )
  const { rows, page: actual } = paginate(filas, page, pageSize)

  return (
    <div className="mt-6 min-w-0">
      <FilterPanel
        search={busqueda}
        onSearch={(valor) => {
          setBusqueda(valor)
          setPage(1)
        }}
        placeholder="Nombre, celular o dato"
        searchLabel="Buscar clientes"
        chips={filterChips(
          filtros,
          [{ key: 'estado', label: 'Estado', display: (valor) => (valor === 'listo' ? 'Listos' : 'Con problema') }],
          () => {
            setFiltros({ estado: '' })
            setPage(1)
          },
        )}
        onClearFilters={() => setFiltros({ estado: '' })}
        onClear={() => {
          setBusqueda('')
          setFiltros({ estado: '' })
        }}
      >
        <FilterField id="filtro-estado-cliente" label="Estado">
          <Select
            className="h-10"
            id="filtro-estado-cliente"
            value={filtros.estado}
            onChange={(event) => {
              setFiltros({ estado: event.target.value })
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            <option value="listo">Listos ({destinatarios.listos})</option>
            <option value="problema">Con problema ({destinatarios.conProblema})</option>
          </Select>
        </FilterField>
      </FilterPanel>

      <TableCard>
        {filas.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Ningún cliente coincide" icon={<Search />}>
              Prueba con otro nombre o dato, o quita el filtro.
            </EmptyState>
          </div>
        ) : (
          <>
            {/* Escritorio: una columna por dato del mensaje; la tabla se desplaza si son muchos. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className={theadClass}>
                  <tr>
                    <Th className="min-w-52 pl-4">Cliente</Th>
                    {plantilla.encabezadoConVariable && <Th>Enlace</Th>}
                    {plantilla.variables.map((variable, index) => (
                      <Th key={variable} className="min-w-20">
                        <span className="font-mono text-navy">{`{{${variable}}}`}</span>
                        {plantilla.ejemplos[index] && (
                          <span className="block max-w-32 truncate font-normal normal-case">
                            ej. {plantilla.ejemplos[index]}
                          </span>
                        )}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((fila) => {
                    const elegido = fila.fila === seleccion
                    return (
                      <tr
                        key={fila.fila}
                        onClick={() => onSeleccion(fila.fila)}
                        aria-selected={elegido}
                        className={cx(
                          'cursor-pointer transition-colors',
                          elegido ? 'bg-magenta/5' : 'hover:bg-surface/60',
                        )}
                      >
                        <td
                          className={cx('max-w-60 py-3 pr-3 pl-4', elegido && 'shadow-[inset_3px_0_0] shadow-magenta')}
                        >
                          <button
                            type="button"
                            onClick={() => onSeleccion(fila.fila)}
                            className="block max-w-full truncate text-left font-semibold text-ink hover:text-navy"
                          >
                            {fila.nombre || 'Sin nombre'}
                          </button>
                          <p
                            className={cx(
                              'text-xs tabular-nums',
                              fila.problema && !faltaDato(fila) ? 'font-semibold text-amber-700' : 'text-muted',
                            )}
                          >
                            {fila.telefono || 'Sin celular'}
                            <span className="text-muted"> · fila {fila.fila}</span>
                          </p>
                          <span className="mt-1.5 inline-flex" title={fila.problema ?? undefined}>
                            <Badge tone={fila.problema ? 'warning' : 'success'}>
                              {fila.problema ? problemaCorto(fila.problema) : 'Listo'}
                            </Badge>
                          </span>
                        </td>
                        {plantilla.encabezadoConVariable && (
                          <td className="px-3 py-3">
                            {fila.encabezado ? (
                              <a
                                href={fila.encabezado}
                                target="_blank"
                                rel="noreferrer"
                                title={fila.encabezado}
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex items-center gap-1 font-semibold text-navy underline-offset-2 hover:underline"
                              >
                                Ver
                                <ExternalLink className="size-3.5" aria-hidden />
                              </a>
                            ) : (
                              <Dato valor="" />
                            )}
                          </td>
                        )}
                        {plantilla.variables.map((variable, index) => (
                          <td key={variable} className="max-w-40 px-3 py-3">
                            <Dato valor={fila.variables[index]} />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas con el estado y los datos debajo del nombre. */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((fila) => {
                const elegido = fila.fila === seleccion
                return (
                  <li key={fila.fila}>
                    <button
                      type="button"
                      onClick={() => onSeleccion(fila.fila)}
                      className={cx(
                        'block w-full px-4 py-3.5 text-left',
                        elegido && 'bg-magenta/5 shadow-[inset_3px_0_0] shadow-magenta',
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 font-semibold text-ink">{fila.nombre || 'Sin nombre'}</span>
                        <Badge tone={fila.problema ? 'warning' : 'success'}>
                          {fila.problema ? problemaCorto(fila.problema) : 'Listo'}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted tabular-nums">{fila.telefono || 'Sin celular'}</span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {plantilla.variables.map((variable, index) => `{{${variable}}} ${fila.variables[index] || '—'}`).join(' · ')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <Pager
          page={actual}
          pageSize={pageSize}
          total={filas.length}
          noun={['cliente', 'clientes']}
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

/**
 * Vista previa del mensaje, aparte del asistente. Sin Excel muestra la plantilla con sus datos
 * de ejemplo; con Excel, el mensaje de cada cliente (se recorren con ‹ ›).
 */
function TarjetaVistaPrevia({
  plantilla,
  cliente,
  posicion,
  total,
  onAnterior,
  onSiguiente,
}: {
  plantilla: Plantilla | undefined
  cliente: ClienteMensaje | undefined
  posicion: number
  total: number
  onAnterior: () => void
  onSiguiente: () => void
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line" aria-label="Vista previa del mensaje">
      <header className="border-b border-line bg-surface/60 px-4 py-3">
        <h2 className="font-bold text-navy">Vista previa</h2>
        <p className="truncate text-xs text-muted">
          {!plantilla
            ? 'Así lo verá el cliente en WhatsApp.'
            : cliente
              ? `Mensaje de ${cliente.nombre || `la fila ${cliente.fila}`}`
              : 'Con los datos de ejemplo de la plantilla'}
        </p>
      </header>
      <div className="p-3">
        {plantilla ? (
          <Burbuja
            plantilla={plantilla}
            encabezado={cliente ? (cliente.encabezado ?? undefined) : undefined}
            variables={cliente ? cliente.variables : plantilla.ejemplos}
          />
        ) : (
          <div className="grid place-items-center rounded-lg bg-[#e7ddd3] px-6 py-16 text-center">
            <MessageCircle className="size-7 text-navy/40" aria-hidden />
            <p className="mt-2 text-sm text-navy/70">Elige una plantilla para ver el mensaje.</p>
          </div>
        )}
      </div>
      {cliente && total > 1 && (
        <footer className="flex items-center justify-between border-t border-line px-2 py-2 text-sm">
          <Button variant="ghost" onClick={onAnterior} aria-label="Cliente anterior" className="px-2.5">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="text-muted tabular-nums">
            Cliente <strong className="text-ink">{posicion}</strong> de {total}
          </span>
          <Button variant="ghost" onClick={onSiguiente} aria-label="Cliente siguiente" className="px-2.5">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </footer>
      )}
    </section>
  )
}

/** Burbuja de WhatsApp con las variables reemplazadas (o marcadas si faltan). */
function Burbuja({
  plantilla,
  encabezado,
  variables,
}: {
  plantilla: Plantilla
  encabezado?: string
  variables: string[]
}) {
  const partes = plantilla.cuerpo.split(/(\{\{\s*\w+\s*\}\})/g)
  return (
    <div className="rounded-lg bg-[#e7ddd3] p-3">
      <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-ink shadow-sm">
        {plantilla.encabezado && plantilla.encabezado !== 'TEXT' && (
          <div className="mb-2 rounded-md bg-surface-alt px-3 py-6 text-center text-xs text-muted">
            {etiquetaEncabezado[plantilla.encabezado]}
            {encabezado && <span className="mt-1 block truncate">{encabezado}</span>}
          </div>
        )}
        {plantilla.encabezado === 'TEXT' && (
          <p className="mb-1 font-bold">{plantilla.encabezadoConVariable && encabezado ? encabezado : plantilla.textoEncabezado}</p>
        )}
        <p className="whitespace-pre-wrap">
          {partes.map((parte, index) => {
            const match = /^\{\{\s*(\w+)\s*\}\}$/.exec(parte)
            if (!match) return <Fragment key={index}>{parte}</Fragment>
            const valor = variables[plantilla.variables.indexOf(match[1])]
            return (
              <mark
                key={index}
                className={cx('rounded px-0.5', valor ? 'bg-emerald-100 text-ink' : 'bg-amber-100 text-amber-900')}
              >
                {valor || parte}
              </mark>
            )
          })}
        </p>
        {plantilla.pie && <p className="mt-2 text-xs text-muted">{plantilla.pie}</p>}
      </div>
    </div>
  )
}

const estadoCampana: Record<Campana['estado'], { label: string; tone: 'info' | 'success' | 'neutral' }> = {
  EN_CURSO: { label: 'Enviando', tone: 'info' },
  COMPLETADA: { label: 'Terminado', tone: 'success' },
  CANCELADA: { label: 'Detenido', tone: 'neutral' },
}

/** Envíos de las últimas 24 horas, con su avance (se actualiza solo mientras alguno envía). */
function Campanas() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const lista = useQuery({
    queryKey: ['mensajes', 'campanas'],
    queryFn: listarCampanas,
    refetchInterval: (query) => (query.state.data?.items.some((item) => item.estado === 'EN_CURSO') ? 2000 : false),
  })
  const accion = useMutation({
    mutationFn: ({ id, tipo }: { id: string; tipo: 'cancelar' | 'reintentar' }) =>
      tipo === 'cancelar' ? cancelarCampana(id) : reintentarCampana(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mensajes', 'campanas'] }),
    onError: (error) => toast({ tone: 'error', message: error.message }),
  })

  const descargar = async (campana: Campana) => {
    try {
      await apiDownload(
        `/admin/mensajes/campanas/${campana.id}/excel`,
        undefined,
        `envios_${campana.plantilla}_${campana.creada.slice(0, 10)}.xlsx`,
      )
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'No se pudo descargar' })
    }
  }

  return (
    <section>
      <h2 className="mb-1 font-bold text-navy">Envíos recientes</h2>
      <p className="mb-3 text-sm text-muted">
        Se guardan 24 horas y se pierden si se reinicia el servidor: descarga el resultado si lo necesitas.
      </p>
      {lista.isPending ? (
        <Spinner />
      ) : lista.error ? (
        <ErrorNotice error={lista.error} />
      ) : !lista.data.items.length ? (
        <EmptyState title="Todavía no hay envíos" icon={<MessageCircle />} />
      ) : (
        <ul className="space-y-3">
          {lista.data.items.map((campana) => {
            const procesados = campana.total - campana.pendientes
            const avance = campana.total ? Math.round((procesados / campana.total) * 100) : 0
            const estado = estadoCampana[campana.estado]
            return (
              <li key={campana.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{campana.plantilla}</p>
                    <p className="text-xs text-muted">
                      {campana.archivo} · {campana.creadaPor} · {timeAgo(campana.creada)}
                    </p>
                  </div>
                  <Badge tone={estado.tone}>{estado.label}</Badge>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-surface-alt"
                  role="progressbar"
                  aria-valuenow={avance}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Avance de ${campana.plantilla}`}
                >
                  <div className="h-full rounded-full bg-magenta transition-[width] duration-500" style={{ width: `${avance}%` }} />
                </div>
                <p className="mt-2 text-sm text-ink">
                  <strong>{campana.enviados}</strong> enviados · <strong>{campana.pendientes}</strong> pendientes ·{' '}
                  <strong className={campana.errores ? 'text-red-700' : undefined}>{campana.errores}</strong> con error ·{' '}
                  <strong>{campana.omitidos}</strong> omitidos
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {campana.estado === 'EN_CURSO' && (
                    <Button
                      variant="danger"
                      loading={accion.isPending && accion.variables?.id === campana.id}
                      onClick={() => accion.mutate({ id: campana.id, tipo: 'cancelar' })}
                    >
                      <Ban className="size-4" aria-hidden />
                      Detener
                    </Button>
                  )}
                  {campana.estado !== 'EN_CURSO' && campana.errores > 0 && (
                    <Button
                      variant="secondary"
                      loading={accion.isPending && accion.variables?.id === campana.id}
                      onClick={() => accion.mutate({ id: campana.id, tipo: 'reintentar' })}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      Reintentar {campana.errores} con error
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => descargar(campana)}>
                    <Download className="size-4" aria-hidden />
                    Descargar resultado
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
