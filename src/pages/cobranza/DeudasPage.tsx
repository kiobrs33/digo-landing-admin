import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Check, CircleAlert, CircleCheck, FileSpreadsheet, FileText, Info, RotateCcw, Search } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { apiDownload } from '@/api/client'
import { type AnalisisDeudas, type CargaDeudas, descargaPath, procesarDeudas, type TipoCarga } from '@/api/cobranza'
import { FilterField, FilterPanel, Pager, SortHeader, Th, TableCard } from '@/components/DataTable'
import { Badge, Button, EmptyState, ErrorNotice, Field, Input, PageHeader, Select, Spinner } from '@/components/ui'
import { cx } from '@/lib/cx'
import { formatShortDate, formatSoles } from '@/lib/format'
import { filterChips, paginate, theadClass } from '@/lib/table'
import { useToast } from '@/lib/toast-context'
import { usePageTitle } from '@/lib/usePageTitle'
import { fechasDelCiclo, guardarCarga, type HistorialMes, leerHistorial, reemplazarHistorial } from './historial'
import { Asistente, BotonAtras } from './Asistente'
import { FileDrop, OpcionDescarga, Stats } from './parts'

const tiposCarga: { value: TipoCarga; titulo: string; ayuda: string }[] = [
  {
    value: 'REEMPLAZO',
    titulo: 'Reemplazar todo',
    ayuda: 'Borra las deudas cargadas en Telecrédito y deja solo las de este archivo. Para la primera carga del mes.',
  },
  {
    value: 'ACTUALIZACION',
    titulo: 'Agregar',
    ayuda: 'Suma estas deudas a las que ya están en Telecrédito. Para los ciclos siguientes.',
  },
]

const nombreTipo = (tipo: TipoCarga) => (tipo === 'REEMPLAZO' ? 'Reemplazar todo' : 'Agregar')
const opcionTelecredito = (tipo: TipoCarga) => (tipo === 'REEMPLAZO' ? 'Reemplazo' : 'Actualización → Agregar')

/** Lo que conviene proponer para un ciclo según lo ya cargado este mes. */
function tipoSugerido(dia: number, historial: HistorialMes): TipoCarga {
  const previa = historial[dia]
  if (previa) return previa.tipo
  return Object.keys(historial).length ? 'ACTUALIZACION' : 'REEMPLAZO'
}

export function DeudasPage() {
  usePageTitle('Deudas por cliente')
  const toast = useToast()
  const [paso, setPasoActual] = useState(0)
  // Paso más lejano visitado: la barra marca como hechos solo los pasos por los que se pasó.
  const [visto, setVisto] = useState(0)
  const setPaso = (siguiente: number) => {
    setPasoActual(siguiente)
    setVisto((anterior) => Math.max(anterior, siguiente))
  }
  const [files, setFiles] = useState<File[]>([])
  const [ciclo, setCiclo] = useState<number | null>(null)
  const [tipoCarga, setTipoCarga] = useState<TipoCarga>('REEMPLAZO')
  const [dias, setDias] = useState('10')
  const [incluirSinDeuda, setIncluirSinDeuda] = useState(false)
  const [historial, setHistorial] = useState<HistorialMes>(() => leerHistorial())
  const [descargando, setDescargando] = useState<'txt' | 'excel' | null>(null)

  const diasNumero = Number(dias)
  const diasValido = dias.trim() !== '' && Number.isInteger(diasNumero) && diasNumero >= 0 && diasNumero <= 90
  const opciones = { diasVencimiento: diasValido ? diasNumero : 10, incluirSinDeuda, tipoCarga }

  /** Primer ciclo con deuda que aún no se cargó este mes (o el primero con deuda). */
  const siguienteCiclo = (data: AnalisisDeudas, cargas: HistorialMes) => {
    const conDeuda = data.ciclos.filter((item) => item.conDeuda > 0)
    return (conDeuda.find((item) => !cargas[item.dia]) ?? conDeuda[0])?.dia ?? null
  }
  const elegirCiclo = (dia: number | null, cargas = historial) => {
    setCiclo(dia)
    if (dia !== null) setTipoCarga(tipoSugerido(dia, cargas))
    generar.reset()
  }

  // Al subir el Excel se analiza: qué ciclos trae y cuánto deben.
  const analizar = useMutation({
    mutationFn: (file: File) => procesarDeudas(file, opciones),
    onSuccess: (data) => elegirCiclo(siguienteCiclo(data, historial)),
  })
  const generar = useMutation({
    mutationFn: () => procesarDeudas(files[0], { ...opciones, ciclo: ciclo ?? undefined }),
    onSuccess: () => setPaso(3),
  })
  const analisis: AnalisisDeudas | undefined = generar.data ?? analizar.data
  const carga = generar.data?.carga

  const cambiarArchivo = (next: File[]) => {
    setFiles(next)
    setVisto(0)
    setCiclo(null)
    analizar.reset()
    generar.reset()
    if (next[0]) analizar.mutate(next[0])
  }

  const descargar = async (tipo: 'txt' | 'excel') => {
    if (!carga) return
    setDescargando(tipo)
    const accion = carga.tipoCarga === 'REEMPLAZO' ? 'reemplazo' : 'agregar'
    try {
      await apiDownload(
        descargaPath(carga.descargas[tipo]),
        undefined,
        `CREP_ciclo-${carga.ciclo}_${accion}.${tipo === 'txt' ? 'txt' : 'xlsx'}`,
      )
      // Con cualquiera de los dos archivos el ciclo queda listo para subir. Un reemplazo deja en
      // Telecrédito solo este ciclo: el historial del mes empieza de nuevo.
      setHistorial(
        carga.tipoCarga === 'REEMPLAZO'
          ? reemplazarHistorial(carga.ciclo, carga.tipoCarga)
          : guardarCarga(carga.ciclo, carga.tipoCarga),
      )
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'No se pudo descargar' })
    } finally {
      setDescargando(null)
    }
  }

  /** "Cargar otro ciclo": vuelve a elegir ciclo con el mismo Excel, proponiendo el siguiente. */
  const otroCiclo = () => {
    if (analisis) elegirCiclo(siguienteCiclo(analisis, historial))
    setPaso(1)
  }

  const cicloElegido = analisis?.ciclos.find((item) => item.dia === ciclo)
  const cargadosOtros = Object.keys(historial)
    .map(Number)
    .filter((dia) => dia !== ciclo)
    .sort((a, b) => a - b)
  const fechas = ciclo !== null && diasValido ? fechasDelCiclo(ciclo, diasNumero) : null
  const excluidos = Object.entries(analisis?.excluidosPorEstado ?? {})
  const totalClientes = analisis?.ciclos.reduce((suma, item) => suma + item.clientes, 0) ?? 0

  // Hasta dónde se puede ir: lo visitado, mientras lo anterior siga listo.
  const listo = !analisis ? 0 : ciclo === null ? 1 : carga ? 3 : 2
  const alcanzado = Math.min(visto, listo)
  const pasos = [
    { titulo: 'Lista de clientes', resumen: analisis && files[0] ? files[0].name : undefined },
    {
      titulo: 'Ciclo',
      resumen: cicloElegido ? `Día ${cicloElegido.dia} · ${cicloElegido.conDeuda} con deuda` : undefined,
    },
    { titulo: 'Tipo de carga', resumen: ciclo !== null && fechas ? `${nombreTipo(tipoCarga)} · vence ${fechas.vence}` : undefined },
    { titulo: 'Descargar', resumen: carga ? `${carga.total} deudas · ${formatSoles(carga.montoTotal)}` : undefined },
  ]

  const contenido = [
    // 1. Lista de clientes
    <>
      <p className="mb-5 text-sm text-muted">
        Descarga de Mikrowisp la lista de clientes <strong className="text-ink">completa, sin filtrar</strong>: el ciclo
        lo eliges en el paso siguiente. Solo entran los clientes ACTIVO y SUSPENDIDO.
      </p>
      <FileDrop
        accept=".xlsx"
        files={files}
        onChange={cambiarArchivo}
        title="Lista de Usuarios (.xlsx)"
        hint="Tal como la exporta Mikrowisp."
      />
      {analizar.isPending && <Spinner label="Leyendo el Excel…" />}
      {analizar.error && (
        <div className="mt-4">
          <ErrorNotice error={analizar.error} />
        </div>
      )}
      {analisis && !analizar.isPending && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>{totalClientes} clientes</strong> activos o suspendidos en{' '}
            <strong>
              {analisis.ciclos.length} ciclo{analisis.ciclos.length === 1 ? '' : 's'}
            </strong>
            {excluidos.length > 0 && ` · no entran: ${excluidos.map(([estado, n]) => `${n} ${estado}`).join(', ')}`}.
          </span>
        </p>
      )}
    </>,

    // 2. Ciclo
    <>
      <p className="mb-5 text-sm text-muted">
        Cada ciclo es un día de pago. Las deudas son de <strong className="text-ink">{analisis?.mes}</strong>.
      </p>
      <fieldset>
        <legend className="sr-only">Ciclo (día de pago)</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {analisis?.ciclos.map((item) => {
            const previa = historial[item.dia]
            const sinDeuda = item.conDeuda === 0
            return (
              <label
                key={item.dia}
                className={cx(
                  'relative flex flex-col rounded-xl px-4 py-4 ring-1 transition-colors',
                  sinDeuda ? 'cursor-not-allowed bg-surface/60 ring-line' : 'cursor-pointer',
                  !sinDeuda &&
                    (ciclo === item.dia ? 'bg-magenta/5 ring-2 ring-magenta' : 'bg-white ring-line hover:bg-surface'),
                )}
              >
                <input
                  type="radio"
                  name="ciclo"
                  className="absolute top-4 right-4 size-4"
                  checked={ciclo === item.dia}
                  disabled={sinDeuda}
                  onChange={() => elegirCiclo(item.dia)}
                />
                <span className="text-xs font-medium text-muted">Día de pago</span>
                <span className="text-2xl font-extrabold tracking-tight text-navy">{item.dia}</span>
                <span className="mt-2 text-sm text-ink">
                  {sinDeuda ? 'Nadie debe' : `${item.conDeuda} con deuda`}
                </span>
                {!sinDeuda && <span className="text-sm font-semibold text-ink">{formatSoles(item.monto)}</span>}
                {previa && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Check className="size-3.5" aria-hidden />
                    Descargado el {formatShortDate(previa.fecha)}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </fieldset>
    </>,

    // 3. Tipo de carga
    <>
      <p className="mb-5 text-sm text-muted">
        Cómo subirás el TXT del <strong className="text-ink">día {ciclo}</strong> en Telecrédito → Recaudación.
      </p>
      <fieldset>
        <legend className="sr-only">Tipo de carga en Telecrédito</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {tiposCarga.map((tipo) => (
            <label
              key={tipo.value}
              className={cx(
                'flex cursor-pointer items-start gap-3 rounded-xl px-4 py-4 ring-1 transition-colors',
                tipoCarga === tipo.value ? 'bg-magenta/5 ring-2 ring-magenta' : 'bg-white ring-line hover:bg-surface',
              )}
            >
              <input
                type="radio"
                name="tipoCarga"
                className="mt-1 size-4"
                checked={tipoCarga === tipo.value}
                onChange={() => {
                  setTipoCarga(tipo.value)
                  generar.reset()
                }}
              />
              <span className="text-sm">
                <span className="block font-semibold text-navy">{tipo.titulo}</span>
                <span className="text-muted">{tipo.ayuda}</span>
              </span>
            </label>
          ))}
        </div>
        {tipoCarga === 'REEMPLAZO' && cargadosOtros.length > 0 && (
          <Aviso tono="peligro">
            Este mes ya descargaste el archivo {cargadosOtros.length === 1 ? 'del día' : 'de los días'}{' '}
            {cargadosOtros.join(', ')}. Si lo subiste a Telecrédito, <strong>reemplazar borra esas deudas</strong> y esos
            clientes ya no podrán pagar por el BCP. Para sumar este ciclo, elige <strong>Agregar</strong>.
          </Aviso>
        )}
        {tipoCarga === 'ACTUALIZACION' && Object.keys(historial).length === 0 && (
          <Aviso tono="info">
            No hay cargas de este mes registradas en este navegador. Si es la primera del mes, usa{' '}
            <strong>Reemplazar todo</strong> para quitar las deudas del mes anterior.
          </Aviso>
        )}
      </fieldset>

      <div className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="w-60">
          <Field
            label="Días para el vencimiento"
            hint={fechas ? `Emisión ${fechas.emision} · vence ${fechas.vence}` : 'Desde el día de pago.'}
            error={diasValido ? undefined : 'Escribe un número de 0 a 90.'}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                value={dias}
                onChange={(event) => {
                  setDias(event.target.value)
                  generar.reset()
                }}
              />
            )}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm sm:pt-8">
          <input
            type="checkbox"
            className="size-4"
            checked={incluirSinDeuda}
            onChange={(event) => {
              setIncluirSinDeuda(event.target.checked)
              generar.reset()
            }}
          />
          Incluir clientes sin deuda (S/ 0)
        </label>
      </div>
      {generar.error && (
        <div className="mt-4">
          <ErrorNotice error={generar.error} />
        </div>
      )}
    </>,

    // 4. Descargar
    carga ? (
      <>
        <p className="mb-5 text-sm text-muted">
          Archivo del <strong className="text-ink">día {carga.ciclo}</strong> para cargar con{' '}
          <strong className="text-ink">{nombreTipo(carga.tipoCarga)}</strong>.
        </p>
        <Resultado carga={carga} incluirSinDeuda={incluirSinDeuda} descargando={descargando} onDescargar={descargar} />
      </>
    ) : null,
  ]

  const pie = [
    <>
      <span />
      <Button disabled={!analisis || analizar.isPending} onClick={() => setPaso(1)}>
        Continuar
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(0)} />
      <Button disabled={ciclo === null} onClick={() => setPaso(2)}>
        Continuar
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(1)} />
      <Button disabled={ciclo === null || !diasValido} loading={generar.isPending} onClick={() => generar.mutate()}>
        Generar archivo del día {ciclo}
      </Button>
    </>,
    <>
      <BotonAtras onClick={() => setPaso(2)}>Cambiar opciones</BotonAtras>
      <Button variant="secondary" onClick={otroCiclo}>
        <RotateCcw className="size-4" aria-hidden />
        Cargar otro ciclo
      </Button>
    </>,
  ]

  return (
    <>
      <PageHeader
        title="Deudas por cliente"
        description="Genera el archivo de cobranza de Telecrédito (BCP) desde la lista de clientes de Mikrowisp, ciclo por ciclo."
      />
      <Asistente pasos={pasos} actual={paso} alcanzado={alcanzado} onIr={setPaso} pie={pie[paso]}>
        {contenido[paso]}
      </Asistente>
    </>
  )
}

function Aviso({ tono, children }: { tono: 'peligro' | 'info'; children: ReactNode }) {
  const Icon = tono === 'peligro' ? CircleAlert : Info
  return (
    <p
      role={tono === 'peligro' ? 'alert' : undefined}
      className={cx(
        'mt-3 flex gap-2.5 rounded-lg px-4 py-3 text-sm ring-1',
        tono === 'peligro' ? 'bg-red-50 text-red-900 ring-red-200' : 'bg-blue-50 text-blue-900 ring-blue-200',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}


function Resultado({
  carga,
  incluirSinDeuda,
  descargando,
  onDescargar,
}: {
  carga: CargaDeudas
  incluirSinDeuda: boolean
  descargando: 'txt' | 'excel' | null
  onDescargar: (tipo: 'txt' | 'excel') => void
}) {
  return (
    <>
      <Stats
        items={[
          { label: 'Deudas', value: carga.total },
          { label: 'Monto total', value: formatSoles(carga.montoTotal) },
          { label: 'Suspendidos', value: carga.suspendidos },
          { label: 'Con varios recibos', value: carga.conVariosRecibos },
        ]}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <OpcionDescarga
          titulo="Con el macro del BCP"
          etiqueta="Recomendado"
          boton={
            <Button className="w-full" onClick={() => onDescargar('excel')} loading={descargando === 'excel'}>
              <FileSpreadsheet className="size-4" aria-hidden />
              Descargar Excel para el macro
            </Button>
          }
          nota="El macro vuelve a validar los datos antes de generar el TXT."
        >
          <li>
            Abre el macro, hoja <strong>Generar Archivo de Cobranza</strong>.
          </li>
          <li>
            En <strong>Tipo de Archivo</strong>, elige{' '}
            <strong>{carga.tipoCarga === 'REEMPLAZO' ? 'Archivo de Reemplazo' : 'Archivo de Actualización'}</strong>. Total
            de Registros y Monto Total se calculan solos.
          </li>
          <li>
            Pega las columnas <strong>A a K</strong> del Excel (sin el encabezado) desde la <strong>fila 11</strong>.
          </li>
          <li>Valida y genera el TXT con el macro.</li>
          <li>
            En Telecrédito → <strong>Recaudación</strong>, elige <strong>{opcionTelecredito(carga.tipoCarga)}</strong> y
            sube ese TXT.
          </li>
        </OpcionDescarga>

        <OpcionDescarga
          titulo="TXT directo"
          boton={
            <Button variant="secondary" className="w-full" onClick={() => onDescargar('txt')} loading={descargando === 'txt'}>
              <FileText className="size-4" aria-hidden />
              Descargar TXT para Telecrédito
            </Button>
          }
          nota="Mismo formato que genera el macro: te ahorra pegar y validar."
        >
          <li>
            En Telecrédito, entra a <strong>Recaudación</strong>.
          </li>
          <li>
            Elige <strong>{opcionTelecredito(carga.tipoCarga)}</strong>.
          </li>
          <li>
            Sube el TXT del <strong>día {carga.ciclo}</strong> ({carga.total} deudas, {formatSoles(carga.montoTotal)}).
          </li>
        </OpcionDescarga>
      </div>
      <p className="mt-3 text-xs text-muted">
        Los archivos quedan disponibles 30 minutos.
        {!incluirSinDeuda && carga.sinDeuda > 0 && ` ${carga.sinDeuda} clientes del ciclo no deben nada y no se cargan.`}
      </p>

      {carga.omitidos.length > 0 && (
        <details className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <summary className="cursor-pointer font-semibold">
            {carga.omitidos.length} fila{carga.omitidos.length === 1 ? '' : 's'} no entraron: corrígelas en Mikrowisp
          </summary>
          <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {carga.omitidos.map((omitido) => (
              <li key={`${omitido.fila}-${omitido.motivo}`}>
                Fila {omitido.fila}: {omitido.nombre || 'Sin nombre'} — {omitido.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}

      <TablaCarga carga={carga} />
    </>
  )
}

const ordenes: Record<string, (a: FilaCarga, b: FilaCarga) => number> = {
  'monto:desc': (a, b) => b.monto_pagar - a.monto_pagar,
  'monto:asc': (a, b) => a.monto_pagar - b.monto_pagar,
  'nombre:asc': (a, b) => a.nombre_depositante.localeCompare(b.nombre_depositante),
  'nombre:desc': (a, b) => b.nombre_depositante.localeCompare(a.nombre_depositante),
  'recibos:desc': (a, b) => b.recibos - a.recibos || b.monto_pagar - a.monto_pagar,
  'documento:asc': (a, b) => a.nro_documento_pago.localeCompare(b.nro_documento_pago),
}

type FilaCarga = CargaDeudas['registros'][number]
type FiltrosCarga = { estado: string; recibos: string; desde: string; hasta: string }
const SIN_FILTROS: FiltrosCarga = { estado: '', recibos: '', desde: '', hasta: '' }

/** Deudas de la carga con el buscador, los filtros, el orden y la paginación de las demás tablas. */
function TablaCarga({ carga }: { carga: CargaDeudas }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosCarga>(SIN_FILTROS)
  const [orden, setOrden] = useState('monto:desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const cambiar = (cambio: Partial<FiltrosCarga>) => {
    setFiltros((actual) => ({ ...actual, ...cambio }))
    setPage(1)
  }
  const texto = busqueda.toUpperCase()
  const desde = filtros.desde ? Number(filtros.desde) : null
  const hasta = filtros.hasta ? Number(filtros.hasta) : null
  const filas = carga.registros
    .filter(
      (fila) =>
        (!filtros.estado || fila.estado === filtros.estado) &&
        (!filtros.recibos || (filtros.recibos === 'varios' ? fila.recibos > 1 : fila.recibos <= 1)) &&
        (desde === null || fila.monto_pagar >= desde) &&
        (hasta === null || fila.monto_pagar <= hasta) &&
        (!texto ||
          fila.nombre_depositante.includes(texto) ||
          fila.nro_documento_identidad.includes(texto) ||
          fila.nro_documento_pago.includes(texto)),
    )
    .sort(ordenes[orden])
  const { rows, page: actual } = paginate(filas, page, pageSize)
  const onSort = (valor: string) => {
    setOrden(valor)
    setPage(1)
  }
  const suspendidos = carga.registros.filter((fila) => fila.estado === 'SUSPENDIDO').length

  return (
    <div className="mt-8">
      <h3 className="mb-3 font-bold text-navy">Deudas de la carga</h3>
      <FilterPanel
        search={busqueda}
        onSearch={(valor) => {
          setBusqueda(valor)
          setPage(1)
        }}
        placeholder="Nombre, DNI o doc. de pago"
        searchLabel="Buscar en la carga"
        chips={filterChips(
          filtros,
          [
            { key: 'estado', label: 'Estado', display: (valor) => (valor === 'SUSPENDIDO' ? 'Suspendido' : 'Activo') },
            { key: 'recibos', label: 'Recibos', display: (valor) => (valor === 'varios' ? '2 o más' : '1') },
            { key: 'desde', label: 'Desde', display: (valor) => formatSoles(Number(valor)) },
            { key: 'hasta', label: 'Hasta', display: (valor) => formatSoles(Number(valor)) },
          ],
          (key) => cambiar({ [key]: '' }),
        )}
        onClearFilters={() => cambiar(SIN_FILTROS)}
        onClear={() => {
          setBusqueda('')
          cambiar(SIN_FILTROS)
        }}
      >
        <FilterField id="filtro-estado" label="Estado del cliente">
          <Select className="h-10" id="filtro-estado" value={filtros.estado} onChange={(event) => cambiar({ estado: event.target.value })}>
            <option value="">Todos</option>
            <option value="ACTIVO">Activo ({carga.total - suspendidos})</option>
            <option value="SUSPENDIDO">Suspendido ({suspendidos})</option>
          </Select>
        </FilterField>
        <FilterField id="filtro-recibos" label="Recibos pendientes">
          <Select className="h-10" id="filtro-recibos" value={filtros.recibos} onChange={(event) => cambiar({ recibos: event.target.value })}>
            <option value="">Todos</option>
            <option value="uno">1 recibo ({carga.total - carga.conVariosRecibos})</option>
            <option value="varios">2 o más ({carga.conVariosRecibos})</option>
          </Select>
        </FilterField>
        <FilterField id="filtro-desde" label="Monto desde (S/)">
          <Input
            className="h-10"
            id="filtro-desde"
            type="number"
            inputMode="decimal"
            min={0}
            value={filtros.desde}
            onChange={(event) => cambiar({ desde: event.target.value })}
          />
        </FilterField>
        <FilterField id="filtro-hasta" label="Hasta (S/)">
          <Input
            className="h-10"
            id="filtro-hasta"
            type="number"
            inputMode="decimal"
            min={0}
            value={filtros.hasta}
            onChange={(event) => cambiar({ hasta: event.target.value })}
          />
        </FilterField>
      </FilterPanel>

      <TableCard>
        {filas.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Ningún cliente coincide" icon={<Search />}>
              Prueba con otro nombre o documento, o quita algún filtro.
            </EmptyState>
          </div>
        ) : (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className={theadClass}>
                <tr>
                  <SortHeader label="Cliente" options={['nombre:asc', 'nombre:desc']} sort={orden} onSort={onSort} className="pl-4" />
                  <Th>Estado</Th>
                  <SortHeader label="Recibos" options={['recibos:desc']} hint="más recibos primero" sort={orden} onSort={onSort} />
                  <Th>Vence</Th>
                  <SortHeader label="Doc. de pago" options={['documento:asc']} hint="orden del archivo" sort={orden} onSort={onSort} />
                  <SortHeader
                    label="Monto"
                    options={['monto:desc', 'monto:asc']}
                    sort={orden}
                    onSort={onSort}
                    className="pr-4 text-right [&>button]:ml-auto [&>button]:flex"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((fila) => (
                  <tr key={fila.nro_documento_pago} className="transition-colors hover:bg-surface/60">
                    <td className="max-w-80 py-3 pr-3 pl-4">
                      <p className="truncate font-semibold text-ink" title={fila.nombre_depositante}>
                        {fila.nombre_depositante}
                      </p>
                      <p className="text-xs text-muted tabular-nums">{fila.nro_documento_identidad}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={fila.estado === 'SUSPENDIDO' ? 'warning' : 'success'}>
                        {fila.estado === 'SUSPENDIDO' ? 'Suspendido' : 'Activo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {fila.recibos > 1 ? (
                        <span className="font-semibold text-navy">{fila.recibos} recibos</span>
                      ) : (
                        <span className="text-muted">{fila.recibos || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">{fila.fecha_vencimiento}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{fila.nro_documento_pago}</td>
                    <td className="py-3 pr-4 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatSoles(fila.monto_pagar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Móvil: tarjetas con lo esencial. */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((fila) => (
                <li key={fila.nro_documento_pago} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold text-ink">{fila.nombre_depositante}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{formatSoles(fila.monto_pagar)}</p>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="tabular-nums">{fila.nro_documento_identidad}</span>
                    {fila.estado === 'SUSPENDIDO' && <Badge tone="warning">Suspendido</Badge>}
                    {fila.recibos > 1 && <span className="font-semibold text-navy">{fila.recibos} recibos</span>}
                    <span>· {fila.nro_documento_pago}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pager
          page={actual}
          pageSize={pageSize}
          total={filas.length}
          noun={['deuda', 'deudas']}
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
