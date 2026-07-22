import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Filter, Pencil, Printer, Trash2, Download } from 'lucide-react'
import { useLotes } from './hooks/useLotes'
import { LoteForm } from './LoteForm'
import { printLoteTicket } from './printLoteTicket'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { LoadingPage } from '@/components/shared/Spinner'
import { EstadoLoteBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CALIDAD_PRODUCTO_CONFIG, ESTADO_LOTE_CONFIG, TIPO_PRODUCCION_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { formatFecha, formatPeso } from '@/utils/formatters'
import { calcularPesoPorJaba } from '@/utils/business-rules'
import { getClasificacionesPorLotes, getClasificacionesResumen } from '@/services/clasificaciones.service'
import { generateLotesSeleccionadosExcel, type LotesSeleccionadosExportRow } from '../../utils/lotes-seleccionados-excel'
import { generateLotesIngresadosExcel, type LotesIngresadosExportRow } from '../../utils/lotes-ingresados-excel'
import type { LoteFormData } from '@/utils/validators'
import type { Clasificacion, EstadoLote, Lote, VariedadProducto } from '@/types/models'
import { useAuthStore } from '@/store/auth.store'
import { APP_PERMISSIONS, canEditLote, hasPermission } from '@/lib/permissions'
import { APP_ROLES } from '@/types/auth'

const roundTo2 = (value: number) => Math.round(value * 100) / 100

export default function LotesPage() {
  const { lotes, loading, error, reload, crear, actualizar, eliminar } = useLotes()
  const navigate = useNavigate()
  const roles = useAuthStore((state) => state.roles)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoLote | 'todos'>('todos')
  const [filtroVariedad, setFiltroVariedad] = useState<VariedadProducto | 'todos'>('todos')
  const [filtroFechaIngreso, setFiltroFechaIngreso] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [ticketLote, setTicketLote] = useState<Lote | null>(null)
  const [loteAEditar, setLoteAEditar] = useState<Lote | null>(null)
  const [loteAEliminar, setLoteAEliminar] = useState<Lote | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminacion, setErrorEliminacion] = useState<string | null>(null)
  const [editDialogError, setEditDialogError] = useState<string | null>(null)
  const [descargandoSeleccionados, setDescargandoSeleccionados] = useState(false)
  const [descargandoIngresados, setDescargandoIngresados] = useState(false)
  const [mermaPorLote, setMermaPorLote] = useState<Record<string, number>>({})
  const [cargandoMermas, setCargandoMermas] = useState(true)
  const canCreateLotes = hasPermission(roles, APP_PERMISSIONS.LOTES_CREATE)
  const canDeleteLotes = hasPermission(roles, APP_PERMISSIONS.LOTES_DELETE)
  const canPrintLoteTicket = hasPermission(roles, APP_PERMISSIONS.LOTES_PRINT_TICKET)
  const canExportSelectedLotes =
    roles.includes(APP_ROLES.ADMIN) ||
    roles.includes(APP_ROLES.GERENCIA) ||
    roles.includes(APP_ROLES.ADMINISTRADOR_PLANTA) ||
    roles.includes(APP_ROLES.OPERATIVO_PLANTA_DESPACHO) ||
    roles.includes(APP_ROLES.PADRON_AGRICULTORES)
  const hasFiltrosActivos = busqueda.trim() !== '' || filtroEstado !== 'todos' || filtroVariedad !== 'todos' || filtroFechaIngreso !== ''
  // El flujo de estados es lineal (ingresado → clasificado → empaquetado → ...),
  // por lo que todo lote que no esté en 'ingresado' ya fue clasificado y debe
  // seguir apareciendo en el export de clasificados aunque avance de estado.
  const lotesClasificados = lotes.filter((l) => l.estado !== 'ingresado')
  // Todo lote del sistema fue ingresado/recepcionado en origen,
  // por lo que este export incluye todos los estados actuales.
  const lotesIngresados = lotes

  const getAcopiadorLabel = (lote: Lote) => {
    if (lote.acopiador) return `${lote.acopiador.apellido}, ${lote.acopiador.nombre}`
    if (lote.acopiador_agricultor) return `${lote.acopiador_agricultor.apellido}, ${lote.acopiador_agricultor.nombre}`
    return '-'
  }

  const filtrados = lotes.filter((l) => {
    const coincideBusqueda = `${l.codigo} ${l.codigo_lote_agricultor ?? ''} ${l.sublote ?? ''} ${l.agricultor?.nombre ?? ''} ${l.agricultor?.apellido ?? ''} ${l.acopiador?.nombre ?? ''} ${l.acopiador?.apellido ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === 'todos' || l.estado === filtroEstado
    const coincideVariedad = filtroVariedad === 'todos' || l.producto?.variedad === filtroVariedad
    const coincideFechaIngreso = !filtroFechaIngreso || l.fecha_ingreso === filtroFechaIngreso
    return coincideBusqueda && coincideEstado && coincideVariedad && coincideFechaIngreso
  })

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicio = (paginaSegura - 1) * tamanoPagina
  const fin = inicio + tamanoPagina
  const paginados = filtrados.slice(inicio, fin)

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas)
    }
  }, [paginaActual, totalPaginas])

  useEffect(() => {
    let cancelled = false

    const cargarMermas = async () => {
      const lotesConClasificacion = lotes.filter((l) => l.estado !== 'ingresado')
      if (lotesConClasificacion.length === 0) {
        if (!cancelled) {
          setMermaPorLote({})
          setCargandoMermas(false)
        }
        return
      }

      if (!cancelled) setCargandoMermas(true)

      try {
        // Una sola consulta paginada en vez de N peticiones por lote: evita que
        // un único fallo (Promise.all) vacíe todo el mapa de mermas.
        const resumenRows = await getClasificacionesResumen()
        if (cancelled) return

        const netoDescartablePorLote = resumenRows.reduce<Record<string, number>>((acc, row) => {
          if (!row.lote_id) return acc
          const totalNetoDescartable = (row.aportes ?? []).reduce(
            (sum, aporte) => sum + Number(aporte.kg_neto_descartable ?? 0),
            0
          )
          acc[row.lote_id] = (acc[row.lote_id] ?? 0) + Number(row.peso_bueno_kg ?? 0) + totalNetoDescartable
          return acc
        }, {})

        setMermaPorLote(
          lotesConClasificacion.reduce<Record<string, number>>((acc, lote) => {
            const totalProcesado = netoDescartablePorLote[lote.id] ?? 0
            acc[lote.id] = roundTo2(Number(lote.peso_neto_kg ?? 0) - totalProcesado)
            return acc
          }, {})
        )
      } catch {
        if (!cancelled) {
          setMermaPorLote({})
        }
      } finally {
        if (!cancelled) setCargandoMermas(false)
      }
    }

    void cargarMermas()

    return () => {
      cancelled = true
    }
  }, [lotes])

  const handleDescargarLotesSeleccionados = async () => {
    if (!canExportSelectedLotes) return

    const lotesSeleccionados = lotesClasificados
    if (lotesSeleccionados.length === 0) {
      window.alert('No hay lotes clasificados para descargar.')
      return
    }

    setDescargandoSeleccionados(true)

    try {
      const sesiones = await getClasificacionesPorLotes(lotesSeleccionados.map((lote) => lote.id))

      // Solo hay una sesión por lote (onConflict lote_id); al venir ordenadas por
      // created_at asc, la última en insertarse en el mapa es la más reciente.
      const mapaClasificacion = new Map<string, Clasificacion>()
      for (const sesion of sesiones) {
        mapaClasificacion.set(sesion.lote_id, sesion)
      }

      const rows: LotesSeleccionadosExportRow[] = lotesSeleccionados.map((lote) => {
        const clasificacion = mapaClasificacion.get(lote.id)
        const aportes = clasificacion?.aportes ?? []

        const jabasSeleccionadas = aportes.reduce((acc, item) => acc + Number(item.num_jabas ?? 0), 0)
        const pesoBrutoSeleccion = aportes.reduce((acc, item) => acc + Number(item.kg_bruto ?? 0), 0)
        const pesoExportableSeleccion = Number(clasificacion?.peso_bueno_kg ?? 0)
        const jabasDescarte = aportes.reduce((acc, item) => acc + Number(item.jabas_descartadas ?? 0), 0)
        const pesoBrutoDescarte = aportes.reduce((acc, item) => acc + Number(item.kg_bruto_descartable ?? 0), 0)
        const pesoNetoDescarte = aportes.reduce((acc, item) => acc + Number(item.kg_neto_descartable ?? 0), 0)

        const pesoNetoRecepcion = Number(lote.peso_neto_kg ?? 0)
        const porcentajeExportable = pesoNetoRecepcion > 0 ? pesoExportableSeleccion / pesoNetoRecepcion : 0
        const porcentajeDescarte = pesoNetoRecepcion > 0 ? pesoNetoDescarte / pesoNetoRecepcion : 0
        const porcentajeMerma = 1 - (porcentajeExportable + porcentajeDescarte)

        return {
          codigoAgricultor: lote.codigo_lote_agricultor ?? lote.codigo,
          sublote: lote.sublote ?? '-',
          agricultor: lote.agricultor ? `${lote.agricultor.apellido}, ${lote.agricultor.nombre}` : '-',
          dni: lote.agricultor?.dni ?? '-',
          lugarProduccion: lote.agricultor?.ubicacion ?? '-',
          numeroCuenta: lote.agricultor?.numero_cuenta ?? '-',
          fechaRecepcion: lote.fecha_ingreso,
          variedad: lote.producto ? VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label : '-',
          jabasIngresadas: Number(lote.num_cubetas ?? 0),
          pesoBrutoRecepcion: Number(lote.peso_bruto_kg ?? 0),
          pesoNetoRecepcion,
          fechaSeleccion: clasificacion?.fecha_clasificacion ?? null,
          jabasSeleccionadas,
          pesoBrutoSeleccion,
          pesoExportableSeleccion,
          jabasDescarte,
          pesoBrutoDescarte,
          pesoNetoDescarte,
          porcentajeExportable,
          porcentajeDescarte,
          porcentajeMerma,
        }
      })

      generateLotesSeleccionadosExcel(rows)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setDescargandoSeleccionados(false)
    }
  }

  const handleDescargarLotesIngresados = async () => {
    if (!canExportSelectedLotes) return

    if (lotesIngresados.length === 0) {
      window.alert('No hay lotes registrados para descargar.')
      return
    }

    setDescargandoIngresados(true)
    try {
      const rows: LotesIngresadosExportRow[] = lotesIngresados.map((lote) => ({
        codigo: lote.codigo_lote_agricultor ?? lote.codigo,
        agricultor: lote.agricultor ? `${lote.agricultor.apellido}, ${lote.agricultor.nombre}` : '-',
        dni: lote.agricultor?.dni ?? '-',
        lugarProduccion: lote.agricultor?.ubicacion ?? '-',
        numeroCuenta: lote.agricultor?.numero_cuenta ?? '-',
        fechaCosecha: lote.fecha_cosecha,
        fechaRecepcion: lote.fecha_ingreso,
        variedad: lote.producto ? VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label : '-',
        jabasIngresadas: Number(lote.num_cubetas ?? 0),
        kgBrutos: Number(lote.peso_bruto_kg ?? 0),
        kgNetos: Number(lote.peso_neto_kg ?? 0),
      }))

      generateLotesIngresadosExcel(rows)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setDescargandoIngresados(false)
    }
  }

  const handleSubmit = async (data: LoteFormData) => {
    try {
      const nuevo = await crear(data)
      setDialogError(null)
      setDialogOpen(false)
      setTicketLote(nuevo)
    } catch (e) {
      setDialogError((e as Error).message)
    }
  }

  const handleEliminar = async () => {
    if (!canDeleteLotes || !loteAEliminar) return
    setEliminando(true)
    try {
      await eliminar(loteAEliminar.id)
      setLoteAEliminar(null)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.startsWith('DESPACHO_ASOCIADO::')) {
        const codigos = msg.replace('DESPACHO_ASOCIADO::', '')
        setLoteAEliminar(null)
        setErrorEliminacion(`No se puede eliminar este lote porque tiene despacho(s) asociado(s): ${codigos}. Elimine primero el/los despacho(s) para poder eliminar el lote.`)
      } else {
        setLoteAEliminar(null)
        setErrorEliminacion(msg)
      }
    } finally {
      setEliminando(false)
    }
  }

  const handleEditar = async (data: LoteFormData) => {
    if (!loteAEditar) return

    try {
      await actualizar(loteAEditar.id, data)
      setEditDialogError(null)
      setLoteAEditar(null)
    } catch (e) {
      setEditDialogError((e as Error).message)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Lotes"
        description={`${lotes.length} registrados`}
        actions={
          <div className="flex items-center gap-2">
            {canExportSelectedLotes && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDescargarLotesIngresados}
                loading={descargandoIngresados}
                disabled={lotesIngresados.length === 0 || descargandoIngresados}
              >
                <Download className="h-4 w-4 mr-2" /> Descargar ingresados ({lotesIngresados.length})
              </Button>
            )}
            {canExportSelectedLotes && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDescargarLotesSeleccionados}
                loading={descargandoSeleccionados}
                disabled={lotesClasificados.length === 0 || descargandoSeleccionados}
              >
                <Download className="h-4 w-4 mr-2" /> Descargar clasificados ({lotesClasificados.length})
              </Button>
            )}
            {canCreateLotes && (
              <Button onClick={() => { setDialogError(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Nuevo lote</Button>
            )}
          </div>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código o agricultor..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPaginaActual(1)
            }}
          />
        </div>
        <Select
          value={filtroEstado}
          onValueChange={(v) => {
            setFiltroEstado(v as EstadoLote | 'todos')
            setPaginaActual(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_LOTE_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtroVariedad}
          onValueChange={(v) => {
            setFiltroVariedad(v as VariedadProducto | 'todos')
            setPaginaActual(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las variedades</SelectItem>
            {Object.entries(VARIEDAD_PRODUCTO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-full sm:w-48"
          value={filtroFechaIngreso}
          onChange={(e) => {
            setFiltroFechaIngreso(e.target.value)
            setPaginaActual(1)
          }}
        />
        <Select
          value={String(tamanoPagina)}
          onValueChange={(value) => {
            setTamanoPagina(Number(value))
            setPaginaActual(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Tamano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / pag</SelectItem>
            <SelectItem value="20">20 / pag</SelectItem>
            <SelectItem value="50">50 / pag</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setBusqueda('')
            setFiltroEstado('todos')
            setFiltroVariedad('todos')
            setFiltroFechaIngreso('')
            setPaginaActual(1)
          }}
          disabled={!hasFiltrosActivos}
        >
          Limpiar filtros
        </Button>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          title="Sin lotes"
          description="Registra el primer lote del día."
          action={canCreateLotes ? <Button onClick={() => { setDialogError(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Nuevo lote</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {paginados.map((l) => (
            <div
              key={l.id}
              className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/lotes/${l.id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold mt-0.5">
                  {l.codigo_lote_agricultor ?? 'SIN CODIGO DE AGRICULTOR'}
                  {l.sublote ? ` - ${l.sublote}` : ''}
                  {' - '}Bruto: {formatPeso(l.peso_bruto_kg)}
                  {' - '}Jabas: {l.num_cubetas}
                  {' - '}Neto: {formatPeso(l.peso_neto_kg)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {l.agricultor?.apellido}, {l.agricultor?.nombre} - {l.producto ? VARIEDAD_PRODUCTO_CONFIG[l.producto.variedad].label : '-'} - {formatFecha(l.fecha_ingreso)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(() => {
                  const merma = mermaPorLote[l.id]
                  // Mientras se cargan las mermas, los lotes ya clasificados muestran un
                  // placeholder animado en vez de un "-" que se confunde con "sin dato".
                  const mostrandoCarga = l.estado !== 'ingresado' && cargandoMermas && merma === undefined
                  if (mostrandoCarga) {
                    return (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground animate-pulse">
                        Merma: <span className="ml-1 inline-block h-3 w-10 rounded bg-muted-foreground/30" />
                      </span>
                    )
                  }

                  const hasMerma = l.estado !== 'ingresado' && merma !== undefined
                  const mermaValor = Number(merma ?? 0)
                  const mermaTexto = hasMerma ? formatPeso(mermaValor) : '-'
                  const mermaClassName = !hasMerma
                    ? 'bg-muted text-muted-foreground'
                    : mermaValor < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'

                  return (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${mermaClassName}`}>
                      Merma: {mermaTexto}
                    </span>
                  )
                })()}
                <EstadoLoteBadge estado={l.estado} />
                {canPrintLoteTicket && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); printLoteTicket(l) }}>
                    <Printer className="h-4 w-4" />
                  </Button>
                )}
                {canDeleteLotes && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setLoteAEliminar(l) }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {canEditLote(roles, l.estado) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditDialogError(null)
                      setLoteAEditar(l)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/lotes/${l.id}`) }}>
                  <Eye className="h-4 w-4 mr-1" /> Ver
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {inicio + 1}-{Math.min(fin, filtrados.length)} de {filtrados.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaSegura === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {paginaSegura} de {totalPaginas}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
              disabled={paginaSegura === totalPaginas}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {canCreateLotes && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar nuevo lote</DialogTitle></DialogHeader>
            {dialogError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{dialogError}</p>}
            <LoteForm onSubmit={handleSubmit} onCancel={() => { setDialogError(null); setDialogOpen(false) }} />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={Boolean(loteAEditar)} onOpenChange={(open) => { if (!open) { setLoteAEditar(null); setEditDialogError(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar lote</DialogTitle></DialogHeader>
          {editDialogError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{editDialogError}</p>}
          {loteAEditar && (
            <LoteForm
              defaultValues={{
                codigo: loteAEditar.codigo,
                agricultor_id: loteAEditar.agricultor_id,
                recepcionista_id: loteAEditar.recepcionista_id ?? '',
                acopiador_id: loteAEditar.acopiador_id,
                acopiador_agricultor_id: loteAEditar.acopiador_agricultor_id,
                producto_id: loteAEditar.producto_id,
                centro_acopio_id: loteAEditar.centro_acopio_id,
                fecha_ingreso: loteAEditar.fecha_ingreso,
                fecha_cosecha: loteAEditar.fecha_cosecha,
                peso_bruto_kg: loteAEditar.peso_bruto_kg,
                peso_tara_kg: loteAEditar.peso_tara_kg,
                peso_neto_kg: loteAEditar.peso_neto_kg,
                num_cubetas: loteAEditar.num_cubetas,
                jabas_prestadas: loteAEditar.jabas_prestadas,
                codigo_lote_agricultor: loteAEditar.codigo_lote_agricultor,
                sublote: loteAEditar.sublote,
                observaciones: loteAEditar.observaciones,
              }}
              onSubmit={handleEditar}
              onCancel={() => { setLoteAEditar(null); setEditDialogError(null) }}
              isEditing
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(ticketLote)} onOpenChange={(open) => !open && setTicketLote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ticket de confirmación</DialogTitle></DialogHeader>
          {ticketLote && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Agronesis del Perú S.A.C.</CardTitle>
                <p className="text-sm text-muted-foreground">Lote registrado correctamente</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="font-semibold">{ticketLote.codigo}</p>
                </div>
                {ticketLote.codigo_lote_agricultor && (
                  <div>
                    <p className="text-xs text-muted-foreground">Código de agricultor</p>
                    <p className="font-medium">{ticketLote.codigo_lote_agricultor}</p>
                  </div>
                )}
                {ticketLote.sublote && (
                  <div>
                    <p className="text-xs text-muted-foreground">Sublote</p>
                    <p className="font-medium">{ticketLote.sublote}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Agricultor</p>
                  <p className="font-semibold">{ticketLote.agricultor?.apellido}, {ticketLote.agricultor?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Acopiador</p>
                  <p className="font-semibold">{getAcopiadorLabel(ticketLote)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Producto</p>
                  {ticketLote.producto ? (
                    <div className="space-y-1">
                      <p className="font-medium">{ticketLote.producto.nombre}</p>
                      <p className="text-xs text-muted-foreground">Codigo: {ticketLote.producto.codigo}</p>
                      <p className="text-xs text-muted-foreground">Variedad: {VARIEDAD_PRODUCTO_CONFIG[ticketLote.producto.variedad].label}</p>
                      <p className="text-xs text-muted-foreground">Calidad: {CALIDAD_PRODUCTO_CONFIG[ticketLote.producto.calidad].label}</p>
                      <p className="text-xs text-muted-foreground">Tipo: {TIPO_PRODUCCION_CONFIG[ticketLote.producto.tipo_produccion].label}</p>
                    </div>
                  ) : (
                    <p>-</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Bruto</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_bruto_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tara</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_tara_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Neto</p>
                    <p className="font-medium">{formatPeso(ticketLote.peso_neto_kg)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Peso por jaba</p>
                    <p className="font-medium">{formatPeso(calcularPesoPorJaba(ticketLote.peso_neto_kg, ticketLote.num_cubetas))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Jabas ingresadas</p>
                    <p className="font-medium">{ticketLote.num_cubetas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha ingreso</p>
                    <p className="font-medium">{formatFecha(ticketLote.fecha_ingreso)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha cosecha</p>
                    <p className="font-medium">{formatFecha(ticketLote.fecha_cosecha)}</p>
                  </div>
                </div>
                {ticketLote.jabas_prestadas > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Jabas prestadas (por devolver)</p>
                    <p className="font-medium">{ticketLote.jabas_prestadas}</p>
                  </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                  <Button type="button" variant="outline" className="w-full" onClick={() => setTicketLote(null)}>
                    Cerrar
                  </Button>
                  {canPrintLoteTicket && (
                    <Button type="button" variant="secondary" className="w-full" onClick={() => printLoteTicket(ticketLote)}>
                      <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                  )}
                  <Button type="button" className="w-full" onClick={() => {
                    const loteId = ticketLote.id
                    setTicketLote(null)
                    navigate(`/lotes/${loteId}`)
                  }}>
                    Ver lote
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
      {canDeleteLotes && (
        <ConfirmDialog
          open={Boolean(loteAEliminar)}
          title="Eliminar lote"
          description={`¿Está seguro que desea eliminar el lote ${loteAEliminar?.codigo ?? ''}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="destructive"
          loading={eliminando}
          onConfirm={handleEliminar}
          onCancel={() => setLoteAEliminar(null)}
        />
      )}

      <Dialog open={Boolean(errorEliminacion)} onOpenChange={(open) => { if (!open) setErrorEliminacion(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>No se puede eliminar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{errorEliminacion}</p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setErrorEliminacion(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
